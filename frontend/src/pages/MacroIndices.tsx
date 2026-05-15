import React, { useEffect, useMemo, useState } from 'react'
import { apiClient, type IndexPoint, type IndexSummary } from '../api/client'
import { Badge } from '../components/Badge'
import { Card } from '../components/Card'
import { fmtNum, fmtPct } from '../data/mock'

const PERIODS = ['7D', '30D', '90D', '1Y', 'All'] as const
type Period = typeof PERIODS[number]
const PERIOD_DAYS: Record<Period, number | null> = { '7D': 7, '30D': 30, '90D': 90, '1Y': 365, All: null }
const COLORS = ['#3B82F6', '#06B6D4', '#A78BFA', '#F59E0B', '#22C55E', '#EF4444', '#EC4899', '#94A3B8']

interface IndexMeta extends IndexSummary {
  color: string
  label: string
  abbr: string
}

const friendlyName = (name: string): string => {
  const labels: Record<string, string> = {
    DCOILBRENTEU: 'Brent Crude Oil',
    DTWEXBGS: 'Trade Weighted U.S. Dollar',
    INDPRO: 'U.S. Industrial Production',
    CPIAUCSL: 'U.S. Consumer Price Index',
    FEDFUNDS: 'Federal Funds Rate',
    DGS10: '10-Year Treasury Yield',
    T10Y2Y: '10Y-2Y Treasury Spread',
    PAYEMS: 'U.S. Nonfarm Payrolls',
    RSAFS: 'U.S. Retail Sales',
  }
  return labels[name] ?? name.replace(/_/g, ' ')
}

const shortName = (name: string): string => {
  if (name === 'DCOILBRENTEU') return 'BRENT'
  if (name === 'DTWEXBGS') return 'USD'
  if (name === 'INDPRO') return 'INDPRO'
  if (name === 'CPIAUCSL') return 'CPI'
  if (name === 'FEDFUNDS') return 'FED'
  if (name === 'DGS10') return '10Y'
  if (name === 'T10Y2Y') return '10Y-2Y'
  if (name === 'PAYEMS') return 'PAYROLLS'
  if (name === 'RSAFS') return 'RETAIL'
  return name.split('_').slice(0, 2).join(' ')
}

const formatDate = (iso: string): string =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

const valuePrefix = (name: string): string => (name === 'DCOILBRENTEU' ? '$' : '')
const valueUnit = (name: string): string => {
  if (['FEDFUNDS', 'DGS10', 'T10Y2Y'].includes(name)) return '%'
  if (name === 'PAYEMS') return 'k'
  if (name === 'RSAFS') return 'M'
  return ''
}

const PillTabs: React.FC<{ value: Period; onChange: (v: Period) => void }> = ({ value, onChange }) => (
  <div style={{ display: 'inline-flex', background: 'var(--bg-input)', borderRadius: 6, border: '1px solid var(--border-subtle)', padding: 2 }}>
    {PERIODS.map(opt => (
      <button key={opt} onClick={() => onChange(opt)} style={{
        padding: '4px 12px', borderRadius: 4, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 500,
        background: value === opt ? 'var(--accent)' : 'transparent',
        color: value === opt ? '#fff' : 'var(--text-muted)',
      }}>{opt}</button>
    ))}
  </div>
)

const CheckPill: React.FC<{ label: string; color: string; checked: boolean; onChange: () => void }> = ({ label, color, checked, onChange }) => (
  <button onClick={onChange} style={{
    display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 10px',
    borderRadius: 4, cursor: 'pointer', fontSize: 12, fontWeight: 500,
    background: checked ? 'var(--bg-hover)' : 'transparent',
    color: checked ? 'var(--text-primary)' : 'var(--text-muted)',
    border: `1px solid ${checked ? 'var(--border-default)' : 'transparent'}`,
  }}>
    <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, opacity: checked ? 1 : 0.4 }} />
    {label}
  </button>
)

const ToggleSwitch: React.FC<{ label: string; checked: boolean; onChange: (v: boolean) => void }> = ({ label, checked, onChange }) => (
  <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12, color: 'var(--text-secondary)' }}>
    {label}
    <span onClick={() => onChange(!checked)} style={{
      width: 34, height: 18, borderRadius: 9, padding: 2, cursor: 'pointer', display: 'inline-block',
      background: checked ? 'var(--accent)' : 'var(--bg-hover)',
      border: `1px solid ${checked ? 'var(--accent)' : 'var(--border-default)'}`,
    }}>
      <span style={{
        width: 12, height: 12, borderRadius: '50%', background: '#fff', display: 'block',
        transform: checked ? 'translateX(16px)' : 'translateX(0)',
        transition: 'transform 0.15s',
      }} />
    </span>
  </label>
)

interface ChartProps {
  indices: IndexMeta[]
  activeNames: string[]
  histories: Record<string, IndexPoint[]>
  period: Period
}

