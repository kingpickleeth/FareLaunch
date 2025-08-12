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
import { decodeEventLog, formatUnits } from 'viem';
import {
  launchpadFactoryAbi,
  LAUNCHPAD_FACTORY,
  presalePoolAbi,
  QUOTE_DECIMALS,
} from '../lib/contracts';

type AnyRow = Record<string, any>;

// --- Small SVG icon components (no external deps) ---
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
// In SaleDetail.tsx – replace IconWrap's `common` style:
// in IconWrap's common styles
const common: React.CSSProperties = {
  width: 36,
  height: 36,
  display: 'inline-grid',
  placeItems: 'center',
  borderRadius: 10,
  border: '1px solid var(--card-border)',
  background: 'var(--fl-purple)',   // better contrast on light theme too
  boxShadow: '0 4px 10px rgba(0,0,0,.18)',
  color: '#FFFFFF',
  opacity: disabled ? 0.55 : 1,     // clearer disabled vs enabled
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
    <path
      d="M12 21c4.97 0 9-4.03 9-9s-4.03-9-9-9-9 4.03-9 9 4.03 9 9 9Z"
      stroke="currentColor"
      strokeWidth="1.7"
    />
    <path d="M3 12h18M12 3c2.5 2.9 3.75 6 3.75 9S14.5 20.1 12 21m0-18C9.5 5.9 8.25 9 8.25 12S9.5 18.1 12 21" stroke="currentColor" strokeWidth="1.7" />
  </svg>
);

const TwitterIcon = () => (
  // X logo
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M18.244 3H21l-6.46 7.383L22 21h-6.828l-4.31-5.4L5.9 21H3.142l6.905-7.896L2 3h6.914l3.9 4.973L18.244 3Zm-1.195 16.2h1.262L7.065 4.74H5.74L17.049 19.2Z" />
  </svg>
);

const TelegramIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M9.036 15.39 8.87 19.5c.442 0 .635-.19.865-.418l2.078-1.993 4.307 3.158c.79.434 1.352.205 1.568-.73l2.84-12.915h.001c.252-1.106-.4-1.536-1.167-1.266L3.54 9.7c-1.13.408-1.113.994-.191 1.254l4.412 1.224 10.235-6.46c.48-.292.915-.13.556.162" />
  </svg>
);

