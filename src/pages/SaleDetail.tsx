// src/pages/SaleDetail.tsx
import { useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getLaunch } from '../data/launches';
import { salePhase, countdown } from '../utils/time';
import AllowlistCheck from '../components/AllowlistCheck';
import { supabase } from '../lib/supabase';

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
    console.log('[SaleDetail] Fetching launch with id:', id);
    setLoading(true);
    getLaunch(id)
      .then((r) => {
        console.log('[SaleDetail] Launch fetched:', r);
        setRow(r);
      })
      .catch((e) => {
        console.error('[SaleDetail] Error fetching launch:', e);
        setErr(e?.message ?? String(e));
      })
      .finally(() => setLoading(false));
  }, [id]);

 // Update Supabase status when computed phase differs from DB row.status
const lastPhaseSentRef = useRef<string | null>(null);
useEffect(() => {
  if (!row?.id) {
    console.log('[SaleDetail] No row.id, skipping status update');
    return;
  }

  const newPhase = salePhase(Date.now(), row.start_at, row.end_at); // 'upcoming' | 'active' | 'ended' | 'tba'
  console.log('[SaleDetail] Current phase calculation:', {
    now: new Date().toISOString(),
    start_at: row.start_at,
    end_at: row.end_at,
    newPhase,
    dbPhase: row.status,
    lastPhaseSent: lastPhaseSentRef.current,
    rowId: row.id,
  });

  if (!newPhase || newPhase === 'tba') return;
  if (newPhase === row.status) return;
  if (newPhase === lastPhaseSentRef.current) return;

  let cancelled = false;

  (async () => {
    // (Optional) log auth; it's fine if there's no session
    const { data: userInfo, error: authErr } = await supabase.auth.getUser();
    if (authErr) console.warn('[SaleDetail] auth.getUser error (expected if anon):', authErr.message);
    console.log('[SaleDetail] Auth user for update:', userInfo?.user?.id ?? null);

    // 1) Minimal UPDATE (no returning). This avoids RLS “returning” issues.
    console.log('[SaleDetail] UPDATE (minimal) →', newPhase);
    const { error: updErr } = await supabase
      .from('launches')      // 🔁 make sure this is your table
      .update({ status: newPhase })
      .eq('id', row.id);     // 🔁 make sure 'id' is the correct PK column

    if (updErr) {
      console.error('[SaleDetail] UPDATE failed:', updErr);
      return;
    }
    console.log('[SaleDetail] UPDATE sent successfully (no return body).');

    // 2) Update local UI immediately so it reflects the new phase
    lastPhaseSentRef.current = newPhase;
    if (!cancelled) {
      setRow(prev => (prev ? { ...prev, status: newPhase } : prev));
    }

    // 3) (Optional) Try to verify with a fresh SELECT; may still be blocked by RLS post-update
    const { data: verify, error: verifyErr } = await supabase
      .from('launches')
      .select('id,status')
      .eq('id', row.id)
      .maybeSingle();

    if (verifyErr) {
      console.warn('[SaleDetail] Post-update SELECT error (likely RLS):', verifyErr.message);
    } else {
      console.log('[SaleDetail] Post-update SELECT:', verify);
    }
  })();

  return () => { cancelled = true; };
}, [row?.id, row?.start_at, row?.end_at, row?.status, tick]);


  // ---- Early returns (keep AFTER all hooks) ----
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
    <div style={{ display: 'grid', gap: 16 }}>
      {/* Header */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        {row.logo_url
          ? <img src={row.logo_url} alt="" width={56} height={56} style={{ borderRadius: 12, objectFit: 'cover' }} />
          : <div style={{ width: 56, height: 56, borderRadius: 12, background: '#2a2d36' }} />}
        <div>
          <div className="h1">
            {row.name ?? 'Untitled'} <span style={{ opacity: .7 }}>({row.token_symbol ?? '—'})</span>
          </div>
          <div style={{ opacity: .75, fontSize: 12 }}>by {row.creator_wallet ?? '—'}</div>
        </div>
      </div>

      {/* Status + countdown + progress */}
      <div className="card" style={{ padding: 12, display: 'grid', gap: 10 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span className="badge" style={{ ...statusStyle, padding: '2px 8px', borderRadius: 999, textTransform: 'capitalize' }}>
            {phase}
          </span>
          <span style={{ opacity: .85 }}>
            Window: <b>{start?.toLocaleString() ?? 'TBA'}</b> → <b>{end?.toLocaleString() ?? 'TBA'}</b>
          </span>
        </div>

        {timeToShow && (
          <div>
            {phase === 'upcoming' ? 'Starts in' : 'Ends in'}:{' '}
            <b>{timeToShow.d}d {timeToShow.h}h {timeToShow.m}m {timeToShow.s}s</b>
          </div>
        )}

        <div style={{ display: 'flex', gap: 12, alignItems: 'baseline', flexWrap: 'wrap', fontFamily: 'var(--font-data)' }}>
          <div>Raised: <b>{raised}</b></div>
          <div>Soft: <b>{Number.isFinite(soft) ? soft : '—'}</b></div>
          <div>Hard: <b>{Number.isFinite(hard) ? hard : '—'}</b></div>
          <div>Quote: <b>{row.quote ?? 'WAPE'}</b></div>
        </div>

        <div style={{ height: 8, borderRadius: 999, background: '#2a2d36', overflow: 'hidden' }}>
          <div style={{ width: `${pct}%`, height: '100%', background: 'var(--fl-purple)' }} />
        </div>
      </div>

      {/* About / links */}
      <div className="card" style={{ padding: 12, display: 'grid', gap: 6 }}>
        <div>Website: {row.website ? <a href={row.website} target="_blank" rel="noreferrer">{row.website}</a> : '—'}</div>
        <div>Twitter: {row.twitter ? <a href={row.twitter} target="_blank" rel="noreferrer">{row.twitter}</a> : '—'}</div>
        <div>Description:</div>
        <div style={{ opacity: .85 }}>{row.description || '—'}</div>
      </div>

      {/* Allowlist (client demo) */}
      <AllowlistCheck saleId={row.id} root={row.allowlist_root} />

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8 }}>
        <Link className="button" to="/">← Back</Link>
        <button className="button button-secondary" disabled>Buy (soon)</button>
        <button className="button" disabled>Claim (soon)</button>
      </div>
    </div>
  );
}