const MacroChart: React.FC<ChartProps> = ({ indices, activeNames, histories, period }) => {
  const [hover, setHover] = useState<{ idx: number; x: number } | null>(null)
  const W = 900, H = 340
  const pad = { top: 16, right: 20, bottom: 32, left: 58 }
  const cw = W - pad.left - pad.right
  const ch = H - pad.top - pad.bottom
  const active = indices.filter(ix => activeNames.includes(ix.index_name))
  const days = PERIOD_DAYS[period]
  const cutoff = days === null ? null : Date.now() - days * 24 * 60 * 60 * 1000

  const series = active.map(ix => {
    const points = (histories[ix.index_name] ?? []).filter(point => cutoff === null || new Date(point.time).getTime() >= cutoff)
    return { ix, points }
  }).filter(item => item.points.length > 0)

  const values = series.flatMap(item => item.points.map(point => point.value))
  const min = values.length ? Math.min(...values) : 0
  const max = values.length ? Math.max(...values) : 1
  const range = max - min || 1
  const yPad = range * 0.08
  const yMin = min - yPad
  const yRange = range + yPad * 2
  const maxLen = Math.max(1, ...series.map(item => item.points.length))
  const toX = (i: number, len: number) => pad.left + (i / Math.max(len - 1, 1)) * cw
  const toY = (v: number) => pad.top + (1 - (v - yMin) / yRange) * ch
  const ticks = Array.from({ length: 6 }, (_, i) => yMin + (i / 5) * yRange)

  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const rawX = (e.clientX - rect.left) * (W / rect.width)
    const x = Math.max(pad.left, Math.min(W - pad.right, rawX))
    setHover({ idx: Math.round(((x - pad.left) / cw) * (maxLen - 1)), x })
  }

  if (series.length === 0) {
    return <div style={{ height: 340, display: 'grid', placeItems: 'center', color: 'var(--text-muted)', fontSize: 13 }}>No real index data for this period.</div>
  }

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: 'block' }} onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
      {ticks.map((value, i) => {
        const y = toY(value)
        return (
          <React.Fragment key={i}>
            <line x1={pad.left} y1={y} x2={W - pad.right} y2={y} stroke="var(--border-subtle)" />
            <text x={pad.left - 8} y={y + 3.5} textAnchor="end" style={{ fontSize: 10, fill: 'var(--text-muted)', fontFamily: 'IBM Plex Mono' }}>
              {fmtNum(value)}
            </text>
          </React.Fragment>
        )
      })}
      {series.map(({ ix, points }) => {
        const path = points.map((point, i) => `${i === 0 ? 'M' : 'L'}${toX(i, points.length).toFixed(1)},${toY(point.value).toFixed(1)}`).join(' ')
        const step = Math.max(1, Math.ceil(points.length / 7))
        return (
          <g key={ix.index_name}>
            <path d={path} fill="none" stroke={ix.color} strokeWidth="1.9" strokeLinejoin="round" />
            {points.map((point, i) => (i % step === 0 || i === points.length - 1) ? (
              <text key={point.time} x={toX(i, points.length)} y={H - 5} textAnchor="middle" style={{ fontSize: 9, fill: 'var(--text-muted)' }}>
                {formatDate(point.time)}
              </text>
            ) : null)}
          </g>
        )
      })}
      {hover && (
        <>
          <line x1={hover.x} y1={pad.top} x2={hover.x} y2={pad.top + ch} stroke="var(--border-strong)" strokeDasharray="3,3" />
          <g transform={`translate(${Math.min(hover.x + 12, W - 176)}, ${pad.top + 8})`}>
            <rect width="166" height={series.length * 22 + 28} rx="7" fill="var(--bg-elevated)" stroke="var(--border-default)" opacity="0.96" />
            {series.map(({ ix, points }, i) => {
              const idx = Math.max(0, Math.min(points.length - 1, Math.round((hover.idx / Math.max(maxLen - 1, 1)) * (points.length - 1))))
              const point = points[idx]
              return (
                <g key={ix.index_name} transform={`translate(10, ${22 + i * 22})`}>
                  <circle cx="4" cy="-4" r="3" fill={ix.color} />
                  <text x="14" y="0" style={{ fontSize: 10.5, fill: 'var(--text-primary)', fontFamily: 'IBM Plex Mono' }}>
                    {ix.abbr}: {valuePrefix(ix.index_name)}{fmtNum(point.value)}{valueUnit(ix.index_name)}
                  </text>
                </g>
              )
            })}
          </g>
        </>
      )}
    </svg>
  )
}

