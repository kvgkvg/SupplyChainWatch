# Week 4 Checklist

## Insights Hub

- [x] Insights feed page with card list.
- [x] Correlation heatmap component.
- [x] Forecast mini charts with confidence interval.
- [x] Anomaly timeline.
- [x] Story Mode frontend wired to `POST /api/story/analyze`.
- [x] LLM narrative display with `AI-generated` badge.

## UX Polish

- [x] Loading state for latest insights.
- [x] First-visit dashboard onboarding panel.
- [x] Stale-data warning when overview data is older than 6 hours.
- [x] Vessel Map lazy-loaded as a separate frontend chunk.
- [ ] Toast notifications for background refreshes.
- [ ] Full jargon tooltip glossary.

## Integration

- [x] Frontend API client includes LLM fields and Story Mode types.
- [x] Dashboard latest insights can use API data.
- [x] Insights Hub can use API insights, correlations, anomalies, and Story Mode.
- [ ] 24-hour continuous pipeline run with live Docker services.
- [ ] Manual verification of 6 report insights with live/backfilled data.

## Documentation

- [x] README has LLM setup notes.
- [x] `docs/architecture.md`.
- [x] `docs/insights.md`.
- [x] `docs/report.md`.
- [x] `docs/slides.md`.
- [x] `docs/demo_script.md`.

## Submission Still Requiring Human Action

- [ ] Run collectors long enough to collect meaningful live data.
- [ ] Export final PDF from `docs/report.md` or assignment template.
- [ ] Build slide deck from `docs/slides.md`.
- [ ] Record OBS demo video using `docs/demo_script.md`.

