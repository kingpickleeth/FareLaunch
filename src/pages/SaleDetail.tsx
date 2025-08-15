// src/pages/SaleDetail.tsx
import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getLaunch } from '../data/launches';
import { salePhase, countdown } from '../utils/time';
import AllowlistCheck from '../components/AllowlistCheck';
import { supabase } from '../lib/supabase';
import { formatNumber } from '../utils/format';
import { useAccount, usePublicClient } from 'wagmi';
import BuyModal from '../components/BuyModal';
import { decodeEventLog, formatUnits, type Hex, type Log } from 'viem';
import {
  launchpadFactoryAbi,
  LAUNCHPAD_FACTORY,
  presalePoolAbi,
  QUOTE_DECIMALS,
} from '../lib/contracts';

type AnyRow = Record<string, any>;

/* ──────────────────────────────────────────────────────────────
   Page-scoped CSS
   ────────────────────────────────────────────────────────────── */
function ensureLocalCSS() {
  const id = 'sale-detail-local-css';
  if (typeof document === 'undefined' || document.getElementById(id)) return;
  const s = document.createElement('style');
  s.id = id;
  s.textContent = `
    .sale-grid{
      display:grid;
      grid-template-columns: minmax(0,1fr) minmax(280px,420px);
      gap:16px;
      align-items:start;
    }
    @media (max-width: 900px){
      .sale-grid{ grid-template-columns: 1fr; }
    }

    .sale-card { padding: 12px; display: grid; gap: 10px; }
    .meta-grid{ display:grid; grid-template-columns: repeat(2,minmax(140px,1fr)); gap:8px }
    @media (max-width: 520px){
      .meta-grid{ grid-template-columns: 1fr; }
    }

    .progress-outer{
      position:relative; height:6px; border-radius:999px;
      background: color-mix(in srgb, var(--fl-purple) 10%, #d9d9e1);
      overflow:hidden;
    }
    .progress-inner{
      height:100%; border-radius:999px; background: var(--primary, #2f66ff);
      transition: width .3s ease;
    }

    .countdown-wrap{ display:flex; justify-content:flex-start; } /* left-justified */
    .countdown-pill{
      display:inline-flex; align-items:center; gap:8px;
      font-weight:700; padding:6px 12px; border-radius:999px;
      background: var(--primary, #2f66ff); color:#fff;
      box-shadow: 0 6px 18px rgba(47,102,255,.25);
    }
    .countdown-pill svg{ flex:0 0 auto; }

    .break-anywhere{ word-break: break-word; overflow-wrap: anywhere; }
    .sale-logo{ width:56px; height:56px; border-radius:14px; object-fit:cover;
      border:1px solid var(--card-border); background: var(--card-bg); }
    .sale-logo.placeholder{ background: var(--input-bg); }

    /* Buttons row = thirds */
    .sale-actions{
      display:grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap:8px; align-items:center;
    }
    .sale-actions .back { grid-column:1; }
    .sale-actions .spacer { grid-column:2; }
    .sale-actions .buy { grid-column:3; }
    @media (max-width: 520px){
      .sale-actions{ grid-template-columns: 1fr; }
      .sale-actions .back,
      .sale-actions .spacer,
      .sale-actions .buy { grid-column:auto; }
      .sale-actions .spacer{ display:none; }
    }

    /* Donut tooltip */
    .donut-wrap{ position:relative; }
    .donut-tip{
      position:fixed; z-index:10;
      background: var(--card-bg);
      color: var(--text);
      border: 1px solid var(--card-border);
      border-radius: 10px;
      padding: 8px 10px;
      font: 600 12px var(--font-sans, Inter, system-ui, sans-serif);
      box-shadow: 0 10px 22px rgba(0,0,0,.18);
      pointer-events:none;
      white-space: nowrap;
    }
  `;
  document.head.appendChild(s);
}

/* ──────────────────────────────────────────────────────────────
   Small icon buttons
   ────────────────────────────────────────────────────────────── */
