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
  if (err) return <div style={{ padding: 24, color: 'tomato' }}>Error: {err}</div>;

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
            background: '#101216',
            border: '1px solid rgba(255,255,255,.08)',
            color: 'var(--fl-white)',
            borderRadius: 12,
            padding: '8px 12px',
            minWidth: 260
          }}
        />
      </div>

      {/* Status filters */}
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
          background: active ? 'var(--fl-purple)' : 'transparent',  // white when active
          color: active ? '#ffffff' : 'var(--fl-purple)',               // black text on active
          border: '1px solid var(--fl-purple)',                      // always visible border
          fontWeight: 600,
          textTransform: 'capitalize',
          cursor: 'pointer',
          transition: 'all 0.15s ease',
        }}
        onMouseEnter={(e) => {
          if (!active) (e.currentTarget.style.background = 'rgba(255,255,255,0.1)');
        }}
        onMouseLeave={(e) => {
          if (!active) (e.currentTarget.style.background = 'transparent');
        }}
      >
        {opt}
      </button>
    );
  })}
</div>

      {filtered.length === 0 ? (
        <div style={{ opacity: .75 }}>No launches match your filters.</div>
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
              style={{ padding: 12, textDecoration: 'none', color: 'inherit', display: 'grid', gap: 8 }}
            >
              <div style={{ fontWeight: 800, color: '#FFB82E' }}>
                {r.name ?? 'Untitled'}{' '}
                <span style={{ opacity: .7 }}>
                  ({r.token_symbol ?? '—'})
                </span>
              </div>

              <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontFamily: 'var(--font-data)' }}>
                <StatusBadge s={r.status} />
                <span style={{ opacity: .7 }}>
                  {r.start_at ? new Date(r.start_at).toLocaleString() : 'TBA'}
                </span>
              </div>

              <div style={{ opacity: .85, fontFamily: 'var(--font-data)' }}>
                Soft {r.soft_cap ?? '—'} • Hard {r.hard_cap ?? '—'}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ s }: { s: Row['status'] }) {
  const styles: Record<string, React.CSSProperties> = {
    active:   { background: 'rgba(46,204,113,.15)', color: '#2ecc71' },
    upcoming: { background: 'rgba(52,152,219,.15)', color: '#3498db' },
    ended:    { background: 'rgba(127,140,141,.15)', color: '#95a5a6' },
    failed:   { background: 'rgba(231,76,60,.15)',  color: '#e74c3c' },
    finalized:{ background: 'rgba(155,89,182,.15)', color: '#9b59b6' },
    created:  { background: 'rgba(241,196,15,.15)', color: '#f1c40f' },
    draft:    { background: 'rgba(241,196,15,.15)', color: '#f1c40f' },
  };
  return (
    <span className="badge" style={{ ...(styles[s] || {}), padding: '2px 8px', borderRadius: 999, textTransform:'capitalize' }}>
      {s}
    </span>
  );
}
