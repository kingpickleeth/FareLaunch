// src/pages/Explore.tsx
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { listExplore } from '../data/launches';
import { createPublicClient, http, formatUnits, defineChain } from 'viem';

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
  raised?: string | number | null;      // optional DB fallback
  pool_address?: string | null;         // 👈 used for on-chain reads
};

const STATUS_FILTERS = ['all','upcoming','active','finalized','failed'] as const;
type StatusFilter = typeof STATUS_FILTERS[number];

const PAGE_SIZE = 10;

// ---- Chain/env wiring (ApeChain) ----
const RPC_URL = import.meta.env.VITE_APECHAIN_RPC as string | undefined;
const CHAIN_ID = Number(import.meta.env.VITE_APECHAIN_ID ?? 33139);
const CHAIN_NAME = (import.meta.env.VITE_APECHAIN_NAME as string) || 'ApeChain';
const NATIVE_SYMBOL = (import.meta.env.VITE_APECHAIN_SYMBOL as string) || 'APE';
const EXPLORER = (import.meta.env.VITE_APECHAIN_EXPLORER as string) || '';
const DECIMALS = Number(import.meta.env.VITE_APECHAIN_DECIMALS ?? 18);

const apeChain = defineChain({
  id: CHAIN_ID,
  name: CHAIN_NAME,
  nativeCurrency: { name: NATIVE_SYMBOL, symbol: NATIVE_SYMBOL, decimals: DECIMALS },
  rpcUrls: { default: { http: [RPC_URL || ''] }, public: { http: [RPC_URL || ''] } },
  blockExplorers: EXPLORER ? { default: { name: 'Explorer', url: EXPLORER } } : undefined,
});

const client = RPC_URL
  ? createPublicClient({ chain: apeChain, transport: http(RPC_URL) })
  : null;

// Pool ABI: function totalRaised() view returns (uint256)
const POOL_ABI = [
  { type: 'function', name: 'totalRaised', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] }
] as const;

// ---------- hooks/helpers ----------
function useDebounced<T>(value: T, ms = 150) {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return v;
}

