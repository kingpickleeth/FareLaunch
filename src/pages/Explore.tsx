// src/pages/Explore.tsx
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { listExplore } from '../data/launches';

type Row = {
  id: string;
  name: string | null;
  token_symbol: string | null;
  status: 'draft'|'created'|'upcoming'|'active'|'ended'|'failed'|'finalized';
  start_at: string | null;
  end_at: string | null;
  soft_cap: string | null;
  hard_cap: string | null;
};

const STATUS_FILTERS = ['all','upcoming','active','finalized','failed'] as const;
type StatusFilter = typeof STATUS_FILTERS[number];

export default function Explore() {
  const [rows, setRows] = useState<Row[]>([]);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string>('');

  useEffect(() => {
    setLoading(true);
    listExplore()
      .then((r) => setRows(r as Row[])) // already excludes drafts
      .catch((e) => setErr(e?.message ?? String(e)))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return rows.filter(r => {
      if (status !== 'all' && r.status !== status) return false;
      if (!s) return true;
      return (r.name ?? '').toLowerCase().includes(s)
          || (r.token_symbol ?? '').toLowerCase().includes(s);
    });
  }, [rows, q, status]);

  if (loading) return <div style={{ padding: 24 }}>Loading…</div>;
  if (err) return <div style={{ padding: 24, color: 'var(--fl-danger)' }}>Error: {err}</div>;

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {/* Header with search */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'space-between', flexWrap:'wrap' }}>
        <div className="h2">Explore</div>
        <input
          placeholder="Search name or symbol"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{
            background: 'var(--input-bg, var(--fl-surface))',
            border: '1px solid var(--input-border, var(--border))',
            color: 'var(--text)',
            borderRadius: 12,
            padding: '8px 12px',
            minWidth: 260,
            boxShadow: 'var(--input-shadow, none)',
            outline: 'none',
          }}
        />
      </div>

      {/* Status filters */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {STATUS_FILTERS.map((opt) => {
          const active = status === opt;
          return (
            <button
              key={opt}
              onClick={() => setStatus(opt)}
              className="buttonfilter"
              style={{
                padding: '6px 12px',
                borderRadius: 999,
                background: active
                  ? 'var(--chip-active-bg, var(--fl-purple))'
                  : 'var(--chip-bg, transparent)',
                color: active
                  ? 'var(--chip-active-fg, #ffffff)'
                  : 'var(--chip-fg, var(--fl-purple))',
                border: '1px solid var(--chip-border, var(--fl-purple))',
                fontWeight: 600,
                textTransform: 'capitalize',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                if (!active) e.currentTarget.style.background = 'var(--chip-hover-bg, rgba(0,0,0,.08))';
              }}
              onMouseLeave={(e) => {
                if (!active) e.currentTarget.style.background = 'var(--chip-bg, transparent)';
              }}
            >
              {opt}
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <div style={{ color: 'var(--muted)' }}>No launches match your filters.</div>
      ) : (
        <div style={{
          display: 'grid',
          gap: 12,
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))'
        }}>
          {filtered.map((r) => (
            <Link
              key={r.id}
              to={`/sale/${r.id}`}
              className="card"
              style={{
                padding: 12,
                textDecoration: 'none',
                color: 'inherit',
                display: 'grid',
                gap: 8,
                background: 'var(--card-bg, var(--fl-surface))',
                border: '1px solid var(--card-border, var(--border))',
                borderRadius: 'var(--radius)',
                boxShadow: 'var(--shadow)'
              }}
            >
              <div style={{ fontWeight: 800, color: 'var(--fl-gold)' }}>
                {r.name ?? 'Untitled'}{' '}
                <span style={{ color: 'var(--muted)' }}>
                  ({r.token_symbol ?? '—'})
                </span>
              </div>

              <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontFamily: 'var(--font-data)' }}>
                <StatusBadge s={r.status} />
                <span style={{ color: 'var(--muted)' }}>
                  {r.start_at
                    ? new Date(r.start_at).toLocaleString([], {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })
                    : 'TBA'}
                </span>
              </div>

              <div style={{ color: 'var(--muted)', fontFamily: 'var(--font-data)' }}>
                Soft Cap: {r.soft_cap ?? '—'} • Hard Cap: {r.hard_cap ?? '—'}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ s }: { s: Row['status'] }) {
  // Theme-driven semantic colors with safe fallbacks
  const styles: Record<string, React.CSSProperties> = {
    active: {
      background: 'var(--badge-success-bg, rgba(46,204,113,.15))',
      color: 'var(--success, #2ecc71)',
      border: '1px solid var(--badge-success-border, rgba(46,204,113,.35))'
    },
    upcoming: {
      background: 'var(--badge-info-bg, rgba(52,152,219,.15))',
      color: 'var(--info, #3498db)',
      border: '1px solid var(--badge-info-border, rgba(52,152,219,.35))'
    },
    ended: {
      background: 'var(--badge-muted-bg, rgba(127,140,141,.15))',
      color: 'var(--muted-fg, #95a5a6)',
      border: '1px solid var(--badge-muted-border, rgba(127,140,141,.35))'
    },
    failed: {
      background: 'var(--badge-danger-bg, rgba(231,76,60,.15))',
      color: 'var(--fl-danger, #e74c3c)',
      border: '1px solid var(--badge-danger-border, rgba(231,76,60,.35))'
    },
    finalized: {
      background: 'var(--badge-purple-bg, rgba(155,89,182,.15))',
      color: 'var(--fl-purple, #9b59b6)',
      border: '1px solid var(--badge-purple-border, rgba(155,89,182,.35))'
    },
    created: {
      background: 'var(--badge-warning-bg, rgba(241,196,15,.15))',
      color: 'var(--warning, #f1c40f)',
      border: '1px solid var(--badge-warning-border, rgba(241,196,15,.35))'
    },
    draft: {
      background: 'var(--badge-warning-bg, rgba(241,196,15,.15))',
      color: 'var(--warning, #f1c40f)',
      border: '1px solid var(--badge-warning-border, rgba(241,196,15,.35))'
    },
  };
  return (
    <span
      className="badge"
      style={{
        ...(styles[s] || {}),
        padding: '2px 8px',
        borderRadius: 999,
        textTransform:'capitalize',
        fontWeight: 700,
        fontFamily: 'var(--font-data)'
      }}
    >
      {s}
    </span>
  );
}
