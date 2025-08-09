import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAccount } from 'wagmi';
import { listByCreator } from '../data/launches';

type Row = {
  id: string;
  name: string | null;
  token_symbol: string | null;
  status: string;
  start_at: string | null;
  end_at: string | null;
  soft_cap: string | null;
  hard_cap: string | null;
  updated_at: string | null;
};

export default function MyLaunches() {
  const { address, isConnected } = useAccount();
  const nav = useNavigate();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [err, setErr] = useState<string>('');

  useEffect(() => {
    if (!isConnected) return;
    listByCreator(address!)
      .then(setRows)
      .catch(e => setErr(e?.message ?? String(e)));
  }, [isConnected, address]);

  const formatNoSeconds = (dateStr: string | null) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (!isConnected) {
    return (
      <div className="card" style={{ padding: 16 }}>
        <div className="h2">My Launches</div>
        <div style={{ opacity:.8, marginTop:8 }}>Connect your wallet to view your drafts and launches.</div>
      </div>
    );
  }

  if (err) return <div style={{ color:'tomato', padding:16 }}>Error: {err}</div>;
  if (!rows) return <div style={{ padding:16 }}>Loading…</div>;

  return (
    <div style={{ display:'grid', gap:16 }}>
      <div className="h2">My Launches</div>

      <div style={{ display:'flex', justifyContent:'flex-end' }}>
        <button className="button button-secondary" onClick={() => nav('/launch')}>+ New Launch</button>
      </div>

      {rows.length === 0 ? (
        <div className="card" style={{ padding:16, opacity:.85 }}>
          You have no launches yet. Click “New Launch” to start.
        </div>
      ) : (
        <div className="card" style={{ padding:0, overflow:'hidden' }}>
          <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr 1fr 120px', gap:0, borderBottom:'1px solid rgba(255,255,255,.06)', padding:'10px 12px', fontSize:12, opacity:.8 }}>
            <div>Project</div><div>Status</div><div>Start</div><div>End</div><div style={{ display:'flex', gap:8, justifyContent: 'center' }}> Actions</div>
          </div>
          {rows.map(r => (
            <div key={r.id} style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr 1fr 120px', gap:0, padding:'12px', borderBottom:'1px solid rgba(255,255,255,.06)' }}>
              <div>
                <div style={{ fontWeight:700 }}>{r.name || 'Untitled'} <span style={{ opacity:.7 }}>({r.token_symbol || '—'})</span></div>
                <div style={{ opacity:.6, fontSize:12 }}>Updated: {formatNoSeconds(r.updated_at)}</div>
              </div>
              <div style={{ textTransform:'capitalize' }}>{r.status}</div>
              <div>{formatNoSeconds(r.start_at)}</div>
              <div>{formatNoSeconds(r.end_at)}</div>
              <div style={{ display:'flex', gap:8, justifyContent: 'center' }}>
                <Link className="button" to={`/sale/${r.id}`}>View</Link>
                {r.status === 'draft' && (
                  <Link className="button" to={`/launch?id=${r.id}`}>Edit</Link>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
