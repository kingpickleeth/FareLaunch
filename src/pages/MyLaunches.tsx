// src/pages/MyLaunches.tsx
import { useEffect, useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAccount } from 'wagmi';
import { listByCreator } from '../data/launches';

type Row = {
  id: string;
  name: string | null;
  token_symbol: string | null;
  status: 'draft'|'created'|'upcoming'|'active'|'ended'|'failed'|'finalized'|string;
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
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
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
      {/* Title + CTA */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div className="h2" style={{ margin: 0 }}>My Launches</div>

        {/* Primary CTA always blue */}
        <button className="button button-primary" onClick={() => nav('/launch')}>
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
              style={{ cursor: 'pointer', color: sortConfig?.key === 'status' ? 'var(--role-primary)' : 'inherit' }}
              onClick={() => requestSort('status')}
            >
              Status {sortConfig?.key === 'status' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
            </div>
            <div
              style={{ cursor: 'pointer', color: sortConfig?.key === 'start_at' ? 'var(--role-primary)' : 'inherit' }}
              onClick={() => requestSort('start_at')}
            >
              Start {sortConfig?.key === 'start_at' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
            </div>
            <div
              style={{ cursor: 'pointer', color: sortConfig?.key === 'end_at' ? 'var(--role-primary)' : 'inherit' }}
              onClick={() => requestSort('end_at')}
            >
              End {sortConfig?.key === 'end_at' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
            </div>
            <div className="center">Actions</div>
          </div>

          {/* Rows */}
          <div style={{ display: 'grid', gap: 8, padding: '8px' }}>
            {sortedRows.map((r) => {
              // semantic accent per row (matches Explore)
              const accentVar =
                r.status === 'active'    ? 'var(--success)'
                : r.status === 'upcoming' ? 'var(--info)'
                : r.status === 'failed'   ? 'var(--fl-danger)'
                : /* finalized/ended/default */ 'var(--badge-muted-border, var(--border))';

              const rowStyle: React.CSSProperties = {
                border: '1px solid var(--table-border)',
                borderRadius: 12,
                padding: 12,
                background: 'var(--table-row-bg)',
                position: 'relative',
                transition: 'box-shadow .2s ease, transform .05s ease'
              };

              return (
                <div
                  key={r.id}
                  className="launch-row"
                  style={rowStyle}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLDivElement).style.boxShadow =
                      `0 8px 20px color-mix(in srgb, ${accentVar} 22%, transparent), var(--shadow)`;
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLDivElement).style.boxShadow = 'var(--shadow)';
                  }}
                >
                  {/* status stripe */}
                  <div
                    aria-hidden
                    style={{
                      position: 'absolute', left: 0, top: 0, bottom: 0, width: 4,
                      background: accentVar,
                      borderTopLeftRadius: 12, borderBottomLeftRadius: 12
                    }}
                  />

                  {/* Project / Meta */}
                  <div className="cell cell-project" style={{ minWidth: 0 }}>
                    <div
                      style={{
                        fontWeight: 800,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        color: 'var(--text)' // no gold in row titles
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

                  {/* Status pill */}
                  <div className="cell cell-status" style={{ color: 'var(--text)' }}>
                    <span className="cell-label" style={{ color: 'var(--muted)' }}>Status</span>
                    <StatusPill s={r.status} />
                  </div>

                  {/* Start */}
                  <div className="cell" style={{ color: 'var(--text)' }}>
                    <span className="cell-label" style={{ color: 'var(--muted)' }}>Start</span>
                    {formatNoSeconds(r.start_at)}
                  </div>

                  {/* End */}
                  <div className="cell" style={{ color: 'var(--text)' }}>
                    <span className="cell-label" style={{ color: 'var(--muted)' }}>End</span>
                    {formatNoSeconds(r.end_at)}
                  </div>

                  {/* Actions */}
                  <div className="cell cell-actions" style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                    <Link className="button button-primary" to={`/sale/${r.id}`}>View</Link>
                    {r.status === 'draft' && (
                      <Link className="button button-secondary" to={`/launch?id=${r.id}`}>Edit</Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* Local, role-aware status pill (same semantics as Explore) */
function StatusPill({ s }: { s: Row['status'] }) {
  const styles: Record<string, React.CSSProperties> = {
    active:     { background: 'var(--badge-success-bg, rgba(46,204,113,.15))', color: 'var(--success, #2ecc71)',   border: '1px solid var(--badge-success-border, rgba(46,204,113,.35))' },
    upcoming:   { background: 'var(--badge-info-bg, rgba(52,152,219,.15))',    color: 'var(--info, #3498db)',      border: '1px solid var(--badge-info-border, rgba(52,152,219,.35))' },
    ended:      { background: 'var(--badge-muted-bg, rgba(127,140,141,.15))',  color: 'var(--muted-fg, #95a5a6)',  border: '1px solid var(--badge-muted-border, rgba(127,140,141,.35))' },
    failed:     { background: 'var(--badge-danger-bg, rgba(231,76,60,.15))',   color: 'var(--fl-danger, #e74c3c)', border: '1px solid var(--badge-danger-border, rgba(231,76,60,.35))' },
    finalized:  { background: 'var(--badge-purple-bg, rgba(155,89,182,.15))',  color: 'var(--fl-purple, #9b59b6)', border: '1px solid var(--badge-purple-border, rgba(155,89,182,.35))' },
    created:    { background: 'var(--badge-warning-bg, rgba(241,196,15,.15))', color: 'var(--warning, #f1c40f)',   border: '1px solid var(--badge-warning-border, rgba(241,196,15,.35))' },
    draft:      { background: 'var(--badge-muted-bg, rgba(127,140,141,.15))',  color: 'var(--muted-fg, #95a5a6)',  border: '1px solid var(--badge-muted-border, rgba(127,140,141,.35))' },
  };
  const style = styles[String(s).toLowerCase()] || styles['created'];
  return (
    <span
      className="badge"
      style={{ ...style, padding: '2px 8px', borderRadius: 999, textTransform: 'capitalize', fontWeight: 700, fontFamily: 'var(--font-data)' }}
    >
      {String(s)}
    </span>
  );
}