function IconWrap({
  children,
  disabled,
  href,
  label,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  href?: string;
  label: string;
}) {
  const common: React.CSSProperties = {
    width: 36,
    height: 36,
    display: 'inline-grid',
    placeItems: 'center',
    borderRadius: 10,
    border: '1px solid var(--card-border)',
    background: 'var(--fl-purple)',
    boxShadow: '0 4px 10px rgba(0,0,0,.18)',
    color: '#fff',
    opacity: disabled ? 0.55 : 1,
    cursor: disabled ? 'not-allowed' : 'pointer',
    transition: 'transform .12s ease, box-shadow .12s ease',
  };

  if (disabled || !href) {
    return (
      <span title={label} aria-label={label} style={common}>
        {children}
      </span>
    );
  }
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      title={label}
      aria-label={label}
      style={{ ...common, textDecoration: 'none' }}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLAnchorElement;
        el.style.transform = 'translateY(-2px)';
        el.style.boxShadow = '0 8px 16px rgba(0,0,0,.22)';
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLAnchorElement;
        el.style.transform = 'translateY(0)';
        el.style.boxShadow = '0 4px 10px rgba(0,0,0,.15)';
      }}
    >
      {children}
    </a>
  );
}
const GlobeIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
    <path d="M12 21c4.97 0 9-4.03 9-9s-4.03-9-9-9-9 4.03-9 9 4.03 9 9 9Z" stroke="currentColor" strokeWidth="1.7" />
    <path d="M3 12h18M12 3c2.5 2.9 3.75 6 3.75 9S14.5 20.1 12 21m0-18C9.5 5.9 8.25 9 8.25 12S9.5 18.1 12 21" stroke="currentColor" strokeWidth="1.7" />
  </svg>
);
const TwitterIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M18.244 3H21l-6.46 7.383L22 21h-6.828l-4.31-5.4L5.9 21H3.142l6.905-7.896L2 3h6.914l3.9 4.973L18.244 3Zm-1.195 16.2h1.262L7.065 4.74H5.74L17.049 19.2Z" />
  </svg>
);
const TelegramIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M9.036 15.39 8.87 19.5c.442 0 .635-.19.865-.418l2.078-1.993 4.307 3.158c.79.434 1.352.205 1.568-.73l2.84-12.915h.001c.252-1.106-.4-1.536-1.167-1.266L3.54 9.7c-1.13.408-1.113.994-.191 1.254l4.412 1.224 10.235-6.46c.48-.292.915-.13.556.162" />
  </svg>
);

/* ──────────────────────────────────────────────────────────────
   Helpers
   ────────────────────────────────────────────────────────────── */
