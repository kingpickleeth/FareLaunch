// src/App.tsx
import { useEffect, useRef, useState } from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { useAccount } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import ProfileButton from './components/ProfileButton';
import { useConnectModal } from '@rainbow-me/rainbowkit';

const PUBLIC_ROUTES = new Set<string>(['/']);

// shared link styles
const linkBase: React.CSSProperties = {
  color: '#fff',
  textDecoration: 'none',
  padding: '8px 10px',
  borderRadius: 10,
  fontWeight: 600,
  opacity: 0.9,
};
const linkActive: React.CSSProperties = { ...linkBase, background: 'rgba(255,255,255,.08)', opacity: 1 };
const linkIdle: React.CSSProperties = { ...linkBase, background: 'transparent' };

export default function App() {
  const { isConnected } = useAccount();
  const { pathname } = useLocation();
  const isPublic = PUBLIC_ROUTES.has(pathname);
  const { openConnectModal } = useConnectModal();

  // dropdown state
  const [toolsOpen, setToolsOpen] = useState(false);
  const toolsWrapRef = useRef<HTMLDivElement | null>(null);

  // close on outside click
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!toolsWrapRef.current) return;
      if (!toolsWrapRef.current.contains(e.target as Node)) setToolsOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  if (!isConnected && !isPublic) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, textAlign: 'center' }}>
        <div className="card" style={{ padding: 24, maxWidth: 420, display: 'grid', gap: 12 }}>
          <div className="h2">Connect to continue</div>
          <div style={{ opacity: .8 }}>You need to connect your wallet to access Farelaunch.</div>
          <div style={{ justifySelf: 'center', marginTop: 8 }}>
            <ConnectButton chainStatus="icon" showBalance={false} accountStatus="address" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100%', display: 'flex', flexDirection: 'column' }}>
      <nav style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '16px 24px', position: 'sticky', top: 0, background: 'rgba(15,17,21,.7)',
        backdropFilter: 'blur(8px)', borderBottom: '1px solid rgba(255,255,255,.06)', zIndex: 50
      }}>
        {/* Brand */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <div style={{ fontFamily: 'var(--font-head)', fontWeight: 800, color: 'var(--fl-gold)', fontSize: 22 }}>
            Farelaunch
          </div>
          <span style={{ fontSize: 12, opacity: .7 }}> on ApeChain // Camelot</span>
        </div>

        {/* Nav */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <NavLink to="/" style={({ isActive }) => (isActive ? linkActive : linkIdle)}>Explore</NavLink>

          {/* Tools link + hover dropdown (no button) */}
          <div
            ref={toolsWrapRef}
            style={{ position: 'relative' }}
            onMouseEnter={() => setToolsOpen(true)}
            onMouseLeave={() => setToolsOpen(false)}
          >
            <NavLink
              to="/tools"
              style={({ isActive }) => (isActive ? linkActive : linkIdle)}
            >
              Tools ▾
            </NavLink>

            {toolsOpen && (
              <div
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 6px)',
                  left: 0,
                  background: '#0f1115',
                  border: '1px solid rgba(255,255,255,.08)',
                  borderRadius: 12,
                  minWidth: 180,
                  padding: 6,
                  display: 'grid',
                  gap: 4,
                  boxShadow: '0 6px 24px rgba(0,0,0,.35)',
                  zIndex: 100
                }}
              >
                <NavLink
                  to="/launch"
                  style={({ isActive }) => ({
                    ...linkIdle,
                    display: 'block',
                    background: isActive ? 'rgba(255,255,255,.08)' : 'transparent'
                  })}
                >
                  Create Launch
                </NavLink>
                <NavLink
                  to="/locker"
                  style={({ isActive }) => ({
                    ...linkIdle,
                    display: 'block',
                    background: isActive ? 'rgba(255,255,255,.08)' : 'transparent'
                  })}
                >
                  Lock LP
                </NavLink>
              </div>
            )}
          </div>

          <div style={{ marginLeft: 8 }}>
  <ProfileButton onConnect={openConnectModal} />
</div>
        </div>
      </nav>

      <main style={{ padding: '24px', flex: 1, width: '100%', maxWidth: 1200, margin: '0 auto' }}>
        <Outlet />
      </main>

      <footer style={{ padding: '24px', opacity: .7, fontSize: 12 }}>
        © {new Date().getFullYear()} Farelaunch — Launch right. Launch fair.
      </footer>
    </div>
  );
}
