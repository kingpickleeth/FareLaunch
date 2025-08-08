import { Link } from 'react-router-dom';

export default function Tools() {
  return (
    <div style={{ display:'grid', gap:16 }}>
      <div className="h2">Tools</div>

      <div
        style={{
          display: 'grid',
          gap: 16,
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        }}
      >
        {/* Create Launch */}
        <Link
          to="/launch"
          style={{
            textDecoration: 'none',
            color: 'inherit',
          }}
        >
          <div
            className="card"
            style={{
              display: 'grid',
              gap: 10,
              padding: 18,
              borderRadius: 16,
              height: '100%',
              transition: 'transform .12s ease, box-shadow .12s ease, border-color .12s ease',
              border: '1px solid rgba(255,255,255,.08)',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)';
              (e.currentTarget as HTMLDivElement).style.boxShadow = '0 8px 24px rgba(0,0,0,.35)';
              (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(255,255,255,.15)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLDivElement).style.transform = 'none';
              (e.currentTarget as HTMLDivElement).style.boxShadow = 'none';
              (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(255,255,255,.08)';
            }}
          >
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <div style={{ fontWeight: 800, fontSize: 18 }}>Create Launch</div>
              <svg width="28" height="28" viewBox="0 0 24 24" aria-hidden>
                <path fill="currentColor" d="M5 12h14M13 5l7 7-7 7" />
              </svg>
            </div>
            <div style={{ opacity:.85 }}>
              Spin up a fair-launch sale on ApeChain (Camelot), set caps, schedule, allowlist, LP & fees.
            </div>
            <div style={{ display:'flex', gap:8, marginTop:6, flexWrap:'wrap' }}>
              <span className="badge" style={{ background:'#2a2d36' }}>Wizard</span>
              <span className="badge" style={{ background:'#2a2d36' }}>Allowlist</span>
              <span className="badge" style={{ background:'#2a2d36' }}>LP Auto-lock</span>
            </div>
          </div>
        </Link>

        {/* Lock LP */}
        <Link
          to="/locker"
          style={{
            textDecoration: 'none',
            color: 'inherit',
          }}
        >
          <div
            className="card"
            style={{
              display: 'grid',
              gap: 10,
              padding: 18,
              borderRadius: 16,
              height: '100%',
              transition: 'transform .12s ease, box-shadow .12s ease, border-color .12s ease',
              border: '1px solid rgba(255,255,255,.08)',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)';
              (e.currentTarget as HTMLDivElement).style.boxShadow = '0 8px 24px rgba(0,0,0,.35)';
              (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(255,255,255,.15)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLDivElement).style.transform = 'none';
              (e.currentTarget as HTMLDivElement).style.boxShadow = 'none';
              (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(255,255,255,.08)';
            }}
          >
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <div style={{ fontWeight: 800, fontSize: 18 }}>Lock LP</div>
              <svg width="28" height="28" viewBox="0 0 24 24" aria-hidden>
                <path fill="currentColor" d="M12 1a5 5 0 00-5 5v3H6a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2v-8a2 2 0 00-2-2h-1V6a5 5 0 00-5-5zm-3 8V6a3 3 0 016 0v3H9z" />
              </svg>
            </div>
            <div style={{ opacity:.85 }}>
              Bring your existing token’s LP and lock it for a chosen period. Simple, transparent, auditable.
            </div>
            <div style={{ display:'flex', gap:8, marginTop:6, flexWrap:'wrap' }}>
              <span className="badge" style={{ background:'#2a2d36' }}>Camelot</span>
              <span className="badge" style={{ background:'#2a2d36' }}>Timelock</span>
              <span className="badge" style={{ background:'#2a2d36' }}>Receipts</span>
            </div>
          </div>
        </Link>
      </div>
    </div>
  );
}
