import { useEffect, useState, useMemo } from 'react';
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

type SortKey = 'status' | 'start_at' | 'end_at';
type SortConfig = { key: SortKey; direction: 'asc' | 'desc' } | null;

export default function MyLaunches() {
  const { address, isConnected } = useAccount();
  const nav = useNavigate();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [err, setErr] = useState<string>('');
  const [sortConfig, setSortConfig] = useState<SortConfig>(null);

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

  const requestSort = (key: SortKey) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const sortedRows = useMemo(() => {
    if (!rows) return [];
    if (!sortConfig) return rows;
    const sorted = [...rows].sort((a, b) => {
      const aVal = a[sortConfig.key];
      const bVal = b[sortConfig.key];
      // Handle dates
      if (sortConfig.key === 'start_at' || sortConfig.key === 'end_at') {
        const aTime = aVal ? new Date(aVal).getTime() : 0;
        const bTime = bVal ? new Date(bVal).getTime() : 0;
        return sortConfig.direction === 'asc' ? aTime - bTime : bTime - aTime;
      }
      // Handle status (string)
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortConfig.direction === 'asc'
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }
      return 0;
    });
    return sorted;
  }, [rows, sortConfig]);

  if (!isConnected) {
    return (
      <div className="card" style={{ padding: 16 }}>
        <div className="h2">My Launches</div>
        <div style={{ color: 'var(--muted)', marginTop: 8 }}>
          Connect your wallet to view your drafts and launches.
        </div>
      </div>
    );
  }

  if (err) return <div style={{ color: 'var(--fl-danger)', padding: 16 }}>Error: {err}</div>;
  if (!rows) return <div style={{ padding: 16 }}>Loading…</div>;

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {/* Title + CTA on one row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <div className="h2" style={{ margin: 0 }}>My Launches</div>

        <button className="button button-secondary" onClick={() => nav('/launch')}>
          + New Launch
        </button>
      </div>

      {sortedRows.length === 0 ? (
        <div className="card" style={{ padding: 16, color: 'var(--muted)' }}>
          You have no launches yet. Click “New Launch” to start.
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {/* Header */}
          <div className="launch-header">
            <div>Project</div>
            <div
              style={{ cursor: 'pointer' }}
              onClick={() => requestSort('status')}
            >
              Status {sortConfig?.key === 'status' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
            </div>
            <div
              style={{ cursor: 'pointer' }}
              onClick={() => requestSort('start_at')}
            >
              Start {sortConfig?.key === 'start_at' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
            </div>
            <div
              style={{ cursor: 'pointer' }}
              onClick={() => requestSort('end_at')}
            >
              End {sortConfig?.key === 'end_at' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
            </div>
            <div className="center">Actions</div>
          </div>

          {/* Rows */}
          <div style={{ display: 'grid', gap: 8, padding: '8px' }}>
            {sortedRows.map((r) => (
              <div
                key={r.id}
                className="launch-row"
                style={{
                  border: '1px solid var(--table-border)',
                  borderRadius: 12,
                  padding: 12,
                  background: 'var(--table-row-bg)',
                }}
              >
                <div className="cell cell-project" style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontWeight: 800,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      color: 'var(--fl-gold)',
                    }}
                  >
                    {r.name || 'Untitled'}{' '}
                    <span style={{ color: 'var(--muted)', fontWeight: 600 }}>
                      ({r.token_symbol || '—'})
                    </span>
                  </div>
                  <div style={{ color: 'var(--muted)', fontSize: 12 }}>
                    Updated: {formatNoSeconds(r.updated_at)}
                  </div>
                </div>

                <div className="cell cell-status" style={{ color: 'var(--text)' }}>
                  <span className="cell-label" style={{ color: 'var(--muted)' }}>Status</span>
                  <span style={{ textTransform: 'capitalize', fontWeight: 700 }}>{r.status}</span>
                </div>

                <div className="cell" style={{ color: 'var(--text)' }}>
                  <span className="cell-label" style={{ color: 'var(--muted)' }}>Start</span>
                  {formatNoSeconds(r.start_at)}
                </div>

                <div className="cell" style={{ color: 'var(--text)' }}>
                  <span className="cell-label" style={{ color: 'var(--muted)' }}>End</span>
                  {formatNoSeconds(r.end_at)}
                </div>

                <div className="cell cell-actions" style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                  <Link className="button" to={`/sale/${r.id}`}>View</Link>
                  {r.status === 'draft' && (
                    <Link className="button" to={`/launch?id=${r.id}`}>Edit</Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
