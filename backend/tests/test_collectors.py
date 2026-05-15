from __future__ import annotations

from datetime import UTC, datetime

import httpx
import pytest

from app.collectors.aisstream import (
    _parse_position_message,
    _parse_static_message,
    _parse_static_position_message,
    _parse_timestamp,
)
from app.collectors.base import BaseCollector
from app.collectors.bunker_scraper import parse_bunker_prices
from app.collectors.fbx_scraper import parse_index_value
from app.collectors.fred import FREDCollector
from app.config import get_settings
from app.schemas.records import FreightIndexRecord


class DummyCollector(BaseCollector[FreightIndexRecord]):
    source = "dummy"
    record_model = FreightIndexRecord

    def collect(self) -> list[dict[str, object]]:
        return [
            {
                "time": datetime(2026, 5, 14, tzinfo=UTC),
                "index_name": "BDI",
                "value": 1000.0,
                "source": self.source,
            }
        ]


def test_base_collector_validates_records() -> None:
    records = DummyCollector().run()

    assert len(records) == 1
    assert records[0].index_name == "BDI"


def test_parse_bunker_prices_from_table() -> None:
    html = """
    <table>
      <tr><td>SGP</td><td>VLSFO</td><td>$610.50</td></tr>
      <tr><td>RTM</td><td>MGO</td><td>790</td></tr>
    </table>
    """

    rows = parse_bunker_prices(html)

    assert rows[0]["port_code"] == "SGP"
    assert rows[0]["fuel_type"] == "VLSFO"
    assert rows[0]["price_usd_per_ton"] == 610.50
    assert len(rows) == 2


def test_parse_public_index_value_from_data_attribute() -> None:
    rows = parse_index_value('<span data-index-value="2510.45"></span>', "FBX_GLOBAL", "test")

    assert rows[0]["index_name"] == "FBX_GLOBAL"
    assert rows[0]["value"] == pytest.approx(2510.45)


def test_fred_collector_normalizes_observations(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("FRED_API_KEY", "test-key")
    get_settings.cache_clear()

    def fake_request(self: httpx.Client, method: str, url: str, **kwargs: object) -> httpx.Response:
        request = httpx.Request(method, url)
        return httpx.Response(
            200,
            request=request,
            json={
                "observations": [
                    {"date": "2026-05-14", "value": "1400.5"},
                    {"date": "2026-05-13", "value": "."},
                ]
            },
        )

    monkeypatch.setattr(httpx.Client, "request", fake_request)

    records = FREDCollector(series={"BDI": "BDIY"}).run()

    assert len(records) == 1
    assert records[0].index_name == "BDI"
    assert records[0].value == 1400.5
    get_settings.cache_clear()


def test_aisstream_position_message_parser() -> None:
    row = _parse_position_message(
        {
            "MessageType": "PositionReport",
            "MetaData": {"MMSI": 368207620, "time_utc": "2026-05-15T02:00:00Z"},
            "Message": {
                "PositionReport": {
                    "UserID": 368207620,
                    "Latitude": 1.25,
                    "Longitude": 103.8,
                    "Sog": 12.3,
                    "Cog": 180.0,
                    "NavigationalStatus": 0,
                }
            },
        }
    )

    assert row is not None
    assert row["mmsi"] == 368207620
    assert row["lat"] == 1.25
    assert row["lon"] == 103.8
    assert row["sog"] == 12.3


def test_aisstream_timestamp_parser_handles_stream_format() -> None:
    parsed = _parse_timestamp("2026-05-15 02:20:38.650236754 +0000 UTC")

    assert parsed == datetime(2026, 5, 15, 2, 20, 38, 650236, tzinfo=UTC)


def test_aisstream_static_message_parser() -> None:
    row = _parse_static_message(
        {
            "MessageType": "ShipStaticData",
            "MetaData": {
                "MMSI": 477722600,
                "ShipName": "CSSC LE HAVRE       ",
                "time_utc": "2026-05-15 02:38:04.02637196 +0000 UTC",
            },
            "Message": {
                "ShipStaticData": {
                    "UserID": 477722600,
                    "ImoNumber": 9853931,
                    "Name": "CSSC LE HAVRE       ",
                    "Type": 70,
                    "Dimension": {"A": 216, "B": 38, "C": 17, "D": 26},
                }
            },
        }
    )

    assert row is not None
    assert row["mmsi"] == 477722600
    assert row["imo"] == 9853931
    assert row["name"] == "CSSC LE HAVRE"
    assert row["type"] == 70
    assert row["type_label"] == "Cargo"
    assert row["length"] == 254.0
    assert row["width"] == 43.0


def test_aisstream_static_position_message_parser() -> None:
    row = _parse_static_position_message(
        {
            "MessageType": "ShipStaticData",
            "MetaData": {
                "MMSI": 477722600,
                "latitude": 1.15299,
                "longitude": 103.77828,
                "time_utc": "2026-05-15 02:38:04.02637196 +0000 UTC",
            },
            "Message": {
                "ShipStaticData": {
                    "UserID": 477722600,
                    "Type": 70,
                }
            },
        }
    )

    assert row is not None
    assert row["mmsi"] == 477722600
    assert row["lat"] == 1.15299
    assert row["lon"] == 103.77828
