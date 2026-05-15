import React from 'react'
import { useQuery, useIsFetching } from '@tanstack/react-query'
import { apiClient, API_BASE_URL } from '../../api/client'
import { queryKeys } from '../../api/queries'
import { Icons } from '../icons'
import { StatusDot } from '../StatusDot'
import type { PageId } from './Sidebar'

const PAGE_META: Record<PageId, { parent: string; title: string }> = {
  dashboard: { parent: 'Dashboard', title: 'Overview' },
  indices: { parent: 'Analytics', title: 'Macro Indices' },
  vessels: { parent: 'Tracking', title: 'Vessel Map' },
  ports: { parent: 'Infrastructure', title: 'Ports' },
  insights: { parent: 'Intelligence', title: 'Insights Hub' },
}

interface HeaderProps {
  theme: 'dark' | 'light'
  onThemeToggle: () => void
  page: PageId
}

export const Header: React.FC<HeaderProps> = ({ theme, onThemeToggle, page }) => {
  const health = useQuery({
    queryKey: queryKeys.health,
    queryFn: ({ signal }) => apiClient.health({ signal }),
    staleTime: 30_000,
    refetchInterval: 60_000,
  })
  const fetching = useIsFetching()
  const status = health.isError ? 'danger' : health.isLoading ? 'warning' : 'success'
  const statusLabel = health.isError ? 'API offline' : fetching > 0 ? 'Refreshing' : 'API live'

  return (
    <header style={{ height: 48, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px', background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
        <span style={{ color: 'var(--text-muted)' }}>{PAGE_META[page].parent}</span>
        <Icons.ChevronRight size={14} style={{ color: 'var(--text-muted)' } as React.CSSProperties} />
        <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{PAGE_META[page].title}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: 30, padding: '0 10px', borderRadius: 15, background: status === 'danger' ? 'var(--danger-muted)' : status === 'warning' ? 'var(--warning-muted)' : 'var(--success-muted)' }}>
          <StatusDot status={status} pulse={status !== 'danger'} size={6} />
          <span style={{ fontSize: 11, fontWeight: 500, color: status === 'danger' ? 'var(--danger)' : status === 'warning' ? 'var(--warning)' : 'var(--success)' }}>{statusLabel}</span>
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          Base <span className="mono-num">{API_BASE_URL.replace(/^https?:\/\//, '')}</span>
        </div>
        <button aria-label="Toggle theme" style={{ width: 32, height: 32, borderRadius: 6, border: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-muted)', background: 'transparent' }} onClick={onThemeToggle}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)'; (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)' }}>
          {theme === 'dark' ? <Icons.Sun size={16} /> : <Icons.Moon size={16} />}
        </button>
      </div>
    </header>
  )
}
