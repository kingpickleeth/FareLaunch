// src/pages/SaleDetail.tsx
import { useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getLaunch } from '../data/launches';
import { salePhase, countdown } from '../utils/time';
import AllowlistCheck from '../components/AllowlistCheck';
import { supabase } from '../lib/supabase';
import { formatNumber } from '../utils/format';
import { useAccount, usePublicClient } from 'wagmi';
import BuyModal from '../components/BuyModal';
import { decodeEventLog, formatUnits, type Hex, parseAbiItem, getAddress } from 'viem';
import {
  launchpadFactoryAbi,
  LAUNCHPAD_FACTORY,
  presalePoolAbi,
  QUOTE_DECIMALS,
} from '../lib/contracts';

const DEBUG_CONTRIB = true;

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
          /* Share dropdown */
    .share-menu{
      position:absolute;
      top:42px; /* 36px icon + gap */
      right:0;
      min-width: 200px;
      padding: 8px;
      border: 1px solid var(--card-border);
      background: var(--card-bg);
      border-radius: 12px;
      box-shadow: 0 12px 28px rgba(0,0,0,.25);
      z-index: 50;
      display:grid;
      gap:4px;
    }
    .share-item{
      display:flex; align-items:center; gap:8px;
      padding:8px 10px; border-radius:8px;
      font: 600 13px var(--font-sans, Inter, system-ui, sans-serif);
      color: var(--text);
      cursor:pointer;
      text-decoration:none;
    }
    .share-item:hover{ background: var(--hover-bg, rgba(255,255,255,.06)); }

    /* Simple modal for Embed code */
    .modal-overlay{
      position:fixed; inset:0;
      background: rgba(0,0,0,.5);
      display:grid; place-items:center;
      z-index:80;
    }
    .modal-card{
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 14px;
      padding: 16px;
      width: min(720px, 96vw);
      display:grid; gap:10px;
    }
    .embed-textarea{
      width:100%; height: 200px; resize: vertical;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
      font-size: 13px; line-height: 1.4;
      border-radius: 10px; padding: 10px;
      background: var(--input-bg); color: var(--text);
      border: 1px solid var(--card-border);
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
    onClick,
  }: {
    children: React.ReactNode;
    disabled?: boolean;
    href?: string;
    label: string;
    onClick?: () => void;
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
        <span
          title={label}
          aria-label={label}
          role="button"
          tabIndex={0}
          onClick={disabled ? undefined : onClick}
          onKeyDown={(e) => {
            if (!disabled && (e.key === 'Enter' || e.key === ' ')) onClick?.();
          }}
          style={common}
        >
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
  function IconPill({
    text,
    onClick,
  }: {
    text: string;
    onClick?: () => void;
  }) {
    const base: React.CSSProperties = {
      height: 36,
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '0 12px',                 // a tad wider for the label
      borderRadius: 10,
      border: '1px solid var(--card-border)',
      background: 'var(--fl-purple)',
      boxShadow: '0 4px 10px rgba(0,0,0,.18)',
      color: '#fff',
      cursor: 'pointer',
      userSelect: 'none',
      transition: 'transform .12s ease, box-shadow .12s ease',
      font: '700 12px var(--font-sans, Inter, system-ui, sans-serif)',
    };
  
    return (
      <button
        type="button"
        title={text}
        aria-label={text}
        onClick={onClick}
        style={base}
        onMouseEnter={(e) => {
          const el = e.currentTarget as HTMLButtonElement;
          el.style.transform = 'translateY(-2px)';              // same as IconWrap
          el.style.boxShadow = '0 8px 16px rgba(0,0,0,.22)';
        }}
        onMouseLeave={(e) => {
          const el = e.currentTarget as HTMLButtonElement;
          el.style.transform = 'translateY(0)';
          el.style.boxShadow = '0 4px 10px rgba(0,0,0,.15)';
        }}
        onMouseDown={(e) => {
          const el = e.currentTarget as HTMLButtonElement;       // subtle press effect
          el.style.transform = 'translateY(0)';
          el.style.boxShadow = '0 4px 10px rgba(0,0,0,.18)';
        }}
        onMouseUp={(e) => {
          const el = e.currentTarget as HTMLButtonElement;
          el.style.transform = 'translateY(-2px)';
          el.style.boxShadow = '0 8px 16px rgba(0,0,0,.22)';
        }}
      >
        <span>Share</span>
      </button>
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
const ShareIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M18 8a3 3 0 1 0-2.83-4h.01A3 3 0 0 0 18 8Zm-12 8a3 3 0 1 0 2.83 4H8.8A3 3 0 0 0 6 16Zm0-4a3 3 0 1 0 2.83-4H8.8A3 3 0 0 0 6 12Zm10.59-5.41-8.2 4.1m8.2 8.72-8.2-4.1" stroke="currentColor" strokeWidth="1.7" fill="none" strokeLinecap="round"/>
  </svg>
);
const LinkIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
    <path d="M10.5 13.5l3-3m-6 6l-1.9 1.9a3 3 0 1 1-4.2-4.2L5.3 12m13.4 0l1.9-1.9a3 3 0 0 0-4.2-4.2L15 7.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/>
  </svg>
);
const CodeIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
    <path d="M8 16 4 12l4-4m8 0 4 4-4 4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
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
// Known / fallback signatures (adjust if your event is different)
// If you DO know your exact event, set this to a precise ABI item for best decoding:
const CONTRIB_ABI_EVENT = parseAbiItem('event Contributed(address indexed buyer, uint256 amount)');
// Put this near your CONTRIB_ABI_EVENT
const CONTRIBUTION_EVENT_SIGS = [
  'event Contributed(address indexed buyer, uint256 amount)',
  'event Contribution(address indexed buyer, uint256 amount)',
  'event Bought(address indexed buyer, uint256 amount)',
  'event TokensPurchased(address indexed purchaser, uint256 value)',
  'event Invested(address indexed buyer, uint256 amount)',
] as const;

const CONTRIBUTION_EVENTS = CONTRIBUTION_EVENT_SIGS.map((sig) => parseAbiItem(sig));
const shortAddr = (a?: string) => (a ? `${a.slice(0, 6)}....${a.slice(-4)}` : '');

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

  const [, setContribsDb] = useState<Contribution[] | null>(null);
  const [contribsOnchain, setContribsOnchain] = useState<Contribution[] | null>(null);
  const shareRef = useRef<HTMLDivElement | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [showEmbed, setShowEmbed] = useState(false);
  const [copied, setCopied] = useState(false);

  // Close dropdown on outside click / Esc
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (shareRef.current && !shareRef.current.contains(e.target as Node)) setShareOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setShareOpen(false); };
    document.addEventListener('click', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('click', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

// use id for the SSR fallback, not row.id
const presaleUrl =
  typeof window !== 'undefined' ? window.location.href : `https://farelaunch.xyz/sale/${id ?? ''}`;

// optional-chain row in the tweet text
const tweetText = encodeURIComponent(
  `Presale for $${row?.token_symbol || row?.token_name || 'token'} on FareLaunch.`
);
const tweetUrl = `https://x.com/intent/tweet?text=${tweetText}&url=${encodeURIComponent(presaleUrl)}`;

// rest unchanged…
const handleCopyUrl = async () => {
  try {
    // modern API
    await navigator.clipboard.writeText(presaleUrl);
    setCopied(true);
  } catch (err) {
    // fallback for older browsers / blocked clipboard
    try {
      const ta = document.createElement('textarea');
      ta.value = presaleUrl;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
    } catch (e) {
      // last-resort fallback
      window.prompt('Copy URL', presaleUrl);
    }
  } finally {
    setShareOpen(false);
    window.setTimeout(() => setCopied(false), 1200);
  }
};

const embedSrc = presaleUrl + (presaleUrl.includes('?') ? '&' : '?') + 'embed=1';
const embedCode = `<iframe src="${embedSrc}" …></iframe>`;

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
 // contributions from DB (explicitly mark as none; we’ll use on-chain only)
useEffect(() => {
  setContribsDb([]);
}, [row?.id]);

// best-effort on-chain contributions (only if raised > 0)
useEffect(() => {
  (async () => {
    if (!publicClient || !row?.pool_address) return setContribsOnchain(null);
    if (!chain.raised || chain.raised === 0n) return setContribsOnchain([]);

    try {
      const pool = row.pool_address as `0x${string}`;
      const toBlock = await publicClient.getBlockNumber();

      let fromBlock: bigint = 0n;
      if (row.chain_tx_hash) {
        try {
          const r = await publicClient.getTransactionReceipt({ hash: row.chain_tx_hash as `0x${string}` });
          fromBlock = (r.blockNumber as bigint) ?? 0n;
        } catch {}
      }
      if (fromBlock === 0n && toBlock > 50_000n) fromBlock = toBlock - 50_000n;

      let logs: any[] = [];

      // 1) Exact ABI item first (auto-decoded with .args)
      try {
        logs = await publicClient.getLogs({
          address: pool,
          fromBlock,
          toBlock,
          event: CONTRIB_ABI_EVENT, // e.g. Contributed(address indexed buyer, uint256 amount)
        } as any);
        if (DEBUG_CONTRIB) console.debug('[CHAIN] decoded via exact ABI item', logs.length);
      } catch {}

      // 2) If none, try a set of common contribution events (also auto-decoded)
      if (!logs.length) {
        logs = await publicClient.getLogs({
          address: pool,
          fromBlock,
          toBlock,
          events: CONTRIBUTION_EVENTS as any,
        } as any);
        if (DEBUG_CONTRIB) console.debug('[CHAIN] decoded via candidate events', logs.length);
      }

      // 3) If still none, last resort: fetch all logs for the address, then try decoding each
      if (!logs.length) {
        const raw = await publicClient.getLogs({ address: pool, fromBlock, toBlock });
        if (DEBUG_CONTRIB) console.debug('[CHAIN] raw address logs', raw.length);

        const decoded: any[] = [];
        for (const log of raw) {
          let hit: any | null = null;
          for (const ev of [CONTRIB_ABI_EVENT, ...CONTRIBUTION_EVENTS]) {
            try {
              const d = decodeEventLog({ abi: [ev], data: log.data, topics: log.topics });
              hit = { ...log, args: d.args };
              break;
            } catch {}
          }
          if (hit) decoded.push(hit);
        }
        logs = decoded;
        if (DEBUG_CONTRIB) console.debug('[CHAIN] decoded from raw by trying candidates', logs.length);
      }

      const out: Contribution[] = [];
      for (const log of logs) {
        try {
          const args = (log as any).args as Record<string, unknown> | undefined;
          if (!args) continue;

          let buyer: string | undefined;
          let amount: bigint | undefined;

          for (const k of Object.keys(args)) {
            const v = (args as any)[k];
            if (!buyer && typeof v === 'string' && v.startsWith('0x') && v.length === 42) buyer = v.toLowerCase();
            if (!amount && typeof v === 'bigint') amount = v;
          }
          if (!buyer || amount === undefined) continue;

          const block = await publicClient.getBlock({ blockHash: log.blockHash as Hex });
          out.push({
            address: buyer,
            amount: Number(formatUnits(amount, QUOTE_DECIMALS)),
            created_at: new Date(Number(block.timestamp) * 1000).toISOString(),
            username: null,
          });
        } catch (e) {
          if (DEBUG_CONTRIB) console.debug('[CHAIN] parse skip', e);
        }
      }

      if (!out.length) return setContribsOnchain([]);

      // Enrich with profiles (usernames)
  // Enrich with profiles (usernames) — handles lowercase vs checksum & "wallet" vs "address" column.
// Enrich with profiles (usernames)
// Enrich with creators (display_name), matching wallets case-insensitively
try {
  const unique = Array.from(new Set(out.map(r => r.address)));
  // also include checksummed versions so a case-sensitive IN() will still match mixed-case rows
  const checksummed = unique.map(a => {
    try { return getAddress(a); } catch { return a; }
  });
  const querySet = Array.from(new Set([...unique, ...checksummed])); // dedupe

  const { data: creators, error: creatorsErr } = await supabase
    .from('creators')
    .select('wallet, display_name, avatar_url')     // grab what we need
    .in('wallet', querySet);

  if (creatorsErr) {
    if (DEBUG_CONTRIB) console.debug('[CREATORS] error', creatorsErr.message);
  } else {
    if (DEBUG_CONTRIB) console.debug('[CREATORS] rows', creators?.length ?? 0, creators?.slice(0,3));
    const nameMap = new Map<string, { name?: string; avatar?: string }>();
    (creators ?? []).forEach((row: any) => {
      const w = String(row.wallet || '').toLowerCase();
      const name = row.display_name || null;
      const avatar = row.avatar_url || null;
      nameMap.set(w, { name: name ?? undefined, avatar: avatar ?? undefined });
    });

    out.forEach(r => {
      const hit = nameMap.get(r.address.toLowerCase());
      if (hit?.name) r.username = hit.name;
      // if you want avatar later, attach r.avatar = hit?.avatar
    });
  }
} catch (e) {
  if (DEBUG_CONTRIB) console.debug('[CREATORS] lookup failed', e);
}

      out.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
      setContribsOnchain(out);
    } catch (e) {
      console.warn('on-chain contributions fetch failed:', e);
      setContribsOnchain([]);
    }
  })();
}, [publicClient, row?.pool_address, row?.chain_tx_hash, chain.raised]);
  
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
const hasAnyContribution = Array.isArray(contribsOnchain) && contribsOnchain.length > 0;


// Show a loading state only while we know something was raised
// but neither DB nor on-chain list has resolved yet.
const contribsLoading =
  (typeof chain.raised === 'bigint' && chain.raised > 0n) &&
  contribsOnchain === null;

const contribList = Array.isArray(contribsOnchain) ? contribsOnchain : [];



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
              <div style={{ display: 'flex', gap: 10, color: 'var(--fl-gold)', alignItems: 'center' }}>
  {/* Share (dropdown) */}
  <div
  ref={shareRef}
  style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}
>
  {/* was: <IconPill icon={<ShareIcon />} text="Share" ... /> */}
  <IconPill text="Share" onClick={() => setShareOpen((v) => !v)} />

  {shareOpen && (
    <div className="share-menu">
      <a className="share-item" href={tweetUrl} target="_blank" rel="noreferrer" onClick={() => setShareOpen(false)}>
        <TwitterIcon /> <span>Share to X</span>
      </a>
      <button
  type="button"
  className="share-item"
  onClick={handleCopyUrl}
  style={{ background: 'transparent', border: 0 }}
>
  <LinkIcon /> <span>{copied ? 'Copied!' : 'Copy URL'}</span>
</button>
      <button
        className="share-item"
        onClick={() => { setShowEmbed(true); setShareOpen(false); }}
        style={{ background: 'transparent', border: 0 }}
      >
        <CodeIcon /> <span>Embed this Presale</span>
      </button>
    </div>
  )}
</div>

  {/* Existing socials */}
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
  {c.username || shortAddr(c.address)}
</div>
<div className="contrib-amount">
  {Number(c.amount).toLocaleString()} {quote}
</div>
<div className="contrib-date">
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
      {showEmbed && (
  <div className="modal-overlay" onClick={() => setShowEmbed(false)}>
    <div className="modal-card" onClick={(e) => e.stopPropagation()}>
      <div style={{ fontWeight: 700, fontSize: 16 }}>Embed this Presale</div>
      <div style={{ fontSize: 13, opacity: 0.85 }}>
        Paste this iframe on your website. You can style the container around it as needed.
      </div>
      <textarea className="embed-textarea" readOnly value={embedCode} />

      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <button className="button button-secondary" onClick={() => setShowEmbed(false)}>Close</button>
        <button
          className="button button-primary"
          onClick={async () => {
            try { await navigator.clipboard.writeText(embedCode); } catch {}
            setShowEmbed(false);
          }}
        >
          Copy Embed Code
        </button>
      </div>
    </div>
  </div>
)}

    </div>
  );
}
