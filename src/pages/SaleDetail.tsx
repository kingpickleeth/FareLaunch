// src/pages/SaleDetail.tsx
import { useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getLaunch } from '../data/launches';
import { salePhase, countdown } from '../utils/time';
import AllowlistCheck from '../components/AllowlistCheck';
import { supabase } from '../lib/supabase';
import { formatNumber } from '../utils/format';

type AnyRow = Record<string, any>;

export default function SaleDetail() {
  const { id } = useParams();
  const [row, setRow] = useState<AnyRow | null>(null);
  const [err, setErr] = useState<string>('');
  const [loading, setLoading] = useState(true);

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
  const fmtq = (n: unknown) =>
    `${formatNumber(Number(n ?? NaN))} ${quote}`;

  // progress (mock until contracts)
  const soft = Number(row.soft_cap ?? NaN);
  const hard = Number(row.hard_cap ?? NaN);
  const raised = 0; // TODO: replace with on-chain
  const pct = Number.isFinite(hard) && hard > 0 ? Math.min(100, Math.max(0, (raised / hard) * 100)) : 0;

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
  const tokenPctToLP = Number(
    row.token_percent_to_lp ?? row.lp_token_percent_to_lp ?? row.tokenPercentToLP ?? NaN
  );
  const raisePctToLP = Number(
    row.percent_to_lp ?? row.lp_percent_to_lp ?? row.raise_percent_to_lp ?? NaN
  );
  const lockDays: number | undefined = row.lock_days ?? row.lockDays ?? undefined;
  const keepPct = Number(row.keep_pct ?? row.keepPct ?? NaN);
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
          <div>Soft Cap: <b>{fmtq(soft)}</b></div>
          <div>Hard Cap: <b>{Number.isFinite(hard) ? fmtq(hard) : '—'}</b></div>
          <div>Raised: <b>{fmtq(raised)}</b></div>
          <div>Quote: <b>{quote}</b></div>
        </div>

        <div className="progress-outer">
          <div className="progress-inner" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {/* Tokenomics / LP summary (reflects the new flow) */}
      <div className="card" style={{ padding: 12, display: 'grid', gap: 6 }}>
        <div style={{ fontWeight: 700, marginBottom: 4 }}>Tokenomics / LP</div>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontFamily: 'var(--font-data)' }}>
          <div>% Tokens → LP: <b>{Number.isFinite(tokenPctToLP) ? `${tokenPctToLP}%` : '—'}</b></div>
          <div>% Raise → LP: <b>{Number.isFinite(raisePctToLP) ? `${raisePctToLP}%` : '—'}</b></div>
          <div>Lock: <b>{lockDays ? `${lockDays} days` : '—'}</b></div>
          <div>Keep % of remainder: <b>{Number.isFinite(keepPct) ? `${keepPct}%` : '—'}</b></div>
          <div>Tokens for Sale: <b className="break-anywhere">
            {saleTokensPool ? formatNumber(Number(saleTokensPool)) : '—'}
          </b></div>
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
        <button className="button button-secondary" disabled>Buy (soon)</button>
        <button className="button" disabled>Claim (soon)</button>
      </div>
    </div>
  );
}
