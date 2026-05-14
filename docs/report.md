# GlobalSupplyWatch Report Draft

## 1. Problem Statement

Global shipping networks are exposed to port congestion, chokepoint disruptions, fuel-cost volatility, and freight-rate shocks. These signals are often available from separate sources, which makes it difficult to connect operational conditions with market impact. GlobalSupplyWatch addresses this by combining maritime, freight, and macro indicators into a single local analytics dashboard.

## 2. System Overview

The system uses a FastAPI backend, Celery scheduled workers, PostgreSQL with TimescaleDB/PostGIS, Redis, and a React frontend. Collectors ingest AIS, freight index, bunker price, weather, and macro data. Analysis jobs compute congestion, chokepoint status, anomalies, forecasts, correlations, and insight narratives.

## 3. Data Pipeline

Records are validated before insertion. Collector runs are logged to `collection_log`. Time-series records are stored in hypertables and spatial records use PostGIS-compatible geometry. Scheduled analysis tasks run after collection windows and write derived records to analytics tables.

## 4. Exploratory Data Analysis

EDA focuses on:

- Missingness and source freshness.
- Freight index distributions and changes.
- Port congestion trend and outliers.
- Chokepoint vessel count volatility.
- Correlation and lag between operational and market signals.
- Forecast backtest error through MAPE.

## 5. Key Insights

The report should include the six insight groups documented in `docs/insights.md`:

1. Chokepoint disruption ripple effect.
2. Shanghai port lead-lag relationship.
3. Bunker prices as cost pressure signal.
4. Port congestion anomaly concentration.
5. Freight index co-movement.
6. Forecast reliability and directional use.

Each final insight should include a chart, the source tables, the computed statistic, and a narrative interpretation.

## 6. LLM-Assisted Interpretation

DashScope Qwen models enrich template insights, anomaly explanations, forecast commentary, and Story Mode relationship summaries. The LLM layer is intentionally constrained:

- It can only use numbers passed in structured input.
- It uses hedged language for causality.
- Generated text is rejected if it contains unauthorized figures.
- Template fallbacks remain available.
- Token usage is logged for monitoring.

## 7. Frontend Dashboard

The frontend contains five pages:

- Dashboard overview.
- Macro Indices.
- Vessel Map.
- Ports.
- Insights Hub.

The Week 4 polish pass adds live insight feed wiring, Story Mode frontend calls, stale-data warning, first-visit onboarding, and lazy-loaded map bundle.

## 8. Limitations

- The application is designed for local deployment, not public multi-user hosting.
- Some collectors depend on free/public source availability.
- Historical claims require enough runtime or backfilled data.
- Forecasting currently uses a moving-average baseline with Prophet-ready storage shape.

## 9. Future Work

- Add route-specific FBX and SCFI coverage.
- Add downloadable report exports.
- Add alerting for severe anomalies.
- Add robust backfill pipelines for multi-year event studies.
- Add automated screenshot generation for the slide deck.