export default function SaleDetail() {
  const { id } = useParams();
  const [row, setRow] = useState<AnyRow | null>(null);
  const [err, setErr] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const { address, isConnected } = useAccount();
  const [showBuy, setShowBuy] = useState(false);
  const [allowlisted, setAllowlisted] = useState<boolean>(true); // default true if allowlist disabled
  const publicClient = usePublicClient();
  const [checkingAllowlist, setCheckingAllowlist] = useState<boolean>(false);

  // chain state
  const [chain, setChain] = useState<{
    softCap?: bigint;
    hardCap?: bigint;
    raised?: bigint;
    userContrib?: bigint;
    presaleRate?: bigint;
    listingRate?: bigint;
    lpPctBps?: number;
    platformFeeBps?: number;
    tokenFeeBps?: number;
    lpLockDuration?: bigint; // seconds
    payoutDelay?: bigint; // seconds
  }>({});

  // ---- On-chain readers (mirroring Explore page style) ----
  useEffect(() => {
    if (!publicClient || !row?.pool_address) return;
    let cancelled = false;

    const pool = row.pool_address as `0x${string}`;
    console.debug('[SaleDetail] pool', pool, 'chainId?', publicClient?.chain?.id);
    console.debug(
      '[SaleDetail] abiHas(totalRaised)?',
      Array.isArray(presalePoolAbi) &&
        (presalePoolAbi as any[]).some((x) => x?.type === 'function' && x?.name === 'totalRaised')
    );
    
    const u256 = (fn: any) =>
      publicClient.readContract({
        address: pool,
        abi: presalePoolAbi,
        functionName: fn,
      }) as Promise<bigint>;
    const u16 = (fn: any) =>
      publicClient.readContract({
        address: pool,
        abi: presalePoolAbi,
        functionName: fn,
      }) as Promise<number>;
console.debug('[SaleDetail] pool', pool, 'chainId?', publicClient?.chain?.id);

    const fetchChain = async () => {
      try {
        const probeRaised = await publicClient.readContract({
          address: pool,
          abi: presalePoolAbi,
          functionName: 'totalRaised', // verify exact case with ABI
        });
        const probeHard = await publicClient.readContract({
          address: pool,
          abi: presalePoolAbi,
          functionName: 'hardCap',
        });
        console.debug('[SaleDetail] probe totalRaised=', probeRaised.toString(), ' hardCap=', probeHard.toString());
        const [
          softCap,
          hardCap,
          raised,
          lpPctBps,
          platformFeeBps,
          tokenFeeBps,
          lpLockDuration,
          payoutDelay,
          userContrib,
        ] = await Promise.all([
          u256('softCap'),
          u256('hardCap'),
          u256('totalRaised'),
          u16('lpPctBps'),
          u16('platformFeeBps'),
          u16('tokenFeeBps'),
          u256('lpLockDuration'),
          u256('payoutDelay'),
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

  // ---- Allowlist check ----
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

  // ---- Backfill pool address from receipt if missing ----
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

  // ticker for countdown
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, []);

  // fetch the launch (and refetch)
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

  // ---- Early returns ----
  if (loading) return <div style={{ padding: 24 }}>Loading…</div>;
  if (err) return <div style={{ padding: 24, color: 'var(--fl-danger)' }}>Error: {err}</div>;
  if (!row) return <div style={{ padding: 24 }}>Sale not found.</div>;

  // Derived display values
  const start = row.start_at ? new Date(row.start_at) : null;
  const end = row.end_at ? new Date(row.end_at) : null;

  const phase = salePhase(Date.now(), row.start_at, row.end_at);
  const timeToShow = phase === 'upcoming' ? countdown(row.start_at) : phase === 'active' ? countdown(row.end_at) : null;

  // Use DB status as source of truth for the badge, fallback to computed phase
  const statusToShow = (row.status as string | undefined) ?? (phase && phase !== 'tba' ? phase : 'created');

  // quote + formatting
  const quote: string = row.quote ?? 'WAPE';
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
    buyLabel = `Starts in ${timeToShow ? `${timeToShow.h}h ${timeToShow.m}m ${timeToShow.s}s` : ''}`;
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
<div style={{fontFamily:'var(--font-data)', fontSize:12, opacity:.75}}>
  debug: raisedRaw={String(chain.raised ?? 'n/a')}
  &nbsp; hardCapRaw={String(chain.hardCap ?? 'n/a')}
  &nbsp; pool={row.pool_address || '—'}
</div>

  // progress (live on-chain)
  const raisedStr =
    chain.raised !== undefined
      ? `${Number(formatUnits(chain.raised, QUOTE_DECIMALS)).toLocaleString()} ${quote}`
      : `${formatNumber(0)} ${quote}`;

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

  // Themed status badge
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

  // LP / flow fields (support a few possible DB column names)
  const raisePctToLP = Number(row.percent_to_lp ?? row.lp_percent_to_lp ?? row.raise_percent_to_lp ?? NaN);
  const lockDays: number | undefined = row.lock_days ?? row.lockDays ?? undefined;
  const saleTokensPool = row.sale_tokens_pool ?? row.saleTokensPool ?? undefined;
// helpers (put top-level, outside component or inside before usage)
function normalizeWebsite(u?: string | null): string | undefined {
  if (!u) return undefined;
  const w = String(u).trim();
  if (!w) return undefined;
  return /^https?:\/\//i.test(w) ? w : `https://${w}`;
}
function normalizeTwitter(t?: string | null): string | undefined {
  if (!t) return undefined;
  let h = String(t).trim();
  if (!h) return undefined;
  if (h.startsWith('@')) h = h.slice(1);
  // allow pasted full URL
  if (/^https?:\/\//i.test(h)) return h;
  return `https://x.com/${h}`;
}

// …keep your early returns…
if (loading) return <div style={{ padding: 24 }}>Loading…</div>;
if (err) return <div style={{ padding: 24, color: 'var(--fl-danger)' }}>Error: {err}</div>;
if (!row) return <div style={{ padding: 24 }}>Sale not found.</div>;

// THEN compute hrefs as plain variables (not hooks)
const websiteHref = normalizeWebsite(row.website);
const twitterHref = normalizeTwitter(row.twitter);


  return (
    <div className="sale-detail" style={{ display: 'grid', gap: 16 }}>
      {/* Header */}
      <div className="sale-header" style={{ display: 'grid', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {row.logo_url ? (
            <img src={row.logo_url} alt="" className="sale-logo" />
          ) : (
            <div className="sale-logo placeholder" />
          )}
<div className="sale-title" style={{ flex: 1, minWidth: 0 }}>
  {/* Name + symbol */}
  <div
    className="h1"
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      flexWrap: 'wrap',          // allow wrapping on small screens
      minWidth: 0,
    }}
  >
    <span
      style={{
        flex: '0 1 auto',
        whiteSpace: 'nowrap',     // keep name on one line
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        maxWidth: '100%',
      }}
    >
      {row.token_name ?? 'Untitled'}
    </span>
    <span style={{ opacity: 0.7, whiteSpace: 'nowrap' }}>
      ({row.token_symbol ?? '—'})
    </span>

    {/* push icons right when space allows; otherwise they wrap under */}
    <span style={{ marginLeft: 'auto' }} />

    {/* Icons */}
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

  {/* Description under title */}
  <div
    className="break-anywhere"
    style={{ marginTop: 8, opacity: 0.9, lineHeight: 1.4, wordBreak: 'break-word' }}
  >
    {row.description || '—'}
  </div>
</div>
        </div>
      </div>

      {/* Status + countdown + progress */}
      <div className="card" style={{ padding: 12, display: 'grid', gap: 10 }}>
        <div className="meta-line" style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <span
            className="badge"
            style={{ ...badgeStyle, padding: '2px 8px', borderRadius: 999, textTransform: 'capitalize' }}
          >
            {statusToShow}
          </span>
          <span className="meta-text">
            Presale Window:{' '}
            <b>
              {start
                ? start.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                : 'TBA'}
            </b>{' '}
            →{' '}
            <b>
              {end
                ? end.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                : 'TBA'}
            </b>
          </span>
        </div>

        {timeToShow && (
          <div className="meta-timer">
            {phase === 'upcoming' ? 'Starts in' : 'Ends in'}:{' '}
            <b>
              {timeToShow.d}d {timeToShow.h}h {timeToShow.m}m {timeToShow.s}s
            </b>
          </div>
        )}

<div className="meta-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 8 }}>
  <div>Soft Cap: <b>{softStr}</b></div>
  <div>Hard Cap: <b>{hardStr}</b></div>
  <div>Raised:   <b>{raisedStr}</b></div>
</div>

{typeof chain.userContrib === 'bigint' && isConnected && (
  <div className="meta-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 8 }}>
    <div>
      Your Contribution:{' '}
      <b>{Number(formatUnits(chain.userContrib, QUOTE_DECIMALS)).toLocaleString()} WAPE</b>
    </div>
  </div>
)}

{/* Progress bar now comes here */}
<div className="progress-outer">
  <div className="progress-inner" style={{ width: `${pct}%` }} />
</div>

{/* Creator now lives here */}
<div  style={{ marginTop: 4 }}>
  Creator Address: <b><a className="break-anywhere"><code>{row.creator_wallet ?? '—'}</code></a></b>
</div>

{/* Presale Address (linked) */}
<div style={{ marginTop: 2 }}>
  Presale Address:{' '}
  {row.pool_address ? (
    <b>
      <a
        className="break-anywhere"
        href={`https://apescan.io/address/${row.pool_address}`}
        target="_blank"
        rel="noreferrer"
      >
        <code>{row.pool_address}</code>
      </a>
    </b>
  ) : (
    <b><code>—</code></b>
  )}
</div>
      </div>

      {/* Tokenomics / LP (on-chain) */}
      <div className="card" style={{ padding: 12, display: 'grid', gap: 6 }}>
        <div style={{ fontWeight: 700, marginBottom: 4 }}>Tokenomics / LP</div>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontFamily: 'var(--font-data)' }}>
          <div>
            % of Raise funding LP:&nbsp;
            <b>
              {typeof chain.lpPctBps === 'number'
                ? `${(chain.lpPctBps / 100).toLocaleString(undefined, { maximumFractionDigits: 2 })}%`
                : Number.isFinite(raisePctToLP)
                ? `${raisePctToLP}%`
                : '—'}
            </b>
          </div>

          <div>
            LP Lock:&nbsp;
            <b>
              {chain.lpLockDuration !== undefined
                ? `${Math.round(Number(chain.lpLockDuration) / 86400)} days`
                : lockDays
                ? `${lockDays} days`
                : '—'}
            </b>
          </div>

          <div>
            Tokens for Sale:&nbsp;
            <b className="break-anywhere">{saleTokensPool ? formatNumber(Number(saleTokensPool)) : '—'}</b>
          </div>
        </div>
      </div>

      {/* Allowlist */}
      <div className="allowlist-wrap">
        <AllowlistCheck key={row.id} saleId={row.id} root={row.allowlist_root} />
      </div>

      {/* Actions */}
      <div className="sale-actions" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Link className="button" to="/">
          ← Back
        </Link>
        <button className="button" disabled>
          Claim (soon)
        </button>
        <button
          className="button button-secondary"
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
