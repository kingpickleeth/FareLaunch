// src/pages/Explore.tsx
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { listExplore } from '../data/launches';

type Row = {
  id: string;
  token_name: string | null;
  token_symbol: string | null;
  status: 'draft'|'created'|'upcoming'|'active'|'ended'|'failed'|'finalized';
  start_at: string | null;
  end_at: string | null;
  soft_cap: string | null;
  hard_cap: string | null;
  logo_url?: string | null;
};

const STATUS_FILTERS = ['all','upcoming','active','finalized','failed'] as const;
type StatusFilter = typeof STATUS_FILTERS[number];

function useDebounced<T>(value: T, ms = 150) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

// Narrow screen helper (<= 675px)
function useIsNarrow(threshold = 675) {
  const [narrow, setNarrow] = useState(
    typeof window !== 'undefined' ? window.innerWidth <= threshold : false
  );
  useEffect(() => {
    const mq = window.matchMedia(`(max-width:${threshold}px)`);
    const onChange = () => setNarrow(mq.matches);
    onChange();
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, [threshold]);
  return narrow;
}

// Pagination bar
function PaginationBar({
  page,
  totalPages,
  onPageChange,
  align = 'right',
}: {
  page: number;
  totalPages: number;
  onPageChange: (p: number) => void;
  align?: 'left' | 'center' | 'right';
}) {
  const containerStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: align === 'center' ? 'center' : align === 'right' ? 'flex-end' : 'flex-start',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  };

  const btnStyle: React.CSSProperties = {
    padding: '6px 10px',
    borderRadius: 10,
    border: '1px solid var(--border)',
    background: 'var(--fl-surface)',
    color: 'var(--text)',
    cursor: 'pointer',
    opacity: 0.9,
    fontWeight: 600,
  };

  const disabledStyle: React.CSSProperties = { ...btnStyle, opacity: 0.4, cursor: 'not-allowed' };

  return (
    <div style={containerStyle}>
      <button
        style={page > 1 ? btnStyle : disabledStyle}
        onClick={() => onPageChange(1)}
        disabled={page <= 1}
        aria-label="First page"
      >
        «
      </button>
      <button
        style={page > 1 ? btnStyle : disabledStyle}
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
        aria-label="Previous page"
      >
        ‹
      </button>

      <span style={{ opacity: 0.8, fontFamily: 'var(--font-data)' }}>
        Page <strong>{page}</strong> of <strong>{totalPages}</strong>
      </span>

      <button
        style={page < totalPages ? btnStyle : disabledStyle}
        onClick={() => onPageChange(page + 1)}
        disabled={page >= totalPages}
        aria-label="Next page"
      >
        ›
      </button>
      <button
        style={page < totalPages ? btnStyle : disabledStyle}
        onClick={() => onPageChange(totalPages)}
        disabled={page >= totalPages}
        aria-label="Last page"
      >
        »
      </button>
    </div>
  );
}

const PAGE_SIZE = 10;

