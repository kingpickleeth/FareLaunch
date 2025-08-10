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
import { decodeEventLog, formatUnits } from 'viem';
import { launchpadFactoryAbi, LAUNCHPAD_FACTORY, presalePoolAbi, QUOTE_DECIMALS } from '../lib/contracts';

type AnyRow = Record<string, any>;

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
// state
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
  payoutDelay?: bigint;    // seconds
}>({});
useEffect(() => {
  if (!publicClient || !row?.pool_address) return;
  let cancelled = false;

  const pool = row.pool_address as `0x${string}`;

  // Small helpers for cleaner typing
  const u256 = (fn: any) =>
    publicClient.readContract({ address: pool, abi: presalePoolAbi, functionName: fn }) as Promise<bigint>;
  const u16 = (fn: any) =>
    publicClient.readContract({ address: pool, abi: presalePoolAbi, functionName: fn }) as Promise<number>;

  const fetchChain = async () => {
    try {
      const [
        softCap,
        hardCap,
        raised,
        presaleRate,
        listingRate,
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
        u256('presaleRate'),
        u256('listingRate'),
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
          presaleRate,
          listingRate,
          lpPctBps,          // number
          platformFeeBps,    // number
          tokenFeeBps,       // number
          lpLockDuration,    // bigint (seconds)
          payoutDelay,       // bigint (seconds)
        });
      }
    } catch (e) {
      console.error('chain fetch failed', e);
    }
  };

  fetchChain();
  const iv = setInterval(fetchChain, 3000);
  return () => {
    cancelled = true;
    clearInterval(iv);
  };
}, [publicClient, row?.pool_address, address]);

  useEffect(() => {
    // If no allowlist for this sale, everyone can buy
    if (!row?.id || !row.allowlist_enabled) { setAllowlisted(true); return; }
  
    // If allowlist is enabled but no wallet, mark not allowlisted
    if (!address) { setAllowlisted(false); return; }
  
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
  
    return () => { cancelled = true; };
  }, [row?.id, row?.allowlist_enabled, address]);
  
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
          const { error } = await supabase
            .from('launches')
            .update({ pool_address: pool })
            .eq('id', row.id);
          if (!error) setRow(prev => prev ? { ...prev, pool_address: pool } : prev);
          else console.error('Backfill update failed:', error);
        }
      } catch (e) {
        console.error('Could not decode PoolCreated:', e);
      }
    })();
  }, [publicClient, row?.chain_tx_hash, row?.pool_address, row?.id]);  

  // ticker (re-render every second)
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, []);

  // fetch the launch
  useEffect(() => {
    if (!id) return;
    setLoading(true);
    getLaunch(id)
      .then((r) => setRow(r))
      .catch((e) => setErr(e?.message ?? String(e)))
      .finally(() => setLoading(false));
  }, [id]);

  // Update Supabase status when computed phase differs from DB row.status
  const lastPhaseSentRef = useRef<string | null>(null);
  useEffect(() => {
    if (!row?.id) return;

    const newPhase = salePhase(Date.now(), row.start_at, row.end_at); // 'upcoming' | 'active' | 'ended' | 'tba'
    if (!newPhase || newPhase === 'tba') return;
    if (newPhase === row.status) return;
    if (newPhase === lastPhaseSentRef.current) return;

    let cancelled = false;
    (async () => {
      await supabase.from('launches').update({ status: newPhase }).eq('id', row.id);
      lastPhaseSentRef.current = newPhase;
      if (!cancelled) setRow(prev => (prev ? { ...prev, status: newPhase } : prev));
    })();

    return () => { cancelled = true; };
  }, [row?.id, row?.start_at, row?.end_at, row?.status, tick]);

  // ---- Early returns ----
  if (loading) return <div style={{ padding: 24 }}>Loading…</div>;
  if (err) return <div style={{ padding: 24, color: 'var(--fl-danger)' }}>Error: {err}</div>;
  if (!row) return <div style={{ padding: 24 }}>Sale not found.</div>;

  // Derived display values
  const start = row.start_at ? new Date(row.start_at) : null;
  const end = row.end_at ? new Date(row.end_at) : null;

  const phase = salePhase(Date.now(), row.start_at, row.end_at);
  const timeToShow =
    phase === 'upcoming' ? countdown(row.start_at)
    : phase === 'active' ? countdown(row.end_at)
    : null;

  // quote + formatting
  const quote: string = row.quote ?? 'WAPE';
  const hasPool = !!row.pool_address;
  const now = Date.now();
  const startMs = row.start_at ? new Date(row.start_at).getTime() : NaN;
  const endMs   = row.end_at ? new Date(row.end_at).getTime() : NaN;
  const beforeStart = Number.isFinite(startMs) && now < startMs;
  const afterEnd    = Number.isFinite(endMs) && now > endMs;
  
  let buyDisabled = true;
  let buyLabel = 'Buy';
  
  if (!hasPool) {
    buyDisabled = true; buyLabel = 'Pending pool…';
  } else if (afterEnd) {
    buyDisabled = true; buyLabel = 'Sale ended';
  } else if (beforeStart) {
    buyDisabled = true; buyLabel = `Starts in ${timeToShow ? `${timeToShow.h}h ${timeToShow.m}m ${timeToShow.s}s` : ''}`;
  } else if (!isConnected) {
    buyDisabled = true; buyLabel = 'Connect wallet';
  } else if (row.allowlist_enabled && checkingAllowlist) {
    buyDisabled = true; buyLabel = 'Checking allowlist…';
  } else if (row.allowlist_enabled && !allowlisted) {
    buyDisabled = true; buyLabel = 'Not allowlisted';
  } else {
    buyDisabled = false; buyLabel = 'Buy';
  }  
  
  // progress (mock until contracts)
  const raisedStr =
  chain.raised !== undefined
    ? `${Number(formatUnits(chain.raised, QUOTE_DECIMALS)).toLocaleString()} ${quote}`
    : `${formatNumber(0)} ${quote}`;

    const softStr =
    chain.softCap !== undefined
      ? `${Number(formatUnits(chain.softCap, QUOTE_DECIMALS)).toLocaleString()} ${quote}`
      : (Number.isFinite(Number(row.soft_cap))
          ? `${formatNumber(Number(row.soft_cap))} ${quote}`
          : '—');

          const hardStr =
          chain.hardCap !== undefined
            ? `${Number(formatUnits(chain.hardCap, QUOTE_DECIMALS)).toLocaleString()} ${quote}`
            : (Number.isFinite(Number(row.hard_cap))
                ? `${formatNumber(Number(row.hard_cap))} ${quote}`
                : '—');

                const pct =
                chain.hardCap !== undefined && chain.raised !== undefined && chain.hardCap > 0n
                  ? Number((chain.raised * 10000n) / chain.hardCap) / 100 // two decimals
                  : 0;


  // Themed status badge
 // Replace your badgeStyle block with this:
