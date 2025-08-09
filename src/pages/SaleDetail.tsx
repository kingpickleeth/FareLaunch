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
      await supabase
        .from('launches')
        .update({ status: newPhase })
        .eq('id', row.id);

      lastPhaseSentRef.current = newPhase;
      if (!cancelled) setRow(prev => (prev ? { ...prev, status: newPhase } : prev));
    })();

    return () => { cancelled = true; };
  }, [row?.id, row?.start_at, row?.end_at, row?.status, tick]);

  // ---- Early returns ----
  if (loading) return <div style={{ padding: 24 }}>Loading…</div>;
  if (err) return <div style={{ padding: 24, color: 'tomato' }}>Error: {err}</div>;
  if (!row) return <div style={{ padding: 24 }}>Sale not found.</div>;

  // Derived display values
  const start = row.start_at ? new Date(row.start_at) : null;
  const end = row.end_at ? new Date(row.end_at) : null;

  const phase = salePhase(Date.now(), row.start_at, row.end_at);
  const timeToShow =
    phase === 'upcoming' ? countdown(row.start_at)
    : phase === 'active' ? countdown(row.end_at)
    : null;

  // progress (mock until contracts)
  const soft = Number(row.soft_cap ?? NaN);
  const hard = Number(row.hard_cap ?? NaN);
  const raised = 0; // TODO: replace with on-chain
  const pct = Number.isFinite(hard) && hard > 0 ? Math.min(100, Math.max(0, (raised / hard) * 100)) : 0;

  const statusStyle: React.CSSProperties = (() => {
    switch (phase) {
      case 'active':   return { background: 'rgba(46,204,113,.15)', color: '#2ecc71' };
      case 'upcoming': return { background: 'rgba(52,152,219,.15)', color: '#3498db' };
      case 'ended':    return { background: 'rgba(127,140,141,.15)', color: '#95a5a6' };
      default:         return { background: 'rgba(241,196,15,.15)', color: '#f1c40f' };
    }
  })();

  return (
    <div className="sale-detail" style={{ display: 'grid', gap: 16 }}>
      {/* Header */}
      <div className="sale-header">
        {row.logo_url
          ? <img src={row.logo_url} alt="" className="sale-logo" />
          : <div className="sale-logo placeholder" />}
        <div className="sale-title">
          <div className="h1 break-anywhere">
            {row.name ?? 'Untitled'} <span style={{ opacity: .7 }}>({row.token_symbol ?? '—'})</span>
          </div>
          <div className="sale-creator">by <span className="break-anywhere">{row.creator_wallet ?? '—'}</span></div>
        </div>
      </div>

      {/* Status + countdown + progress */}
      <div className="card" style={{ padding: 12, display: 'grid', gap: 10 }}>
        <div className="meta-line">
          <span className="badge" style={{ ...statusStyle, padding: '2px 8px', borderRadius: 999, textTransform: 'capitalize' }}>
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
        <div>Soft Cap: <b>{formatNumber(soft)} $APE</b></div>
        <div>Hard Cap: <b>{formatNumber(hard)} $APE</b></div>
          <div>Raised: <b>{raised}</b></div>
          <div>Quote: <b>{row.quote ?? 'WAPE'}</b></div>
        </div>

        <div className="progress-outer">
          <div className="progress-inner" style={{ width: `${pct}%` }} />
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

      {/* Allowlist (client demo) */}
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
