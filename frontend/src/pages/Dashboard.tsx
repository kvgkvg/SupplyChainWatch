import React, { useMemo, useState } from 'react'
import { useQueries, useQuery } from '@tanstack/react-query'
import { Card } from '../components/Card'
import { Sparkline } from '../components/Sparkline'
import { AreaChart } from '../components/AreaChart'
import { MiniMap } from '../components/MiniMap'
import { InsightRow, type InsightCategory } from '../components/InsightRow'
import { Icons } from '../components/icons'
import { Badge } from '../components/Badge'
import {
  DataProvenance,
  EmptyState,
  ErrorPanel,
  MetricCard,
  PageShell,
  SectionHeader,
  SkeletonBlock,
} from '../components/DataState'
import { MOCK, fmtNum, fmtPct } from '../data/mock'
import { apiClient, type InsightResponse, type OverviewStats } from '../api/client'
import { queryKeys } from '../api/queries'
import {
  activeHighAnomalies,
  formatDateTime,
  isStale,
  latestPoint,
  percentChange,
  relativeTime,
} from '../api/viewModels'
import type { PageId } from '../components/layout/Sidebar'

type FeedInsight = {
  text: string
  category: InsightCategory
  time: string
  aiGenerated?: boolean
}

const normalizeCategory = (category?: string | null): InsightCategory => {
  if (category === 'anomaly' || category === 'correlation' || category === 'forecast') return category
  return 'trend'
}

const chartLabels = (points: { time: string }[]) =>
  points.slice(-30).map(point => new Date(point.time).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }))

const chartValues = (points: { value: number }[]) => points.slice(-30).map(point => point.value)

const kpiChange = (value: number | null) => value == null ? 'No trend' : `${fmtPct(value)} · 7-point change`

const riskFromStats = (stats: OverviewStats | null, highAnomalies: number) => {
  const count = stats?.high_severity_anomalies ?? highAnomalies
  if (count >= 5) return { label: 'Elevated global risk', severity: 'high' as const, detail: `${count} high-severity anomalies in the recent window.` }
  if (count > 0) return { label: 'Watchlist active', severity: 'medium' as const, detail: `${count} high-severity anomalies require review.` }
  return { label: 'Normal operating band', severity: 'low' as const, detail: 'No high-severity anomaly concentration in the latest API window.' }
}