export default function Explore() {
  const [rows, setRows] = useState<Row[]>([]);
  const [q, setQ] = useState('');
  // MULTI-SELECT: keep a Set of selected filters (includes 'all' special)
  const [selected, setSelected] = useState<Set<StatusFilter>>(new Set(['all']));
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string>('');
  const [page, setPage] = useState(1);

  const debouncedQ = useDebounced(q, 150);
  const isNarrow = useIsNarrow(675);

  useEffect(() => {
    setLoading(true);
    listExplore()
      .then((r) => setRows(r as Row[]))
      .catch((e) => setErr(e?.message ?? String(e)))
      .finally(() => setLoading(false));
  }, []);

  // Reset page when search or filters change
  useEffect(() => {
    setPage(1);
  }, [debouncedQ, Array.from(selected).sort().join(',')]);

  // Click handler for chips
  function toggleFilter(opt: StatusFilter) {
    setSelected((prev) => {
      // Clicking "all" => only "all" selected
      if (opt === 'all') return new Set<StatusFilter>(['all']);

      const next = new Set(prev);
      // If "all" was selected, drop it before toggling others
      if (next.has('all')) next.delete('all');

      if (next.has(opt)) next.delete(opt);
      else next.add(opt);

      // If none selected, fall back to "all"
      if (next.size === 0) return new Set<StatusFilter>(['all']);
      return next;
    });
  }

  const filtered = useMemo(() => {
    const s = debouncedQ.trim().toLowerCase();

    return rows.filter((r) => {
      // Status filter
      if (!selected.has('all')) {
        if (!selected.has(r.status as StatusFilter)) return false;
      }
      // Search filter
      if (!s) return true;
      return (
        (r.token_name ?? '').toLowerCase().includes(s) ||
        (r.token_symbol ?? '').toLowerCase().includes(s)
      );
    });
  }, [rows, debouncedQ, selected]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const start = (safePage - 1) * PAGE_SIZE;
  const pageRows = filtered.slice(start, start + PAGE_SIZE);

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

      {/* Status filters + top-right pagination (hidden on narrow) */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {STATUS_FILTERS.map((opt) => {
            const isActive = selected.has(opt);
            return (
              <button
                key={opt}
                onClick={() => toggleFilter(opt)}
                className="buttonfilter"
                style={{
                  padding: '6px 12px',
                  borderRadius: 999,
                  background: isActive
                    ? 'var(--chip-active-bg, var(--fl-purple))'
                    : 'var(--chip-bg, transparent)',
                  color: isActive
                    ? 'var(--chip-active-fg, #ffffff)'
                    : 'var(--chip-fg, var(--fl-purple))',
                  border: '1px solid var(--chip-border, var(--fl-purple))',
                  fontWeight: 600,
                  textTransform: 'capitalize',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  if (!isActive) e.currentTarget.style.background = 'var(--chip-hover-bg, rgba(0,0,0,.08))';
                }}
                onMouseLeave={(e) => {
                  if (!isActive) e.currentTarget.style.background = 'var(--chip-bg, transparent)';
                }}
              >
                {opt}
              </button>
            );
          })}
        </div>

        {/* Top-right pagination (desktop/tablet only) */}
        {!isNarrow && (
          <PaginationBar
            page={safePage}
            totalPages={totalPages}
            onPageChange={setPage}
            align="right"
          />
        )}
      </div>

      {filtered.length === 0 ? (
        <div style={{ color: 'var(--muted)' }}>No launches match your filters.</div>
      ) : (
        <>
          {/* Grid (only 10 per page) */}
          <div
            style={{
              display: 'grid',
              gap: 12,
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              containIntrinsicSize: '1px 120px',
            }}
          >
            {pageRows.map((r) => (
              <Link
                key={r.id}
                to={`/sale/${r.id}`}
                className="card"
                style={{
                  padding: 12,
                  textDecoration: 'none',
                  color: 'inherit',
                  background: 'var(--card-bg, var(--fl-surface))',
                  border: '1px solid var(--card-border, var(--border))',
                  borderRadius: 'var(--radius)',
                  boxShadow: 'var(--shadow)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12
                }}
              >
                {r.logo_url ? (
                  <img
                    src={r.logo_url!}
                    alt=""
                    width={62}
                    height={62}
                    loading="lazy"
                    decoding="async"
                    fetchPriority="low"
                    style={{
                      width: 62,
                      height: 62,
                      borderRadius: 'var(--radius)',
                      objectFit: 'cover',
                      flexShrink: 0
                    }}
                  />
                ) : (
                  <img
                    src="https://dengdefense.xyz/taxi.svg"
                    alt=""
                    width={62}
                    height={62}
                    loading="lazy"
                    decoding="async"
                    fetchPriority="low"
                    style={{
                      width: 62,
                      height: 62,
                      borderRadius: 'var(--radius)',
                      objectFit: 'cover',
                      flexShrink: 0
                    }}
                  />
                )}

                <div style={{ display: 'grid', gap: 4 }}>
                  <div style={{ fontWeight: 800, color: 'var(--fl-gold)' }}>
                    {r.token_name ?? 'Untitled'}{' '}
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
                </div>
              </Link>
            ))}
          </div>

          {/* Bottom pagination (always visible) */}
          <PaginationBar
            page={safePage}
            totalPages={totalPages}
            onPageChange={setPage}
            align="center"
          />
        </>
      )}
    </div>
  );
}

function StatusBadge({ s }: { s: Row['status'] }) {
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