const IndexStatCard: React.FC<{ idx: IndexMeta; points: IndexPoint[]; period: Period }> = ({ idx, points, period }) => {
  const days = PERIOD_DAYS[period]
  const cutoff = days === null ? null : Date.now() - days * 24 * 60 * 60 * 1000
  const slice = points.filter(point => cutoff === null || new Date(point.time).getTime() >= cutoff)
  const first = slice[0]?.value
  const last = slice.length ? slice[slice.length - 1].value : undefined
  const changePct = first && last ? ((last - first) / first) * 100 : 0
  const values = slice.map(point => point.value)
  const high = values.length ? Math.max(...values) : last ?? 0
  const low = values.length ? Math.min(...values) : last ?? 0
  const mean = values.reduce((sum, value) => sum + value, 0) / Math.max(values.length, 1)
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / Math.max(values.length, 1)
  const vol = mean ? (Math.sqrt(variance) / mean) * 100 : 0

  return (
    <Card style={{ padding: '14px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: idx.color, display: 'inline-block' }} />
        <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)' }}>{idx.abbr}</span>
      </div>
      <div className="mono-num" style={{ fontSize: 22, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
        {last == null ? 'n/a' : `${valuePrefix(idx.index_name)}${fmtNum(last)}${valueUnit(idx.index_name)}`}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 12 }}>
        <Badge variant={changePct >= 0 ? 'success' : 'danger'} style={{ fontSize: 11 }}>{fmtPct(changePct)}</Badge>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{period}</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px', fontSize: 11 }}>
        {[
          { label: 'Points', value: slice.length.toLocaleString() },
          { label: 'Volatility', value: `σ ${vol.toFixed(2)}%` },
          { label: 'High', value: fmtNum(high) },
          { label: 'Low', value: fmtNum(low) },
        ].map(({ label, value }) => (
          <React.Fragment key={label}>
            <div style={{ color: 'var(--text-muted)' }}>{label}</div>
            <div className="mono-num" style={{ color: 'var(--text-secondary)', textAlign: 'right' }}>{value}</div>
          </React.Fragment>
        ))}
      </div>
    </Card>
  )
}

export const MacroIndices: React.FC = () => {
  const [period, setPeriod] = useState<Period>('90D')
  const [indices, setIndices] = useState<IndexMeta[]>([])
  const [histories, setHistories] = useState<Record<string, IndexPoint[]>>({})
  const [activeNames, setActiveNames] = useState<string[]>([])
  const [showAnomalies, setShowAnomalies] = useState(false)
  const [showForecast, setShowForecast] = useState(false)
  const [status, setStatus] = useState<'loading' | 'live' | 'error'>('loading')

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const summaries = await apiClient.indices()
        const loadedPairs = await Promise.all(
          summaries.map(async summary => [summary, await apiClient.indexHistory(summary.index_name, { limit: 5000 })] as const),
        )
        const fredPairs = loadedPairs.filter(([, history]) =>
          history.some(point => point.source === 'fred'),
        )
        const nextIndices = fredPairs.map(([summary], i) => ({
          ...summary,
          color: COLORS[i % COLORS.length],
          label: friendlyName(summary.index_name),
          abbr: shortName(summary.index_name),
        }))
        const historyPairs = fredPairs.map(([summary, history]) => [
          summary.index_name,
          history.filter(point => point.source === 'fred'),
        ] as const)
        if (!cancelled) {
          setIndices(nextIndices)
          setHistories(Object.fromEntries(historyPairs))
          setActiveNames(current => current.length ? current.filter(name => nextIndices.some(index => index.index_name === name)) : nextIndices.slice(0, 3).map(index => index.index_name))
          setStatus('live')
        }
      } catch {
        if (!cancelled) setStatus('error')
      }
    }
    load()
    const interval = window.setInterval(load, 60_000)
    return () => {
      cancelled = true
      window.clearInterval(interval)
    }
  }, [])

  const toggleIndex = (name: string) => {
    setActiveNames(prev =>
      prev.includes(name) ? (prev.length > 1 ? prev.filter(x => x !== name) : prev) : [...prev, name],
    )
  }

  const statusBadge = status === 'loading' ? <Badge variant="warning">Loading API</Badge>
    : status === 'error' ? <Badge variant="danger">API Error</Badge>
      : <Badge variant="success">Real API Data</Badge>

  return (
    <div style={{ flex: 1, overflow: 'auto', background: 'var(--bg-base)', padding: '20px' }}>
      <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>Macro Indices</h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>Real macroeconomic time series from FRED</p>
        </div>
        {statusBadge}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <PillTabs value={period} onChange={setPeriod} />
          <div style={{ width: 1, height: 20, background: 'var(--border-subtle)' }} />
          {indices.map(ix => (
            <CheckPill key={ix.index_name} label={ix.abbr} color={ix.color}
              checked={activeNames.includes(ix.index_name)} onChange={() => toggleIndex(ix.index_name)} />
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <ToggleSwitch label="Anomalies" checked={showAnomalies} onChange={setShowAnomalies} />
          <ToggleSwitch label="Forecast" checked={showForecast} onChange={setShowForecast} />
        </div>
      </div>

      {(showAnomalies || showForecast) && (
        <div style={{ marginBottom: 12, color: 'var(--text-muted)', fontSize: 12 }}>
          Forecast and anomaly overlays only appear when backend rows exist for the selected indices.
        </div>
      )}

      <Card style={{ padding: '16px 16px 8px', marginBottom: 16 }}>
        <MacroChart indices={indices} activeNames={activeNames} histories={histories} period={period} />
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 12 }}>
        {indices.map(idx => <IndexStatCard key={idx.index_name} idx={idx} points={histories[idx.index_name] ?? []} period={period} />)}
      </div>
    </div>
  )
}
