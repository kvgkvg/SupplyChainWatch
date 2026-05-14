# CONTEXT.md — GlobalSupplyWatch Progress Snapshot

> Last updated: 2026-05-15 (updated after week 4 push)

---

## What is this project

GlobalSupplyWatch is a 4-week course project that monitors global shipping supply chains.
Stack: FastAPI + PostgreSQL/TimescaleDB/PostGIS + Celery + Redis on the backend;
Vite + React 18 + TypeScript + MapLibre + deck.gl on the frontend.
Deployment is local-only via Docker Compose.

---

## Completed work

### Week 1 — Foundation & Data Pipeline ✅

| Area | Done |
|---|---|
| Repo & tooling | Monorepo scaffold, `.env.example`, README, `.pre-commit-config.yaml`, GitHub Actions lint/test workflow, PR template |
| Docker | Full `docker-compose.yml`: postgres+timescaledb+postgis, redis, backend, worker, beat, flower, mailhog |
| DB schema | Alembic set up; migration `0001` creates all tables: `vessel_positions`, `freight_indices`, `bunker_prices`, `port_congestion`, `trade_flows`, `vessels`, `ports`, `chokepoints`, `anomalies`, `forecasts`, `insights`, `collection_log` |
| Seed data | `app/scripts/seed_reference_data.py` — 50 major ports + 5 chokepoints |
| Collectors | `base.py` (retry, backoff, Pydantic validation, audit log to `collection_log`) + 7 collectors: AISStream, FRED, UN Comtrade, Open-Meteo, Ship&Bunker scraper, FBX scraper, WCI scraper |
| Celery | `tasks/celery_app.py`, `tasks/schedule.py` (beat schedule for all jobs), `tasks/jobs.py` |
| Tests | Unit tests with mocked HTTP for all collectors (`tests/test_collectors.py`) |
| Docs | `docs/data_sources.md`, `docs/data_dictionary.md`; notebook placeholders `01`–`05` |
| Data quality | `app/analysis/data_quality.py` — lightweight validation helpers |

**Requires live accounts/data (team action):** API keys in `.env`, 7+ days of collector runtime, NOAA AIS backfill download.

---

### Week 2 — Backend API & Analysis ✅

| Area | Done |
|---|---|
| FastAPI | App entry `main.py`, middleware (CORS, gzip, JSON error envelope), `api/deps.py`, `api/rate_limit.py` |
| Pydantic schemas | `schemas/api.py` + `schemas/records.py` — full response models |
| REST endpoints (15) | `GET /api/health`, `/api/indices`, `/api/indices/{name}`, `/api/indices/{name}/forecast`, `/api/vessels/snapshot`, `/api/vessels/{mmsi}`, `/api/ports`, `/api/ports/congestion`, `/api/ports/{id}/timeline`, `/api/chokepoints`, `/api/chokepoints/{id}/timeline`, `/api/anomalies`, `/api/insights/latest`, `/api/correlations`, `/api/stats/overview` |
| Caching | `utils/cache.py` — Redis helper, 60 s TTL for heavy reads |
| Migration | `0002` adds week-2 analysis tables and PostGIS geometry columns for ports/chokepoints |
| Analysis | `analysis/port_congestion.py` (PostGIS spatial query), `analysis/anomaly.py` (rolling z-score + IsolationForest), `analysis/forecast.py` (moving-average baseline, Prophet-ready storage shape), `analysis/correlation.py` (Pearson matrix), `analysis/chokepoint_status.py` |
| Insight generator | `analysis/insight_generator.py` — 8+ template-based insights, run hourly |
| Docs | `docs/postman_collection.json`, `docs/week2_checklist.md`, `docs/api_consistency_report.md` |
| FE stub | `frontend/src/api/client.ts` — typed API client |

**Requires live services (team action):** `make migrate`, `make seed`, add API keys, trigger collectors, run `EXPLAIN ANALYZE` on vessel snapshot query with real AIS volume.

---

### Week 3 — Frontend Dashboard ✅

| Area | Done |
|---|---|
| Setup | Vite + React 18 + TS + Tailwind + shadcn/ui; `frontend/src/styles/tokens.css` design tokens (colors, typography, spacing) |
| Layout | `components/layout/Sidebar.tsx`, `components/layout/Header.tsx` |
| Primitives | `Card`, `Badge`, `StatusDot`, `icons.tsx` |
| Charts | `AreaChart.tsx`, `Sparkline.tsx` |
| Map | `MiniMap.tsx` (MapLibre GL) |
| Feed | `InsightRow.tsx` |
| Pages (5) | `Dashboard.tsx` (KPI cards, mini charts, port map, insight feed), `MacroIndices.tsx` (time series, period selector, multi-index), `VesselMap.tsx` (full-screen MapLibre + deck.gl), `Ports.tsx` (port grid + filters), `InsightsHub.tsx` (feed, heatmap, forecast charts, anomaly timeline, story mode) |
| Mock data | `src/data/mock.ts` — used as fallback when API returns empty |
| API wiring | `InsightsHub` fetches `/api/insights/latest`; falls back to mock if API unreachable |

---

### Extra — LLM Enrichment Module (beyond original plan) ✅

Added a full LLM layer on top of the template insights:

