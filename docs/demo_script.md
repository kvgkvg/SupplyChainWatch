# Demo Video Script

Target duration: 5-7 minutes.

## 0:00-0:30 Problem Intro

Global shipping disruption signals are spread across vessel feeds, port congestion, freight indices, bunker prices, and macro data. The goal of GlobalSupplyWatch is to combine these into one local monitoring and interpretation dashboard.

## 0:30-1:00 Architecture

Show `docs/architecture.md`. Explain FastAPI, Celery, TimescaleDB/PostGIS, Redis, React, and optional DashScope Qwen enrichment.

## 1:00-2:00 Dashboard

Open the dashboard. Point out KPIs, freight trend chart, mini port congestion map, market snapshot, stale-data warning behavior, and latest insight feed.

## 2:00-3:00 Vessel Map

Open Vessel Map. Demonstrate the MapLibre basemap, vessel points, viewport interaction, filters, and why spatial indexing matters for AIS queries.

## 3:00-4:00 Ports

Open Ports. Show congestion levels, port filtering, and mini map visualization for fast operational scanning.

## 4:00-5:30 Insights Hub

Open Insights Hub. Demonstrate:

- Live/latest insight feed.
- AI-generated badge when `narrative_llm` exists.
- Correlation heatmap.
- Forecast confidence charts.
- Anomaly timeline.
- Story Mode pair analysis.

## 5:30-6:30 Key Insight Highlight

Use one Story Mode pair, such as `BDI × FBX_GLOBAL` or `Suez × WCI`, and explain correlation, lag, caveats, and how LLM text is safety-checked.

## 6:30-7:00 Outro

Summarize: multi-source data pipeline, spatial/time-series analytics, interpretable insights, and local Docker deployment.