export const Dashboard: React.FC<{ onNavigate?: (page: PageId) => void }> = ({ onNavigate }) => {
  const [showTour, setShowTour] = useState(() => localStorage.getItem('gsw-onboarding-seen') !== '1')

  const statsQuery = useQuery({
    queryKey: queryKeys.overview,
    queryFn: ({ signal }) => apiClient.overviewStats({ signal }),
    refetchInterval: 60_000,
  })
  const insightsQuery = useQuery({
    queryKey: queryKeys.insights(5),
    queryFn: ({ signal }) => apiClient.latestInsights(5, { signal }),
  })
  const congestionQuery = useQuery({
    queryKey: queryKeys.portCongestion,
    queryFn: ({ signal }) => apiClient.portCongestion({ signal }),
  })
  const anomaliesQuery = useQuery({
    queryKey: queryKeys.anomalies(30),
    queryFn: ({ signal }) => apiClient.anomalies({ days: 30 }, { signal }),
  })
  const indexQueries = useQueries({
    queries: ['BDI', 'FBX_GLOBAL'].map(name => ({
      queryKey: queryKeys.indexHistory(name, 180),
      queryFn: ({ signal }: { signal: AbortSignal }) => apiClient.indexHistory(name, { limit: 180 }, { signal }),
      retry: 1,
    })),
  })

  const bdi = indexQueries[0].data ?? []
  const fbx = indexQueries[1].data ?? []
  const liveStats = statsQuery.data ?? null
  const hasLiveSummary = Boolean(liveStats)
  const apiError = statsQuery.error ?? insightsQuery.error ?? congestionQuery.error ?? anomaliesQuery.error ?? indexQueries.find(q => q.error)?.error
  const usingDemo = !hasLiveSummary || indexQueries.some(q => q.isError)
  const stale = isStale(liveStats?.generated_at, 6)
  const highAnomalies = activeHighAnomalies(anomaliesQuery.data ?? [])
  const risk = riskFromStats(liveStats, highAnomalies)

  const liveInsights = useMemo<FeedInsight[]>(() => (insightsQuery.data ?? []).map((insight: InsightResponse) => ({
    text: insight.narrative_llm || insight.narrative,
    category: normalizeCategory(insight.category),
    time: relativeTime(insight.narrative_generated_at || insight.generated_at),
    aiGenerated: Boolean(insight.narrative_llm),
  })), [insightsQuery.data])
  const insights: FeedInsight[] = liveInsights.length > 0 ? liveInsights : MOCK.insights.map(item => ({ ...item, aiGenerated: false }))

  const bdiLatest = liveStats?.latest_bdi ?? latestPoint(bdi)?.value ?? 1847
  const fbxLatest = liveStats?.latest_fbx ?? latestPoint(fbx)?.value ?? 2156
  const bdiChange = percentChange(bdi)
  const fbxChange = percentChange(fbx)
  const chartHasLive = bdi.length > 3 && fbx.length > 3
  const chartData = chartHasLive
    ? {
      labels: chartLabels(bdi.length <= fbx.length ? bdi : fbx),
      datasets: [
        { data: chartValues(bdi), color: 'var(--chart-1)' },
        { data: chartValues(fbx), color: 'var(--chart-2)', prefix: '$' },
      ],
    }
    : {
      labels: MOCK.dates30,
      datasets: [
        { data: MOCK.bdi30, color: 'var(--chart-1)' },
        { data: MOCK.fbx30, color: 'var(--chart-2)', prefix: '$' },
      ],
    }

  const highPorts = (congestionQuery.data ?? []).filter(row => row.total_in_area >= 100 || row.anchored_count >= 45).length
  const vesselCount = liveStats?.active_vessels ?? 12847
  const anomalyCount = (liveStats?.high_severity_anomalies ?? highAnomalies) || 7

  const dismissTour = () => {
    localStorage.setItem('gsw-onboarding-seen', '1')
    setShowTour(false)
  }

  return (
    <PageShell>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {showTour && (
          <Card style={{ padding: 14, borderColor: 'var(--accent)', background: 'var(--accent-muted)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent-text)' }}>GlobalSupplyWatch command center</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 3 }}>
                  Start with global risk, inspect map and port pressure, then use Insights Hub for evidence-backed narratives.
                </div>
              </div>
              <button onClick={dismissTour} style={{ border: 0, borderRadius: 4, padding: '5px 10px', cursor: 'pointer', color: 'var(--accent-text)', background: 'var(--bg-elevated)' }}>Got it</button>
            </div>
          </Card>
        )}

        {stale && (
          <Card style={{ padding: 12, borderColor: 'var(--warning)', background: 'var(--warning-muted)' }}>
            <span style={{ fontSize: 12, color: 'var(--warning)', fontWeight: 600 }}>Data may be stale.</span>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)', marginLeft: 8 }}>
              Last overview refresh: {formatDateTime(liveStats?.generated_at)}.
            </span>
          </Card>
        )}
        {apiError && <ErrorPanel error={apiError} title="Some dashboard APIs are unavailable" compact />}

        <div style={{ display: 'grid', gridTemplateColumns: '1.35fr repeat(4, minmax(150px, 1fr))', gap: 12 }}>
          <Card style={{ padding: 16, border: `1px solid ${risk.severity === 'high' ? 'var(--danger)' : risk.severity === 'medium' ? 'var(--warning)' : 'var(--border-default)'}` }}>
            <SectionHeader
              title="Global Risk Overview"
              sub={risk.detail}
              action={<Badge variant={risk.severity === 'high' ? 'danger' : risk.severity === 'medium' ? 'warning' : 'success'}>{risk.label}</Badge>}
            />
            <DataProvenance
              mode={usingDemo ? 'demo' : 'live'}
              source={usingDemo ? 'API unavailable or sparse' : 'Stats, anomalies, congestion'}
              timestamp={liveStats ? `Updated ${relativeTime(liveStats.generated_at)}` : undefined}
              stale={stale}
            />
          </Card>
          <MetricCard label="Baltic Dry Index" value={fmtNum(Math.round(bdiLatest))} sub={kpiChange(bdiChange)} tone={bdiChange != null && bdiChange < 0 ? 'danger' : 'info'} icon={<Icons.TrendingUp size={15} />} footer={<Sparkline data={chartHasLive ? chartValues(bdi).slice(-14) : MOCK.bdiSpark} color="var(--chart-1)" width={90} height={28} />} />
          <MetricCard label="Freightos Baltic" value={`$${fmtNum(Math.round(fbxLatest))}`} sub={kpiChange(fbxChange)} tone={fbxChange != null && fbxChange > 0 ? 'warning' : 'info'} icon={<Icons.Activity size={15} />} footer={<Sparkline data={chartHasLive ? chartValues(fbx).slice(-14) : MOCK.fbxSpark} color="var(--chart-2)" width={90} height={28} />} />
          <MetricCard label="Active Vessels" value={fmtNum(vesselCount)} sub="latest AIS snapshot" tone="success" icon={<Icons.Ship size={15} />} footer={<Sparkline data={MOCK.vesselSpark} color="var(--chart-3)" width={90} height={28} />} />
          <MetricCard label="High Anomalies" value={fmtNum(anomalyCount)} sub="30-day severity filter" tone={anomalyCount > 0 ? 'danger' : 'success'} icon={<Icons.AlertTriangle size={15} />} footer={<Sparkline data={MOCK.anomalySpark} color="var(--danger)" width={90} height={28} />} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 3fr) minmax(300px, 2fr)', gap: 12 }}>
          <Card style={{ padding: '16px', minWidth: 0 }}>
            <SectionHeader
              title="Freight Index Trends"
              sub={chartHasLive ? 'Latest BDI and FBX_GLOBAL API history' : 'Demo fallback · backend history not available'}
              action={<DataProvenance mode={chartHasLive ? 'live' : 'demo'} source="BDI · FBX" />}
            />
            {(indexQueries.some(q => q.isLoading) && !chartHasLive) ? <SkeletonBlock height={200} /> : (
              <AreaChart datasets={chartData.datasets} labels={chartData.labels} height={200} />
            )}
          </Card>

          <Card style={{ padding: '16px', minWidth: 0 }}>
            <SectionHeader
              title="Port Hotspots"
              sub={congestionQuery.data?.length ? `${highPorts} ports in elevated pressure band` : 'Demo fallback overlay'}
              action={<DataProvenance mode={congestionQuery.data?.length ? 'live' : 'demo'} source="Port congestion" />}
            />
            <MiniMap height={176} congestion={congestionQuery.data ?? []} />
          </Card>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 3fr) minmax(280px, 2fr)', gap: 12 }}>
          <Card style={{ padding: '16px', minWidth: 0 }}>
            <SectionHeader
              title="Latest Insights"
              sub={liveInsights.length ? 'API narratives with AI badge when LLM text exists' : 'Demo fallback narratives are labeled'}
              action={<button onClick={() => onNavigate?.('insights')} style={{ border: 0, background: 'transparent', cursor: 'pointer' }}><Badge variant="accent">Open Insights Hub</Badge></button>}
            />
            {!insightsQuery.isLoading && liveInsights.length === 0 && <DataProvenance mode="demo" source="No live insight rows returned" />}
            {insightsQuery.isLoading ? <SkeletonBlock height={160} lines={4} /> : insights.map((insight, i) => (
              <InsightRow key={`${insight.time}-${i}`} text={insight.text} category={insight.category} time={insight.time} aiGenerated={insight.aiGenerated ?? false} />
            ))}
          </Card>

          <Card style={{ padding: '16px', minWidth: 0 }}>
            <SectionHeader title="What Changed" sub="Operational deltas worth calling out in demo" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { label: 'BDI movement', value: bdiChange == null ? 'No live trend' : fmtPct(bdiChange), tone: bdiChange != null && bdiChange > 0 ? 'var(--success)' : 'var(--danger)' },
                { label: 'FBX movement', value: fbxChange == null ? 'No live trend' : fmtPct(fbxChange), tone: fbxChange != null && fbxChange > 0 ? 'var(--warning)' : 'var(--success)' },
                { label: 'High-pressure ports', value: congestionQuery.data?.length ? `${highPorts} flagged` : 'Demo overlay', tone: highPorts > 0 ? 'var(--warning)' : 'var(--text-primary)' },
                { label: 'Latest sync', value: liveStats ? relativeTime(liveStats.generated_at) : 'Demo fallback', tone: stale ? 'var(--warning)' : 'var(--text-primary)' },
              ].map(row => (
                <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '9px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{row.label}</span>
                  <span className="mono-num" style={{ fontSize: 12, color: row.tone, fontWeight: 500 }}>{row.value}</span>
                </div>
              ))}
            </div>
            {!statsQuery.isLoading && !liveStats && <EmptyState title="Overview endpoint returned no usable summary" detail="Dashboard is showing clearly labeled demo values for the first run." compact />}
          </Card>
        </div>
      </div>
    </PageShell>
  )
}