| File | Purpose |
|---|---|
| `app/llm/client.py` | Async LLM client wrapper (tiered: fast / standard) |
| `app/llm/prompts.py` | Prompt builders for narrator, anomaly explainer, forecast commenter, story mode |
| `app/llm/safety.py` | Validates generated text — rejects hallucinated numbers not present in source data |
| `app/llm/narrator.py` | Enriches top-priority insights with LLM narrative; stores in `narrative_llm` + `narrative_model` columns |
| `app/llm/anomaly_explainer.py` | LLM explanation for detected anomalies |
| `app/llm/forecast_commenter.py` | LLM commentary on forecast output |
| `app/llm/story_mode.py` | Given two entities, generates a narrative about their relationship |
| `app/api/routes/story.py` | `GET /api/story` endpoint wiring story mode |
| Migration `0003` | Adds `narrative_llm`, `narrative_model`, `narrative_generated_at` to `insights` table |
| Tests | `tests/llm/` — unit tests for client, narrator, story mode; integration test; fixtures |

`InsightsHub.tsx` already reads `narrative_llm` and shows an "AI" badge when present.

---

### Week 4 — Insights Hub, Polish, Deliverables (partial) ✅/🔲

| Area | Status | Notes |
|---|---|---|
| InsightsHub API wiring | ✅ | Fetches live correlations, anomalies, story mode; falls back to mock |
| Story Mode wired | ✅ | Calls `POST /api/story/analyze`; `StoryAnalyzeResponse` renders headline + narrative + findings |
| API client expanded | ✅ | New types: `StoryEntity`, `StoryAnalyzeRequest/Response`, `CorrelationCell`, `AnomalyResponse`, `OverviewStats`; new methods: `storyAnalyze()`, `correlations()`, `overviewStats()` |
| Dashboard onboarding panel | ✅ | First-visit panel added to `Dashboard.tsx` |
| Stale-data warning | ✅ | Warning shown when overview data is >6 h old |
| VesselMap lazy load | ✅ | Lazy-loaded as separate Vite chunk |
| Loading state (insights) | ✅ | Spinner/skeleton while insights fetch |
| Docs written | ✅ | `docs/architecture.md`, `docs/insights.md` (6 insight targets), `docs/report.md`, `docs/slides.md`, `docs/demo_script.md`, `docs/week4_checklist.md` |
| README LLM notes | ✅ | LLM setup section added |
| Toast notifications | 🔲 | Not yet implemented |
| Jargon tooltip glossary | 🔲 | Not yet implemented |
| 24 h pipeline run | 🔲 | Requires live Docker services (team action) |
| Live data verification (6 insights) | 🔲 | `docs/insights.md` has the targets; needs live/backfilled data |
| Final EDA notebook | 🔲 | `05_initial_eda.ipynb` still placeholder |
| Report PDF export | 🔲 | `docs/report.md` is the draft; needs LaTeX/PDF export |
| Slide deck | 🔲 | `docs/slides.md` is the outline; needs tool (PowerPoint/Canva) |
| Demo video | 🔲 | `docs/demo_script.md` written; needs OBS recording |

---

## What still needs human/live-data action

- Run collectors continuously until tables have meaningful volume
- `make migrate && make seed` against live Docker postgres
- 24 h pipeline run — verify no Celery errors
- Run `EXPLAIN ANALYZE` on vessel snapshot query with real AIS volume
- Manually verify 6 insights in `docs/insights.md` with real/backfilled data
- Export `docs/report.md` to PDF (XeLaTeX or assignment template)
- Build slide deck from `docs/slides.md`
- Record 5–7 min demo video using `docs/demo_script.md` (OBS Studio)

---

## Current file tree summary

```
backend/
  app/
    api/routes/     → 9 route files covering all 15 endpoints
    collectors/     → base + 7 source collectors
    analysis/       → port_congestion, anomaly, forecast, correlation, chokepoint_status, insight_generator, data_quality
    llm/            → client, narrator, anomaly_explainer, forecast_commenter, story_mode, prompts, safety
    db/             → models.py (all tables), session.py
    schemas/        → api.py, records.py
    tasks/          → celery_app, schedule, jobs
    utils/          → cache (Redis)
    scripts/        → seed_reference_data
  alembic/versions/ → 0001 (initial schema), 0002 (week-2 analysis), 0003 (LLM features)
  tests/            → test_collectors, test_analysis, test_api, llm/ (4 test files)
  notebooks/        → 01–05 (01–04 have exploration code; 05 is placeholder)
frontend/src/
  pages/            → Dashboard, MacroIndices, VesselMap, Ports, InsightsHub
  components/       → Card, Badge, StatusDot, AreaChart, Sparkline, MiniMap, InsightRow, layout/
  api/client.ts     → typed API client
  data/mock.ts      → fallback mock data
docs/               → data_sources, data_dictionary, postman_collection, api_consistency_report,
                     architecture, insights (6 targets), report (draft), slides (outline),
                     demo_script, week1/2/4 checklists
```

---

## Key architecture decisions (from PLAN.md)

- **No WebSocket** — vessel positions are hourly batch; frontend polls every 60 s via TanStack Query
- **Prophet baseline** — forecast retrained daily; backtested with MAPE; stored in `forecasts` table
- **LLM safety gate** — `safety.py` validates generated narratives against source numbers before storing
- **TimescaleDB** — `vessel_positions` and `freight_indices` are hypertables; compress after 7 days
- **deck.gl** — vessel map uses `ScatterplotLayer`; clustering kicks in above 5,000 points
