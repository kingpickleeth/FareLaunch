import { Link } from 'react-router-dom';

export default function Tools() {
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div className="h2">Tools</div>

      <div
        style={{
          display: 'grid',
          gap: 16,
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        }}
      >
        {/* Simulator */}
<Link to="/simulator" style={{ textDecoration: 'none', color: 'inherit' }}>
  <div
    className="card"
    style={{
      display: 'grid',
      gap: 10,
      padding: 18,
      borderRadius: 16,
      height: '100%',
      transition: 'transform .12s ease, box-shadow .12s ease, border-color .12s ease',
      border: '1px solid var(--card-border)',
    }}
    onMouseEnter={(e) => {
      const el = e.currentTarget as HTMLDivElement;
      el.style.transform = 'translateY(-2px)';
      el.style.boxShadow = 'var(--shadow)';
      el.style.borderColor = 'var(--border)';
    }}
    onMouseLeave={(e) => {
      const el = e.currentTarget as HTMLDivElement;
      el.style.transform = 'none';
      el.style.boxShadow = 'var(--shadow)';
      el.style.borderColor = 'var(--card-border)';
    }}
  >
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <div style={{ fontWeight: 800, fontSize: 18, color: 'var(--fl-purple)' /* or var(--fl-gold) */ }}>
        Launch Simulator
      </div>
      <svg width="28" height="28" viewBox="0 0 24 24" aria-hidden>
        <path fill="currentColor" d="M3 3v18h18M7 16l4-4 3 3 5-6" />
      </svg>
    </div>

    <div style={{ opacity: .85, color: 'var(--text)' }}>
      Model outcomes as a buyer or creator: caps, LP %, fees, rates, and what-if scenarios.
    </div>

    <div style={{ display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
      <span className="badge" style={{ background: 'var(--table-header-bg)', color: 'var(--text)' }}>Buyer</span>
      <span className="badge" style={{ background: 'var(--table-header-bg)', color: 'var(--text)' }}>Creator</span>
      <span className="badge" style={{ background: 'var(--table-header-bg)', color: 'var(--text)' }}>What-if</span>
    </div>
  </div>
</Link>
        {/* Create Launch */}
        <Link to="/launch" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div
            className="card"
            style={{
              display: 'grid',
              gap: 10,
              padding: 18,
              borderRadius: 16,
              height: '100%',
              transition: 'transform .12s ease, box-shadow .12s ease, border-color .12s ease',
              border: '1px solid var(--card-border)',
            }}
            onMouseEnter={(e) => {
              const el = e.currentTarget as HTMLDivElement;
              el.style.transform = 'translateY(-2px)';
              el.style.boxShadow = 'var(--shadow)';
              el.style.borderColor = 'var(--border)';
            }}
            onMouseLeave={(e) => {
              const el = e.currentTarget as HTMLDivElement;
              el.style.transform = 'none';
              el.style.boxShadow = 'var(--shadow)'; // keep consistent shadow token
              el.style.borderColor = 'var(--card-border)';
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontWeight: 800, fontSize: 18, color: 'var(--fl-purple)' }}>Create FareLaunch</div>
              <svg width="28" height="28" viewBox="0 0 24 24" aria-hidden>
                <path fill="currentColor" d="M5 12h14M13 5l7 7-7 7" />
              </svg>
            </div>

            <div style={{ opacity: .85, color: 'var(--text)' }}>
              Spin up a fair-launch sale on ApeChain (Camelot), set caps, schedule, allowlist, LP & fees.
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
              <span className="badge" style={{ background: 'var(--table-header-bg)', color: 'var(--text)' }}>Wizard</span>
              <span className="badge" style={{ background: 'var(--table-header-bg)', color: 'var(--text)' }}>Allowlist</span>
              <span className="badge" style={{ background: 'var(--table-header-bg)', color: 'var(--text)' }}>LP Auto-lock</span>
            </div>
          </div>
        </Link>

        {/* Create ERC20 */}
        <Link to="/create-erc20" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div
            className="card"
            style={{
              display: 'grid',
              gap: 10,
              padding: 18,
              borderRadius: 16,
              height: '100%',
              transition: 'transform .12s ease, box-shadow .12s ease, border-color .12s ease',
              border: '1px solid var(--card-border)',
            }}
            onMouseEnter={(e) => {
              const el = e.currentTarget as HTMLDivElement;
              el.style.transform = 'translateY(-2px)';
              el.style.boxShadow = 'var(--shadow)';
              el.style.borderColor = 'var(--border)';
            }}
            onMouseLeave={(e) => {
              const el = e.currentTarget as HTMLDivElement;
              el.style.transform = 'none';
              el.style.boxShadow = 'var(--shadow)';
              el.style.borderColor = 'var(--card-border)';
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontWeight: 800, fontSize: 18, color: 'var(--fl-purple)' }}>Create ERC20</div>
              <svg width="28" height="28" viewBox="0 0 24 24" aria-hidden>
                <path fill="currentColor" d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm1 15h-2v-2h2zm0-4h-2V7h2z" />
              </svg>
            </div>

            <div style={{ opacity: .85, color: 'var(--text)' }}>
              Deploy your own ERC20 token on ApeChain with custom name, symbol, supply, and settings.
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
              <span className="badge" style={{ background: 'var(--table-header-bg)', color: 'var(--text)' }}>Token</span>
              <span className="badge" style={{ background: 'var(--table-header-bg)', color: 'var(--text)' }}>Customizable</span>
            </div>
          </div>
        </Link>
        {/* Lock LP */}
        <Link to="/locker" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div
            className="card"
            style={{
              display: 'grid',
              gap: 10,
              padding: 18,
              borderRadius: 16,
              height: '100%',
              transition: 'transform .12s ease, box-shadow .12s ease, border-color .12s ease',
              border: '1px solid var(--card-border)',
            }}
            onMouseEnter={(e) => {
              const el = e.currentTarget as HTMLDivElement;
              el.style.transform = 'translateY(-2px)';
              el.style.boxShadow = 'var(--shadow)';
              el.style.borderColor = 'var(--border)';
            }}
            onMouseLeave={(e) => {
              const el = e.currentTarget as HTMLDivElement;
              el.style.transform = 'none';
              el.style.boxShadow = 'var(--shadow)';
              el.style.borderColor = 'var(--card-border)';
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontWeight: 800, fontSize: 18, color: 'var(--fl-purple)' }}>Liquidity Locker</div>
              <svg width="28" height="28" viewBox="0 0 24 24" aria-hidden>
                <path
                  fill="currentColor"
                  d="M12 1a5 5 0 00-5 5v3H6a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2v-8a2 2 0 00-2-2h-1V6a5 5 0 00-5-5zm-3 8V6a3 3 0 016 0v3H9z"
                />
              </svg>
            </div>

            <div style={{ opacity: .85, color: 'var(--text)' }}>
              Bring your existing token’s LP and lock it for a chosen period. Simple, transparent, auditable.
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
              <span className="badge" style={{ background: 'var(--table-header-bg)', color: 'var(--text)' }}>Camelot</span>
              <span className="badge" style={{ background: 'var(--table-header-bg)', color: 'var(--text)' }}>Timelock</span>
              <span className="badge" style={{ background: 'var(--table-header-bg)', color: 'var(--text)' }}>Receipts</span>
            </div>
          </div>
        </Link>
        {/* FareDrop */}
        <Link to="/faredrop" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div
            className="card"
            style={{
              display: 'grid',
              gap: 10,
              padding: 18,
              borderRadius: 16,
              height: '100%',
              transition: 'transform .12s ease, box-shadow .12s ease, border-color .12s ease',
              border: '1px solid var(--card-border)',
            }}
            onMouseEnter={(e) => {
              const el = e.currentTarget as HTMLDivElement;
              el.style.transform = 'translateY(-2px)';
              el.style.boxShadow = 'var(--shadow)';
              el.style.borderColor = 'var(--border)';
            }}
            onMouseLeave={(e) => {
              const el = e.currentTarget as HTMLDivElement;
              el.style.transform = 'none';
              el.style.boxShadow = 'var(--shadow)';
              el.style.borderColor = 'var(--card-border)';
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontWeight: 800, fontSize: 18, color: 'var(--fl-purple)' }}>FareDrop</div>
              <svg width="28" height="28" viewBox="0 0 24 24" aria-hidden>
                <path fill="currentColor" d="M16 13v8H8v-8H5l7-8 7 8h-3z" />
              </svg>
            </div>

            <div style={{ opacity: .85, color: 'var(--text)' }}>
              Batch airdrop native tokens or ERC20s to multiple recipients in one transaction.
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
              <span className="badge" style={{ background: 'var(--table-header-bg)', color: 'var(--text)' }}>Airdrop</span>
              <span className="badge" style={{ background: 'var(--table-header-bg)', color: 'var(--text)' }}>Batch</span>
            </div>
          </div>
        </Link>
      </div>
    </div>
  );
}
