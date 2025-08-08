import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getLaunch } from '../data/launches';

export default function LaunchDetail() {
  const { id } = useParams();
  const [row, setRow] = useState<any>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!id) return;
    getLaunch(id).then(setRow).catch((e) => setErr(e?.message ?? String(e)));
  }, [id]);

  if (err) return <div style={{ padding: 24, color: 'tomato' }}>Error: {err}</div>;
  if (!row) return <div style={{ padding: 24 }}>Loading…</div>;

  const start = row.start_at ? new Date(row.start_at) : null;
  const end = row.end_at ? new Date(row.end_at) : null;

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        {row.logo_url
          ? <img src={row.logo_url} alt="" width={56} height={56} style={{ borderRadius: 12, objectFit: 'cover' }} />
          : <div style={{ width: 56, height: 56, borderRadius: 12, background: '#2a2d36' }} />}
        <div>
          <div className="h1">{row.name} <span style={{ opacity: .7 }}>({row.token_symbol})</span></div>
          <div style={{ opacity: .75, fontSize: 12 }}>by {row.creator_wallet}</div>
        </div>
      </div>

      <div className="card" style={{ padding: 12, display: 'grid', gap: 6 }}>
        <div>Status: <b>{row.status}</b></div>
        <div>Sale Window: <b>{start?.toLocaleString() ?? 'TBA'}</b> → <b>{end?.toLocaleString() ?? 'TBA'}</b></div>
        <div>Caps: Soft <b>{row.soft_cap ?? '—'}</b> • Hard <b>{row.hard_cap ?? '—'}</b> • Quote <b>{row.quote}</b></div>
      </div>

      <div className="card" style={{ padding: 12, display: 'grid', gap: 6 }}>
        <div>Website: {row.website ? <a href={row.website} target="_blank" rel="noreferrer">{row.website}</a> : '—'}</div>
        <div>Twitter: {row.twitter ? <a href={row.twitter} target="_blank" rel="noreferrer">{row.twitter}</a> : '—'}</div>
        <div>Description:</div>
        <div style={{ opacity: .85 }}>{row.description || '—'}</div>
      </div>
    </div>
  );
}