function useIsNarrow(threshold = 675) {
  const [narrow, setNarrow] = useState(typeof window !== 'undefined' ? window.innerWidth <= threshold : false);
  useEffect(() => {
    const mq = window.matchMedia(`(max-width:${threshold}px)`);
    const onChange = () => setNarrow(mq.matches);
    onChange(); mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, [threshold]);
  return narrow;
}

function toNumber(v: unknown): number {
  if (v == null) return 0;
  if (typeof v === 'number') return isFinite(v) ? v : 0;
  const s = String(v).replace(/[_,\s]/g, '');
  const n = parseFloat(s);
  return isFinite(n) ? n : 0;
}
function fmtNum(v: unknown): string {
  const n = toNumber(v);
  return n.toLocaleString();
}
function fmtWhen(d: string | null, fallback = 'TBA'): string {
  if (!d) return fallback;
  try {
    return new Date(d).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch { return fallback; }
}
function getHard(r: Row): number {
  return toNumber(r.hard_cap);
}

function ProgressBar({ value }: { value: number }) {
  return (
    <div style={{ width: '100%', height: 8, background: 'var(--track, var(--card-border, rgba(255,255,255,.15)))', borderRadius: 999, overflow: 'hidden' }}>
      <div style={{ width: `${value}%`, height: '100%', background: 'var(--fl-purple)', transition: 'width .25s ease' }}/>
    </div>
  );
}

function PaginationBar({
  page, totalPages, onPageChange, align = 'right',
}: { page: number; totalPages: number; onPageChange: (p: number) => void; align?: 'left'|'center'|'right'; }) {
  const base: React.CSSProperties = { padding: '6px 10px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--fl-surface)', color: 'var(--text)', cursor: 'pointer', opacity: 0.9, fontWeight: 600 };
  const disabled: React.CSSProperties = { ...base, opacity: 0.4, cursor: 'not-allowed' };
  return (
    <div style={{ display: 'flex', justifyContent: align === 'center' ? 'center' : align === 'right' ? 'flex-end' : 'flex-start', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      <button style={page > 1 ? base : disabled} onClick={() => onPageChange(1)} disabled={page <= 1} aria-label="First page">«</button>
      <button style={page > 1 ? base : disabled} onClick={() => onPageChange(page - 1)} disabled={page <= 1} aria-label="Previous page">‹</button>
      <span style={{ opacity: 0.8, fontFamily: 'var(--font-data)' }}>Page <strong>{page}</strong> of <strong>{totalPages}</strong></span>
      <button style={page < totalPages ? base : disabled} onClick={() => onPageChange(page + 1)} disabled={page >= totalPages} aria-label="Next page">›</button>
      <button style={page < totalPages ? base : disabled} onClick={() => onPageChange(totalPages)} disabled={page >= totalPages} aria-label="Last page">»</button>
    </div>
  );
}

export default function Explore() {
  const [rows, setRows] = useState<Row[]>([]);
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState<Set<StatusFilter>>(new Set(['all']));
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string>('');
  const [page, setPage] = useState(1);

  // on-chain cache: pool_address -> totalRaised (raw bigint)
  const [raisedMap, setRaisedMap] = useState<Record<string, bigint>>({});

  const debouncedQ = useDebounced(q, 150);
  const isNarrow = useIsNarrow(675);

  useEffect(() => {
    setLoading(true);
    listExplore()
      .then((r) => setRows(r as Row[]))
      .catch((e) => setErr(e?.message ?? String(e)))
      .finally(() => setLoading(false));
  }, []);

  const selectedKey = useMemo(() => (selected.has('all') ? 'all' : [...selected].sort().join(',')), [selected]);
  useEffect(() => { setPage(1); }, [debouncedQ, selectedKey]);

  function toggleFilter(opt: StatusFilter) {
    setSelected((prev) => {
      if (opt === 'all') return new Set<StatusFilter>(['all']);
      const next = new Set(prev);
      if (next.has('all')) next.delete('all');
      next.has(opt) ? next.delete(opt) : next.add(opt);
      if (next.size === 0) return new Set<StatusFilter>(['all']);
      return next;
    });
  }

  const filtered = useMemo(() => {
    const s = debouncedQ.trim().toLowerCase();
    return rows.filter((r) => {
      if (!selected.has('all') && !selected.has(r.status as StatusFilter)) return false;
      if (!s) return true;
      return (r.token_name ?? '').toLowerCase().includes(s) || (r.token_symbol ?? '').toLowerCase().includes(s);
    });
  }, [rows, debouncedQ, selected]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const start = (safePage - 1) * PAGE_SIZE;
  const pageRows = filtered.slice(start, start + PAGE_SIZE);

  // ---------- On-chain reads for current page ----------
  const pagePoolKey = useMemo(
    () => [...new Set(pageRows.map(r => r.pool_address || ''))].join(','),
    [pageRows]
  );

  useEffect(() => {
    if (!client) return; // no RPC configured
    const pools = [...new Set(pageRows
      .map(r => r.pool_address)
      .filter((a): a is string => !!a && /^0x[0-9a-fA-F]{40}$/.test(a)))];
    if (!pools.length) return;

    let cancelled = false;
    (async () => {
      try {
        const entries = await Promise.all(pools.map(async (address) => {
          try {
            const res = await client.readContract({
              address: address as `0x${string}`,
              abi: POOL_ABI,
              functionName: 'totalRaised',
            });
            return [address, res as bigint] as const;
          } catch {
            return null;
          }
        }));
        if (!cancelled) {
          const next: Record<string, bigint> = {};
          for (const e of entries) if (e) next[e[0]] = e[1];
          if (Object.keys(next).length) setRaisedMap(prev => ({ ...prev, ...next }));
        }
      } catch { /* ignore; UI will fallback */ }
    })();

    return () => { cancelled = true; };
  }, [client, pagePoolKey]);

  // Prefer on-chain raised, fallback to DB
  function getRaisedLive(r: Row): number {
    if (r.pool_address && raisedMap[r.pool_address]) {
      const raw = raisedMap[r.pool_address];
      return Number(formatUnits(raw, DECIMALS));
    }
    return toNumber(r.raised);
  }

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
          style={{ background: 'var(--input-bg, var(--fl-surface))', border: '1px solid var(--input-border, var(--border))', color: 'var(--text)', borderRadius: 12, padding: '8px 12px', minWidth: 260, boxShadow: 'var(--input-shadow, none)', outline: 'none' }}
        />
      </div>

      {/* Filters + top-right pagination (hidden on narrow) */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {(['all','upcoming','active','finalized','failed'] as StatusFilter[]).map((opt) => {
            const isActive = selected.has(opt);
            return (
              <button
                key={opt}
                onClick={() => toggleFilter(opt)}
                className="buttonfilter"
                style={{
                  padding: '6px 12px',
                  borderRadius: 999,
                  background: isActive ? 'var(--chip-active-bg, var(--fl-purple))' : 'var(--chip-bg, transparent)',
                  color: isActive ? 'var(--chip-active-fg, #ffffff)' : 'var(--chip-fg, var(--fl-purple))',
                  border: '1px solid var(--chip-border, var(--fl-purple))',
                  fontWeight: 600, textTransform: 'capitalize', cursor: 'pointer', transition: 'all 0.15s ease'
                }}
                onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = 'var(--chip-hover-bg, rgba(0,0,0,.08))'; }}
                onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = 'var(--chip-bg, transparent)'; }}
              >
                {opt}
              </button>
            );
          })}
        </div>

        {!isNarrow && (
          <PaginationBar page={safePage} totalPages={totalPages} onPageChange={setPage} align="right" />
        )}
      </div>

      {filtered.length === 0 ? (
        <div style={{ color: 'var(--muted)' }}>No launches match your filters.</div>
      ) : (
        <>
          {/* Grid (only 10 per page) */}
          <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', containIntrinsicSize: '1px 120px' }}>
            {pageRows.map((r) => {
              const isActive   = r.status === 'active';
              const isUpcoming = r.status === 'upcoming';
              const isFinal    = r.status === 'finalized';
              const isFailed   = r.status === 'failed';
              const isEnded    = r.status === 'ended';

              const dateLabel =
                isActive ? `Ends: ${fmtWhen(r.end_at)}`
                : isUpcoming ? `Starts: ${fmtWhen(r.start_at)}`
                : (isFinal || isFailed || isEnded) ? `Ended: ${fmtWhen(r.end_at || r.start_at)}`
                : fmtWhen(r.start_at);

              const raised = getRaisedLive(r);
              const hard   = getHard(r);
              const percent = hard > 0 ? Math.round(Math.max(0, Math.min(100, (raised / hard) * 100))) : 0;

              return (
                <Link key={r.id} to={`/sale/${r.id}`} className="card"
                  style={{ padding: 12, textDecoration: 'none', color: 'inherit', background: 'var(--card-bg, var(--fl-surface))', border: '1px solid var(--card-border, var(--border))', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)', display: 'flex', alignItems: 'center', gap: 12 }}
                >
                  {r.logo_url ? (
                    <img
                      src={r.logo_url!}
                      onError={(e) => { (e.currentTarget as HTMLImageElement).src = 'https://dengdefense.xyz/taxi.svg'; }}
                      alt={`${r.token_symbol ?? r.token_name ?? 'Token'} logo`}
                      width={62} height={62} loading="lazy" decoding="async" fetchPriority="low"
                      style={{ width: 62, height: 62, borderRadius: 'var(--radius)', objectFit: 'cover', flexShrink: 0 }}
                    />
                  ) : (
                    <img
                      src="https://dengdefense.xyz/taxi.svg" alt="" width={62} height={62} loading="lazy" decoding="async" fetchPriority="low"
                      style={{ width: 62, height: 62, borderRadius: 'var(--radius)', objectFit: 'cover', flexShrink: 0 }}
                    />
                  )}

                  <div style={{ display: 'grid', gap: 4, width: '100%' }}>
                    {/* Title w/ inline badge */}
                    <div style={{ fontWeight: 800, color: 'var(--fl-gold)', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                      {r.token_name ?? 'Untitled'}
                      <span style={{ color: 'var(--muted)' }}>({r.token_symbol ?? '—'})</span>
                      <StatusBadge s={r.status} />
                    </div>

                    {/* Date label */}
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontFamily: 'var(--font-data)' }}>
                      <span style={{ color: 'var(--muted)' }}>{dateLabel}</span>
                    </div>

                    {/* Bottom block */}
                    <div style={{ fontFamily: 'var(--font-data)' }}>
                      {isActive ? (
                        <div style={{ display: 'grid', gap: 6 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--muted)' }}>
                            <span>Raised: {fmtNum(raised)} $WAPE</span>
                            <span>{hard > 0 ? `${percent}%` : '—'}</span>
                          </div>
                          <ProgressBar value={percent} />
                        </div>
                      ) : isUpcoming ? (
                        <div style={{ color: 'var(--muted)' }}>
                          Soft Cap: {r.soft_cap ?? '—'} • Hard Cap: {r.hard_cap ?? '—'}
                        </div>
                      ) : isFinal ? (
                        <div style={{ color: 'var(--muted)' }}>
                          Raised: {fmtNum(raised)} $WAPE • Hard: {fmtNum(hard)}
                        </div>
                      ) : isFailed ? (
                        <div style={{ color: 'var(--muted)' }}>
                          Raised: {fmtNum(raised)} {NATIVE_SYMBOL} {hard > 0 ? `(${percent}%)` : ''}
                        </div>
                      ) : isEnded ? (
                        <div style={{ color: 'var(--muted)' }}>
                          Raised: {fmtNum(raised)} {NATIVE_SYMBOL} • Hard: {fmtNum(hard)}
                        </div>
                      ) : (
                        <div style={{ color: 'var(--muted)' }}>
                          Soft Cap: {r.soft_cap ?? '—'} • Hard Cap: {r.hard_cap ?? '—'}
                        </div>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>

          {/* Bottom pagination (always visible) */}
          <PaginationBar page={safePage} totalPages={totalPages} onPageChange={setPage} align="center" />
        </>
      )}
    </div>
  );
}

function StatusBadge({ s }: { s: Row['status'] }) {
  const styles: Record<string, React.CSSProperties> = {
    active: { background: 'var(--badge-success-bg, rgba(46,204,113,.15))', color: 'var(--success, #2ecc71)', border: '1px solid var(--badge-success-border, rgba(46,204,113,.35))' },
    upcoming:{ background: 'var(--badge-info-bg, rgba(52,152,219,.15))', color: 'var(--info, #3498db)', border: '1px solid var(--badge-info-border, rgba(52,152,219,.35))' },
    ended:  { background: 'var(--badge-muted-bg, rgba(127,140,141,.15))', color: 'var(--muted-fg, #95a5a6)', border: '1px solid var(--badge-muted-border, rgba(127,140,141,.35))' },
    failed: { background: 'var(--badge-danger-bg, rgba(231,76,60,.15))', color: 'var(--fl-danger, #e74c3c)', border: '1px solid var(--badge-danger-border, rgba(231,76,60,.35))' },
    finalized:{ background: 'var(--badge-purple-bg, rgba(155,89,182,.15))', color: 'var(--fl-purple, #9b59b6)', border: '1px solid var(--badge-purple-border, rgba(155,89,182,.35))' },
    created:{ background: 'var(--badge-warning-bg, rgba(241,196,15,.15))', color: 'var(--warning, #f1c40f)', border: '1px solid var(--badge-warning-border, rgba(241,196,15,.35))' },
    draft:  { background: 'var(--badge-warning-bg, rgba(241,196,15,.15))', color: 'var(--warning, #f1c40f)', border: '1px solid var(--badge-warning-border, rgba(241,196,15,.35))' },
  };
  return (
    <span className="badge" style={{ ...(styles[s] || {}), padding: '2px 8px', borderRadius: 999, textTransform:'capitalize', fontWeight: 700, fontFamily: 'var(--font-data)' }}>
      {s}
    </span>
  );
}