function normalizeWebsite(u?: string | null): string | undefined {
  if (!u) return;
  const w = String(u).trim();
  if (!w) return;
  return /^https?:\/\//i.test(w) ? w : `https://${w}`;
}
function normalizeTwitter(t?: string | null): string | undefined {
  if (!t) return;
  let h = String(t).trim();
  if (!h) return;
  if (h.startsWith('@')) h = h.slice(1);
  if (/^https?:\/\//i.test(h)) return h;
  return `https://x.com/${h}`;
}
function toNum(v: unknown): number {
  if (v === null || v === undefined) return NaN;
  const n = Number(String(v).replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : NaN;
}
const fmt = (n: number) => (Number.isFinite(n) ? n.toLocaleString() : '—');

/* ──────────────────────────────────────────────────────────────
   Dependency-free SVG Donut with hover + tooltip
   ────────────────────────────────────────────────────────────── */
type Slice = { label: string; value: number; color: string };
function Donut({
  slices,
  size = 260,
  thickness = 32,
  centerTitle,
  centerValue,
  centerSub,
  tokenSymbol,
}: {
  slices: Slice[];
  size?: number;
  thickness?: number;
  centerTitle?: string;
  centerValue?: string;
  centerSub?: string;
  tokenSymbol?: string;
}) {
  const [hover, setHover] = useState<{ i: number; x: number; y: number } | null>(null);

  const total = Math.max(0, slices.reduce((a, s) => a + Math.max(0, s.value), 0));
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  let offset = 0;

  const tip = hover ? (
    <div className="donut-tip" style={{ left: hover.x + 12, top: hover.y + 12 }}>
      {slices[hover.i]?.label}: {fmt(slices[hover.i]?.value)} {tokenSymbol || ''}
    </div>
  ) : null;

  return (
    <div className="donut-wrap" style={{ display: 'grid', gap: 10, placeItems: 'center' }}>
      {tip}
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        onMouseLeave={() => setHover(null)}
      >
        <g transform={`translate(${size / 2}, ${size / 2}) rotate(-90)`}>
          <circle r={r} cx={0} cy={0} fill="none" stroke="var(--card-border)" strokeWidth={thickness} />
          {slices.map((s, i) => {
            const len = total > 0 ? (s.value / total) * c : 0;
            const dash = `${len} ${c - len}`;
            const active = hover?.i === i;
            const faded = hover && !active;
            const el = (
              <circle
                key={i}
                r={r}
                cx={0}
                cy={0}
                fill="none"
                stroke={s.color}
                strokeWidth={active ? thickness + 2 : thickness}
                strokeLinecap="butt"
                strokeDasharray={dash}
                strokeDashoffset={-offset}
                style={{ opacity: faded ? 0.35 : 1, cursor: 'pointer', transition: 'opacity .12s ease, stroke-width .12s ease' }}
                onMouseEnter={(e) => setHover({ i, x: e.clientX, y: e.clientY })}
                onMouseMove={(e) => setHover({ i, x: e.clientX, y: e.clientY })}
              />
            );
            offset += len;
            return el;
          })}
        </g>

        {/* center text */}
        <g transform={`translate(${size / 2}, ${size / 2})`} style={{ textAnchor: 'middle', dominantBaseline: 'middle' }}>
          {centerTitle && (
            <text y={-8} style={{ font: '600 14px var(--font-sans, Inter, system-ui, sans-serif)', fill: 'var(--text)' }}>
              {centerTitle}
            </text>
          )}
          {centerValue && (
            <text y={14} style={{ font: '700 18px var(--font-sans, Inter, system-ui, sans-serif)', fill: 'var(--text)' }}>
              {centerValue}
            </text>
          )}
          {centerSub && (
            <text y={34} style={{ font: '600 12px var(--font-sans, Inter, system-ui, sans-serif)', fill: 'var(--text)' }}>
              {centerSub}
            </text>
          )}
        </g>
      </svg>

      {/* legend */}
      <div style={{ display: 'grid', gap: 6, width: '100%' }}>
        {slices.map((s, i) => {
          const pct = total > 0 ? (s.value / total) * 100 : 0;
          return (
            <div
              key={i}
              style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'var(--font-data)', cursor: 'default' }}
              onMouseEnter={(e) => setHover({ i, x: (e as any).clientX, y: (e as any).clientY })}
              onMouseLeave={() => setHover(null)}
            >
              <span style={{ width: 10, height: 10, borderRadius: 2, background: s.color, border: '1px solid rgba(0,0,0,.1)' }} />
              <span style={{ flex: 1 }}>{s.label}</span>
              <span style={{ opacity: 0.8 }}>{pct.toFixed(1)}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
   Countdown pill with circular progress
   ────────────────────────────────────────────────────────────── */
function CountdownPill({
  label,
  d, h, m, s,
  progress, // 0..1
}: { label: string; d: number; h: number; m: number; s: number; progress: number }) {
  const R = 7;
  const C = 2 * Math.PI * R;
  const len = Math.max(0, Math.min(1, progress)) * C;

  return (
    <div className="countdown-wrap">
      <span className="countdown-pill">
        <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
          <circle cx="9" cy="9" r={R} fill="none" stroke="rgba(255,255,255,.35)" strokeWidth="2" />
          <circle
            cx="9" cy="9" r={R} fill="none"
            stroke="#fff" strokeWidth="2" strokeLinecap="round"
            strokeDasharray={`${len} ${C - len}`} strokeDashoffset="0"
            transform="rotate(-90 9 9)"
          />
        </svg>
        {label}: {d}d {h}h {m}m {s}s
      </span>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
   Page
   ────────────────────────────────────────────────────────────── */
type Contribution = { address: string; amount: number; created_at: string; username?: string | null };

export default function SaleDetail() {
  ensureLocalCSS();

  const { id } = useParams();
  const [row, setRow] = useState<AnyRow | null>(null);
  const [err, setErr] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const { address, isConnected } = useAccount();
  const [showBuy, setShowBuy] = useState(false);
  const [allowlisted, setAllowlisted] = useState<boolean>(true);
  const publicClient = usePublicClient();
  const [checkingAllowlist, setCheckingAllowlist] = useState<boolean>(false);

  const [chain, setChain] = useState<{
    softCap?: bigint;
    hardCap?: bigint;
    raised?: bigint;
    userContrib?: bigint;
    lpPctBps?: number;
    platformFeeBps?: number;
    tokenFeeBps?: number;
    lpLockDuration?: bigint;
    payoutDelay?: bigint;
    totalSupply?: bigint;
    saleTokensPool?: bigint;
    tokenPctToLPBps?: number;
    maxBuy?: bigint;
  }>({});

  const [contribsDb, setContribsDb] = useState<Contribution[] | null>(null);
  const [contribsOnchain, setContribsOnchain] = useState<Contribution[] | null>(null);

  // read on-chain (incl. tokenomics fields)
  useEffect(() => {
    if (!publicClient || !row?.pool_address) return;
    let cancelled = false;
    const pool = row.pool_address as `0x${string}`;

    const u256 = (fn: any) =>
      publicClient.readContract({ address: pool, abi: presalePoolAbi, functionName: fn }) as Promise<bigint>;
    const u16n = (fn: any) =>
      publicClient.readContract({ address: pool, abi: presalePoolAbi, functionName: fn }) as Promise<number>;

    const fetchChain = async () => {
      try {
        const [
          softCap,
          hardCap,
          raised,
          lpPctBps,
          platformFeeBps,
          tokenFeeBps,
          lpLockDuration,
          payoutDelay,
          totalSupply,
          saleTokensPool,
          tokenPctToLPBps,
          maxBuy,
          userContrib,
        ] = await Promise.all([
          u256('softCap'),
          u256('hardCap'),
          u256('totalRaised'),
          u16n('lpPctBps'),
          u16n('platformFeeBps'),
          u16n('tokenFeeBps'),
          u256('lpLockDuration'),
          u256('payoutDelay'),
          u256('totalSupply').catch(() => 0n),
          u256('saleTokensPool').catch(() => 0n),
          u16n('tokenPctToLPBps').catch(() => 0),
          u256('maxBuy').catch(() => 0n),
          address
            ? (publicClient.readContract({
                address: pool,
                abi: presalePoolAbi,
                functionName: 'contributed',
                args: [address],
              }) as Promise<bigint>)
            : Promise.resolve(0n),
        ]);

        if (!cancelled) {
          setChain({
            softCap,
            hardCap,
            raised,
            userContrib,
            lpPctBps,
            platformFeeBps,
            tokenFeeBps,
            lpLockDuration,
            payoutDelay,
            totalSupply,
            saleTokensPool,
            tokenPctToLPBps,
            maxBuy,
          });
        }
      } catch (e: any) {
        console.error('[SaleDetail] read failed', e?.shortMessage || e?.message || e);
      }
    };

    fetchChain();
    const iv = setInterval(fetchChain, 3000);
    return () => {
      cancelled = true;
      clearInterval(iv);
    };
  }, [publicClient, row?.pool_address, address]);

  // allowlist check
  useEffect(() => {
    if (!row?.id || !row.allowlist_enabled) {
      setAllowlisted(true);
      return;
    }
    if (!address) {
      setAllowlisted(false);
      return;
    }
    let cancelled = false;
    setCheckingAllowlist(true);
    (async () => {
      const { data, error } = await supabase
        .from('allowlists')
        .select('address')
        .eq('sale_id', row.id)
        .eq('address', address.toLowerCase())
        .limit(1);
      if (cancelled) return;
      if (error) {
        console.error('allowlist check failed:', error);
        setAllowlisted(false);
      } else {
        setAllowlisted(!!data?.length);
      }
      setCheckingAllowlist(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [row?.id, row?.allowlist_enabled, address]);

  // backfill pool address if needed
  useEffect(() => {
    (async () => {
      if (!publicClient) return;
      if (!row?.chain_tx_hash || row.pool_address) return;
      try {
        const receipt = await publicClient.getTransactionReceipt({
          hash: row.chain_tx_hash as `0x${string}`,
        });
        let pool: string | null = null;
        for (const log of receipt.logs) {
          if (log.address.toLowerCase() !== LAUNCHPAD_FACTORY.toLowerCase()) continue;
          try {
            const decoded = decodeEventLog({
              abi: launchpadFactoryAbi,
              data: log.data,
              topics: log.topics,
            });
            if (decoded.eventName === 'PoolCreated') {
              pool = (decoded.args as any).pool as string;
              break;
            }
          } catch {}
        }
        if (pool) {
          const { error } = await supabase.from('launches').update({ pool_address: pool }).eq('id', row.id);
          if (!error) setRow((prev) => (prev ? { ...prev, pool_address: pool } : prev));
          else console.error('Backfill update failed:', error);
        }
      } catch (e) {
        console.error('Could not decode PoolCreated:', e);
      }
    })();
  }, [publicClient, row?.chain_tx_hash, row?.pool_address, row?.id]);

  // timer tick
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, []);

  // fetch launch
  useEffect(() => {
    if (!id) return;
    setLoading(true);
    getLaunch(id)
      .then((r) => setRow(r))
      .catch((e) => setErr(e?.message ?? String(e)))
      .finally(() => setLoading(false));
  }, [id]);
  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    const refetch = async () => {
      const fresh = await getLaunch(id);
      if (!cancelled) setRow(fresh);
    };
    const iv = setInterval(refetch, 15000);
    return () => {
      cancelled = true;
      clearInterval(iv);
    };
  }, [id]);

  // contributions from DB
  useEffect(() => {
    (async () => {
      if (!row?.id || !supabase) return setContribsDb(null);
      try {
        const { data, error } = await supabase
          .from('contributions')
          .select('address,amount,created_at,username')
          .eq('sale_id', row.id)
          .order('created_at', { ascending: false })
          .limit(100);
        if (error) throw error;
        const mapped: Contribution[] = (data ?? []).map((d: any) => ({
          address: d.address,
          amount: Number(d.amount ?? 0),
          created_at: d.created_at,
          username: d.username ?? null,
        }));
        setContribsDb(mapped);
      } catch {
        setContribsDb(null);
      }
    })();
  }, [row?.id]);

  // best-effort on-chain contributions (only if DB has none and raised > 0)
  useEffect(() => {
    (async () => {
      if (!publicClient || !row?.pool_address) return setContribsOnchain(null);
      if (Array.isArray(contribsDb) && contribsDb.length > 0) return setContribsOnchain(null);
      if (!chain.raised || chain.raised === 0n) return setContribsOnchain(null);

      try {
        const pool = row.pool_address as `0x${string}`;
        const toBlock = await publicClient.getBlockNumber();
        let fromBlock: bigint | undefined;

        if (row.chain_tx_hash) {
          try {
            const r = await publicClient.getTransactionReceipt({ hash: row.chain_tx_hash as `0x${string}` });
            fromBlock = (r.blockNumber as bigint) ?? undefined;
          } catch {}
        }
        if (!fromBlock) {
          fromBlock = toBlock > 50000n ? toBlock - 50000n : 0n;
        }

        const logs = await publicClient.getLogs({
          address: pool,
          fromBlock,
          toBlock,
        });

        const nameRegex = /contribut|contributed|contribution|buy|bought|purchase|invest/i;

        const found: Contribution[] = [];
        for (const log of logs as Log[]) {
          try {
            const decoded = decodeEventLog({
              abi: presalePoolAbi,
              data: log.data,
              topics: log.topics,
            });
            if (!nameRegex.test(decoded.eventName)) continue;

            const args = decoded.args as Record<string, unknown>;
            let addr: string | undefined;
            let amt: bigint | undefined;

            for (const k of Object.keys(args)) {
              const v = args[k];
              if (!addr && typeof v === 'string' && v.startsWith('0x') && v.length === 42) addr = v.toLowerCase();
              if (!amt && typeof v === 'bigint') amt = v;
            }
            if (!addr || amt === undefined) continue;

            const block = await publicClient.getBlock({ blockHash: log.blockHash as Hex });
            const created_at = new Date(Number(block.timestamp) * 1000).toISOString();

            found.push({
              address: addr,
              amount: Number(formatUnits(amt, QUOTE_DECIMALS)),
              created_at,
              username: null,
            });
          } catch {}
        }

        if (!found.length) return setContribsOnchain([]);

        if (supabase) {
          const uniqueAddrs = Array.from(new Set(found.map((c) => c.address)));
          try {
            const { data } = await supabase
              .from('contributions')
              .select('address,username')
              .in('address', uniqueAddrs);
            const map = new Map<string, string>();
            (data ?? []).forEach((r: any) => {
              if (r.username) map.set(String(r.address).toLowerCase(), String(r.username));
            });
            found.forEach((c) => {
              const u = map.get(c.address.toLowerCase());
              if (u) c.username = u;
            });
          } catch {}
        }

        found.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
        setContribsOnchain(found.slice(0, 100));
      } catch (e) {
        console.warn('on-chain contributions fetch failed:', e);
        setContribsOnchain(null);
      }
    })();
  }, [publicClient, row?.pool_address, row?.chain_tx_hash, chain.raised, contribsDb]);

  // early returns
  if (loading) return <div style={{ padding: 24 }}>Loading…</div>;
  if (err) return <div style={{ padding: 24, color: 'var(--fl-danger)' }}>Error: {err}</div>;
  if (!row) return <div style={{ padding: 24 }}>Sale not found.</div>;

  // derived display
  const start = row.start_at ? new Date(row.start_at) : null;
  const end = row.end_at ? new Date(row.end_at) : null;

  const phase = salePhase(Date.now(), row.start_at, row.end_at);
  const timeToShow = phase === 'upcoming' ? countdown(row.start_at) : phase === 'active' ? countdown(row.end_at) : null;

  const statusToShow = (row.status as string | undefined) ?? (phase && phase !== 'tba' ? phase : 'created');

  // quote / pair
  const quote: string = row.quote ?? 'WAPE';
  const pairLabel = `${quote}/${row.token_symbol ?? 'TKN'}`;

  const hasPool = !!row.pool_address;
  const now = Date.now();
  const startMs = row.start_at ? new Date(row.start_at).getTime() : NaN;
  const endMs = row.end_at ? new Date(row.end_at).getTime() : NaN;
  const beforeStart = Number.isFinite(startMs) && now < startMs;
  const afterEnd = Number.isFinite(endMs) && now > endMs;

  let buyDisabled = true;
  let buyLabel = 'Buy';
  if (!hasPool) {
    buyDisabled = true;
    buyLabel = 'Pending pool…';
  } else if (afterEnd) {
    buyDisabled = true;
    buyLabel = 'Sale ended';
  } else if (beforeStart) {
    buyDisabled = true;
    buyLabel = timeToShow ? `Starts in ${timeToShow.d}d ${timeToShow.h}h ${timeToShow.m}m ${timeToShow.s}s` : 'Starts soon';
  } else if (!isConnected) {
    buyDisabled = true;
    buyLabel = 'Connect wallet';
  } else if (row.allowlist_enabled && checkingAllowlist) {
    buyDisabled = true;
    buyLabel = 'Checking allowlist…';
  } else if (row.allowlist_enabled && !allowlisted) {
    buyDisabled = true;
    buyLabel = 'Not allowlisted';
  } else {
    buyDisabled = false;
    buyLabel = 'Buy';
  }

  // progress (on-chain)
  const raisedStr =
    chain.raised !== undefined
      ? `${Number(formatUnits(chain.raised, QUOTE_DECIMALS)).toLocaleString()} ${quote}`
      : `0 ${quote}`;
  const softStr =
    chain.softCap !== undefined
      ? `${Number(formatUnits(chain.softCap, QUOTE_DECIMALS)).toLocaleString()} ${quote}`
      : Number.isFinite(Number(row.soft_cap))
      ? `${formatNumber(Number(row.soft_cap))} ${quote}`
      : '—';
  const hardStr =
    chain.hardCap !== undefined
      ? `${Number(formatUnits(chain.hardCap, QUOTE_DECIMALS)).toLocaleString()} ${quote}`
      : Number.isFinite(Number(row.hard_cap))
      ? `${formatNumber(Number(row.hard_cap))} ${quote}`
      : '—';
  const pct =
    chain.hardCap !== undefined && chain.raised !== undefined && chain.hardCap > 0n
      ? Number((chain.raised * 10000n) / chain.hardCap) / 100
      : 0;

  // badge styles
  const badgeStyle: React.CSSProperties = (() => {
    switch (statusToShow) {
      case 'active':
        return { background: 'var(--badge-success-bg)', color: 'var(--success)' };
      case 'upcoming':
        return { background: 'var(--badge-info-bg)', color: 'var(--info)' };
      case 'ended':
        return { background: 'var(--badge-muted-bg)', color: 'var(--muted)' };
      case 'created':
      default:
        return { background: 'var(--badge-warning-bg)', color: 'var(--warning)' };
    }
  })();

  // LIVE tokenomics (numbers)
  const totalSupplyLive =
    chain.totalSupply !== undefined
      ? Number(formatUnits(chain.totalSupply, row.token_decimals ?? 18))
      : toNum(row.total_supply);

  const saleTokensLive =
    chain.saleTokensPool !== undefined
      ? Number(formatUnits(chain.saleTokensPool, row.token_decimals ?? 18))
      : toNum(row.sale_tokens_pool ?? row.saleTokensPool);

  const lpTokensLive =
    chain.tokenPctToLPBps !== undefined && Number.isFinite(totalSupplyLive)
      ? totalSupplyLive * (Number(chain.tokenPctToLPBps) / 10000)
      : NaN;

  const tokenPctToLPpct =
    typeof chain.tokenPctToLPBps === 'number'
      ? (chain.tokenPctToLPBps / 100)
      : NaN;

  const platformFeeTokensLive =
    chain.tokenFeeBps !== undefined && Number.isFinite(totalSupplyLive)
      ? totalSupplyLive * (Number(chain.tokenFeeBps) / 10000)
      : NaN;

  const keptTokensLive =
    Number.isFinite(totalSupplyLive) && Number.isFinite(saleTokensLive) && Number.isFinite(lpTokensLive) && Number.isFinite(platformFeeTokensLive)
      ? Math.max(totalSupplyLive - saleTokensLive - lpTokensLive - platformFeeTokensLive, 0)
      : NaN;

  // Donut slices
  const donutSlices: Slice[] = [
    { label: 'LP', color: 'var(--chart-lp, #3b5bdb)', value: Math.max(0, lpTokensLive || 0) },
    { label: 'Tokens for Sale', color: 'var(--chart-sale, #2fb344)', value: Math.max(0, saleTokensLive || 0) },
    { label: 'Kept', color: 'var(--chart-kept, #f59f00)', value: Math.max(0, keptTokensLive || 0) },
    { label: 'Platform Fee', color: 'var(--chart-fee, #868e96)', value: Math.max(0, platformFeeTokensLive || 0) },
  ];

  const centerTitle = 'Total Supply';
  const centerValue = Number.isFinite(totalSupplyLive) ? totalSupplyLive.toLocaleString() : '—';
  const centerSub = row.token_symbol ? `$${row.token_symbol}` : '';

  const websiteHref = normalizeWebsite(row.website);
  const twitterHref = normalizeTwitter(row.twitter);

  // countdown progress 0..1
  const timeProgress = (() => {
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) return 0;
    if (now <= startMs) return 0;
    if (now >= endMs) return 1;
    return (now - startMs) / (endMs - startMs);
  })();

  // Your contribution / max per wallet
  const userContribNum =
    typeof chain.userContrib === 'bigint'
      ? Number(formatUnits(chain.userContrib, QUOTE_DECIMALS))
      : 0;

  const userContribStr = `${userContribNum.toLocaleString()} ${quote}`;

  const maxPerWalletStr = (() => {
    if (typeof chain.maxBuy === 'bigint') {
      if (chain.maxBuy <= 0n) return '—';
      return `${Number(formatUnits(chain.maxBuy, QUOTE_DECIMALS)).toLocaleString()} ${quote}`;
    }
    const dbMax = row.max_per_wallet ?? row.maxPerWallet;
    return Number.isFinite(Number(dbMax)) ? `${formatNumber(Number(dbMax))} ${quote}` : '—';
  })();

  // ===== New derived metrics for Tokenomics card =====
  const raisedQuote = typeof chain.raised === 'bigint' ? Number(formatUnits(chain.raised, QUOTE_DECIMALS)) : 0;
  const lpPct = typeof chain.lpPctBps === 'number' ? chain.lpPctBps / 10000 : 0;
// Only consider we "have" contributions when we actually have rows
const hasAnyContribution =
  (Array.isArray(contribsDb) && contribsDb.length > 0) ||
  (Array.isArray(contribsOnchain) && contribsOnchain.length > 0);

// Show a loading state only while we know something was raised
// but neither DB nor on-chain list has resolved yet.
const contribsLoading =
  (typeof chain.raised === 'bigint' && chain.raised > 0n) &&
  contribsDb === null &&
  contribsOnchain === null;

const contribList =
  (Array.isArray(contribsDb) && contribsDb.length > 0)
    ? contribsDb
    : (Array.isArray(contribsOnchain) ? contribsOnchain : []);



  const quoteToLP = (raisedQuote > 0 && lpPct > 0) ? raisedQuote * lpPct : 0;
  const tokensToLP = Number.isFinite(lpTokensLive) ? (lpTokensLive as number) : 0;

  const predictedListingPrice = (quoteToLP > 0 && tokensToLP > 0) ? (quoteToLP / tokensToLP) : NaN; // WAPE per token
  const predictedFDV = Number.isFinite(predictedListingPrice) && Number.isFinite(totalSupplyLive)
    ? predictedListingPrice * (totalSupplyLive as number)
    : NaN;
  return (
    <div className="sale-detail" style={{ display: 'grid', gap: 16 }}>
      {/* Header */}
      <div className="sale-header" style={{ display: 'grid', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {row.logo_url ? <img src={row.logo_url} alt="" className="sale-logo" /> : <div className="sale-logo placeholder" />}
          <div className="sale-title" style={{ flex: 1, minWidth: 0 }}>
            <div className="h1" style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', minWidth: 0 }}>
              <span style={{ flex: '0 1 auto', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>
                {row.token_name ?? 'Untitled'}
              </span>
              <span style={{ opacity: 0.7, whiteSpace: 'nowrap' }}>({row.token_symbol ?? '—'})</span>
              <span style={{ marginLeft: 'auto' }} />
              <div style={{ display: 'flex', gap: 10, color: 'var(--fl-gold)' }}>
                <IconWrap href={websiteHref} label="Website" disabled={!websiteHref}>
                  <GlobeIcon />
                </IconWrap>
                <IconWrap href={twitterHref} label="Twitter / X" disabled={!twitterHref}>
                  <TwitterIcon />
                </IconWrap>
                <IconWrap label="Telegram (soon)" disabled>
                  <TelegramIcon />
                </IconWrap>
              </div>
            </div>
            <div className="break-anywhere" style={{ marginTop: 8, opacity: 0.9, lineHeight: 1.4, wordBreak: 'break-word' }}>
              {row.description || '—'}
            </div>
          </div>
        </div>
      </div>

      {/* Main grid: Left stack (Info + Tokenomics) and Right (Donut) */}
      <div className="sale-grid">
        {/* LEFT COLUMN — Info card */}
        <div style={{ display: 'grid', gap: 16 }}>
          <div className="card sale-card">
            <div className="meta-line" style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <span className="badge" style={{ ...badgeStyle, padding: '2px 8px', borderRadius: 999, textTransform: 'capitalize' }}>
                {statusToShow}
              </span>
              <span className="meta-text">
                Presale Window:{' '}
                <b>{start ? start.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'TBA'}</b> →{' '}
                <b>{end ? end.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'TBA'}</b>
              </span>
            </div>

            {timeToShow && (
              <CountdownPill
                label={phase === 'upcoming' ? 'Starts in' : 'Ends in'}
                d={timeToShow.d} h={timeToShow.h} m={timeToShow.m} s={timeToShow.s}
                progress={timeProgress}
              />
            )}

            <div className="meta-grid">
              <div>Soft Cap: <b>{softStr}</b></div>
              <div>Hard Cap: <b>{hardStr}</b></div>
              <div>Raised: <b>{raisedStr}</b></div>
              <div>Pair: <b>{pairLabel}</b></div>
            </div>

            <div className="progress-outer"><div className="progress-inner" style={{ width: `${pct}%` }} /></div>

            {/* Your Contribution / Max per wallet */}
            <div style={{ fontFamily: 'var(--font-data)', display: 'flex', gap: 8, alignItems: 'baseline' }}>
              <span>Your Contribution:</span>
              <b>{userContribStr}</b>
              <span style={{ opacity: .7 }}>/</span>
              <b>{maxPerWalletStr}</b>
            </div>

            <div>
              Creator Address:{' '}
              <b>
                <a className="break-anywhere"><code>{row.creator_wallet ?? '—'}</code></a>
              </b>
            </div>

            <div>
              Presale Address:{' '}
              {row.pool_address ? (
                <b>
                  <a className="break-anywhere" href={`https://apescan.io/address/${row.pool_address}`} target="_blank" rel="noreferrer">
                    <code>{row.pool_address}</code>
                  </a>
                </b>
              ) : (
                <b><code>—</code></b>
              )}
            </div>
          </div>

          {/* LEFT COLUMN — Tokenomics */}
          <div className="card sale-card">
            <div style={{ fontWeight: 700 }}>Tokenomics / LP Info:</div>
            <div style={{ display: 'grid', gap: 8, fontFamily: 'var(--font-data)' }}>
              <div>
                % of Raise funding LP:&nbsp;
                <b>
                  {typeof chain.lpPctBps === 'number'
                    ? `${(chain.lpPctBps / 100).toLocaleString(undefined, { maximumFractionDigits: 2 })}%`
                    : row.lp_percent_to_lp
                    ? `${row.lp_percent_to_lp}%`
                    : '—'}
                </b>
              </div>
              <div>
                % of Tokens funding LP:&nbsp;
                <b>{Number.isFinite(tokenPctToLPpct) ? `${tokenPctToLPpct.toLocaleString(undefined, { maximumFractionDigits: 2 })}%` : '—'}</b>
              </div>
              <div>
                Liquidity Lock:&nbsp;
                <b>
                  {chain.lpLockDuration !== undefined
                    ? `${Math.round(Number(chain.lpLockDuration) / 86400)} days`
                    : row.lock_days
                    ? `${row.lock_days} days`
                    : '—'}
                </b>
              </div>

              <div>
                Predicted opening marketcap:&nbsp;
                <b>
                  {Number.isFinite(predictedFDV)
                    ? `${predictedFDV.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${quote}`
                    : '—'}
                </b>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN — Donut */}
        <div className="card sale-card">
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Token Distribution</div>
          <Donut
            slices={donutSlices}
            size={typeof window !== 'undefined' && window.innerWidth < 520 ? 220 : 260}
            thickness={34}
            centerTitle={centerTitle}
            centerValue={centerValue}
            centerSub={centerSub}
            tokenSymbol={row.token_symbol ? `$${row.token_symbol}` : ''}
          />
        </div>
      </div>

      {/* Allowlist */}
      <div className="allowlist-wrap">
        <AllowlistCheck key={row.id} saleId={row.id} root={row.allowlist_root} />
      </div>

      {/* Contributions — only show if we have at least one */}
      {contribsLoading ? (
  <div className="card sale-card" style={{ gap: 10 }}>
    <div style={{ fontWeight: 700 }}>Contributions</div>
    <div style={{ color: 'var(--muted)' }}>Loading on-chain contributions…</div>
  </div>
) : hasAnyContribution ? (
  <div className="card sale-card" style={{ gap: 10 }}>
    <div style={{ fontWeight: 700 }}>Contributions</div>
    <div style={{ display: 'grid', gap: 6 }}>
      {contribList.map((c, i) => (
        <div
          key={`${c.address}-${i}-${c.created_at}`}
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0,1fr) auto auto',
            gap: 8,
            alignItems: 'center',
            border: '1px solid var(--card-border)',
            background: 'var(--card-bg)',
            borderRadius: 10,
            padding: '8px 10px',
            fontFamily: 'var(--font-data)',
          }}
        >
          <div className="break-anywhere" style={{ fontWeight: 600 }}>
            {c.username || c.address}
          </div>
          <div style={{ whiteSpace: 'nowrap' }}>
            {Number(c.amount).toLocaleString()} {quote}
          </div>
          <div style={{ whiteSpace: 'nowrap', opacity: 0.8 }}>
            {new Date(c.created_at).toLocaleString([], {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </div>
        </div>
      ))}
    </div>
  </div>
) : null}

      {/* Actions (thirds) */}
      <div className="sale-actions">
        <Link className="button button-secondary back" to="/" style={{ padding: '8px 12px' }}>
          ← Back
        </Link>
        <div className="spacer" />
        <button
          className="button button-primary buy"
          disabled={buyDisabled}
          onClick={() => setShowBuy(true)}
          title={buyDisabled ? buyLabel : 'Contribute to this presale'}
        >
          {buyLabel}
        </button>
      </div>

      <BuyModal
        open={showBuy}
        onClose={() => setShowBuy(false)}
        poolAddress={row.pool_address as `0x${string}`}
        saleId={row.id}
        allowlistRoot={row.allowlist_root as any}
      />
    </div>
  );
}