const badgeStyle: React.CSSProperties = (() => {
  switch (phase) {
    case 'active':
      return { background: 'var(--badge-success-bg)', color: 'var(--success)' };
    case 'upcoming':
      return { background: 'var(--badge-info-bg)', color: 'var(--info)' };
    case 'ended':
      return { background: 'var(--badge-muted-bg)', color: 'var(--muted)' };
    // 'tba' and anything else
    default:
      return { background: 'var(--badge-warning-bg)', color: 'var(--warning)' };
  }
})();


  // LP / flow fields (support a few possible DB column names)
  const raisePctToLP = Number(
    row.percent_to_lp ?? row.lp_percent_to_lp ?? row.raise_percent_to_lp ?? NaN
  );
  const lockDays: number | undefined = row.lock_days ?? row.lockDays ?? undefined;
  const saleTokensPool = row.sale_tokens_pool ?? row.saleTokensPool ?? undefined;

  return (
    <div className="sale-detail" style={{ display: 'grid', gap: 16 }}>
      {/* Header */}
      <div className="sale-header">
        {row.logo_url
          ? <img src={row.logo_url} alt="" className="sale-logo" />
          : <div className="sale-logo placeholder" />}
        <div className="sale-title">
          <div className="h1 break-anywhere">
            {row.name ?? 'Untitled'}{' '}
            <span style={{ opacity: .7 }}>({row.token_symbol ?? '—'})</span>
          </div>
          <div className="sale-creator">
            by <span className="break-anywhere">{row.creator_wallet ?? '—'}</span>
          </div>
        </div>
      </div>

      {/* Status + countdown + progress */}
      <div className="card" style={{ padding: 12, display: 'grid', gap: 10 }}>
        <div className="meta-line">
          <span className="badge" style={{ ...badgeStyle, padding: '2px 8px', borderRadius: 999, textTransform: 'capitalize' }}>
            {phase}
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
            <b>{timeToShow.d}d {timeToShow.h}h {timeToShow.m}m {timeToShow.s}s</b>
          </div>
        )}

          <div className="meta-grid">
          <div>Soft Cap: <b>{softStr}</b></div>
          <div>Hard Cap: <b>{hardStr}</b></div>
          <div>Raised:   <b>{raisedStr}</b></div>
          <div>Quote:    <b>{quote}</b></div>
        </div>
        {typeof chain.userContrib === 'bigint' && isConnected && (
          <div className="meta-grid">
            <div>Your Contribution: <b>{Number(formatUnits(chain.userContrib, QUOTE_DECIMALS)).toLocaleString()} {quote}</b></div>
          </div>
        )}
        <div>Presale Address: <b><code className="break-anywhere">{row.pool_address || '—'}</code></b></div>
        <div className="progress-outer">
          <div className="progress-inner" style={{ width: `${pct}%` }} />
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
          : (Number.isFinite(raisePctToLP) ? `${raisePctToLP}%` : '—')}
      </b>
    </div>

    <div>
      LP Lock:&nbsp;
      <b>
        {chain.lpLockDuration !== undefined
          ? `${Math.round(Number(chain.lpLockDuration) / 86400)} days`
          : (lockDays ? `${lockDays} days` : '—')}
      </b>
    </div>

    {/* Keep the original “Tokens for Sale” if you still want to reflect the plan from DB */}
    <div>
      Tokens for Sale:&nbsp;
      <b className="break-anywhere">
        {saleTokensPool ? formatNumber(Number(saleTokensPool)) : '—'}
      </b>
    </div>
  </div>
</div>

      {/* About / links */}
      <div className="card" style={{ padding: 12, display: 'grid', gap: 6 }}>
        <div>Website: {row.website
          ? <a className="break-anywhere" href={row.website} target="_blank" rel="noreferrer">{row.website}</a>
          : '—'}
        </div>
        <div>Twitter: {row.twitter
          ? <a className="break-anywhere" href={row.twitter} target="_blank" rel="noreferrer">{row.twitter}</a>
          : '—'}
        </div>
        <div>Description:</div>
        <div className="break-anywhere" style={{ opacity: .85 }}>{row.description || '—'}</div>
      </div>

      {/* Allowlist */}
      <div className="allowlist-wrap">
        <AllowlistCheck key={row.id} saleId={row.id} root={row.allowlist_root} />
      </div>

      {/* Actions */}
      <div className="sale-actions">
  <Link className="button" to="/">← Back</Link>
  <button className="button" disabled>Claim (soon)</button>
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
