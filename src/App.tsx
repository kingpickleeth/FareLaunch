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
// mobile + mobile menu state
const [isMobile, setIsMobile] = useState<boolean>(() =>
  typeof window !== 'undefined' ? window.matchMedia('(max-width: 768px)').matches : false
);
const [menuOpen, setMenuOpen] = useState(false);
const [toolsMobileOpen, setToolsMobileOpen] = useState(false);
const navRef = useRef<HTMLDivElement | null>(null);
const [navH, setNavH] = useState(0);

useEffect(() => {
  const measure = () => {
    if (navRef.current) setNavH(navRef.current.getBoundingClientRect().height);
  };
  measure();
  window.addEventListener('resize', measure);
  return () => window.removeEventListener('resize', measure);
}, []);

useEffect(() => {
  const mq = window.matchMedia('(max-width: 768px)');
  const onChange = (e: MediaQueryListEvent) => setIsMobile(e.matches);
  mq.addEventListener('change', onChange);
  return () => mq.removeEventListener('change', onChange);
}, []);

// close mobile menu on route change
useEffect(() => {
  setMenuOpen(false);
  setToolsMobileOpen(false);
}, [pathname]);
useEffect(() => {
  if (isMobile && menuOpen) {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }
}, [isMobile, menuOpen]);

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
   <nav   ref={navRef}
  style={{
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  padding: '16px 24px', position: 'sticky', top: 0, background: 'rgba(15,17,21,.7)',
  backdropFilter: 'blur(8px)', borderBottom: '1px solid rgba(255,255,255,.06)', zIndex: 50
}}>
  {/* Brand */}
  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
  <div
  style={{
    fontFamily: 'var(--font-head)',
    fontWeight: 800,
    color: 'var(--fl-gold)',
    fontSize: isMobile ? 30 : 30,  // 📈 bigger on mobile
  }}
>
  FareLaunch
</div>

    <span style={{ fontSize: 12, opacity: .7 }}> on ApeChain // Camelot</span>
  </div>

  {/* Right side */}
  {!isMobile ? (
    // ===== DESKTOP: your original block unchanged =====
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

      <NavLink to="/me" style={({ isActive }) => (isActive ? linkActive : linkIdle)}>Dashboard</NavLink>

      <div style={{ marginLeft: 8 }}>
        <ProfileButton onConnect={openConnectModal} />
      </div>
    </div>
  ) : (
    // ===== MOBILE: show hamburger =====
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <button
        aria-label="Toggle menu"
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen(v => !v)}
        style={{
          background: 'transparent',
          border: '1px solid rgba(255,255,255,.15)',
          color: '#fff',
          borderRadius: 10,
          padding: isMobile ? '10px 14px' : '8px 10px',  // 📈 bigger touch area
          fontWeight: 700,
          cursor: 'pointer',
          fontSize: isMobile ? 22 : 18,    // 📈 bigger icon size

        }}
      >
        ☰
      </button>
    </div>
  )}
</nav>
{isMobile && menuOpen && (
  <div
    style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 1000,        // above page content & the sticky nav
      overflowY: 'auto',   // scroll menu if it gets tall
      WebkitOverflowScrolling: 'touch'
    }}
  >
    {/* Spacer so the panel starts just below the navbar height */}
    <div style={{ height: navH }} />

    {/* Solid menu panel */}
    <div
      style={{
        background: '#0F1115',
        padding: 12,
        display: 'grid',
        gap: 6,
        borderBottom: '1px solid rgba(255,255,255,.06)'
      }}
    >
      <NavLink
        to="/"
        style={({ isActive }) => (isActive ? linkActive : linkIdle)}
        onClick={() => setMenuOpen(false)}
      >
        Explore
      </NavLink>

      {/* Tools: button toggles submenu (no navigation) */}
      <div style={{ paddingTop: 6 }}>
        <button
          onClick={() => setToolsMobileOpen(v => !v)}
          aria-expanded={toolsMobileOpen}
          aria-controls="mobile-tools-submenu"
          style={{
            ...linkIdle,
            width: '100%',
            textAlign: 'left',
            background: toolsMobileOpen ? 'rgba(255,255,255,.08)' : 'transparent',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            font: 'inherit',
            fontWeight: 600
          }}
        >
          <span>Tools</span>
          <span>{toolsMobileOpen ? '▴' : '▾'}</span>
        </button>

        {toolsMobileOpen && (
          <div
            id="mobile-tools-submenu"
            style={{ display: 'grid', gap: 4, paddingLeft: 6, marginTop: 4 }}
          >
            <NavLink
              to="/launch"
              style={({ isActive }) => (isActive ? linkActive : linkIdle)}
              onClick={() => {
                setToolsMobileOpen(false);
                setMenuOpen(false);
              }}
            >
              Create Launch
            </NavLink>
            <NavLink
              to="/locker"
              style={({ isActive }) => (isActive ? linkActive : linkIdle)}
              onClick={() => {
                setToolsMobileOpen(false);
                setMenuOpen(false);
              }}
            >
              Lock LP
            </NavLink>
          </div>
        )}
      </div>

      <NavLink
        to="/me"
        style={({ isActive }) => (isActive ? linkActive : linkIdle)}
        onClick={() => setMenuOpen(false)}
      >
        Dashboard
      </NavLink>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
        <ProfileButton
          onConnect={() => {
            setMenuOpen(false);
            openConnectModal?.();
          }}
        />
        <div style={{ marginLeft: 'auto' }}>
          <ConnectButton chainStatus="icon" showBalance={false} accountStatus="avatar" />
        </div>
      </div>
    </div>
  </div>
)}
      <main style={{ padding: '24px', flex: 1, width: '100%', maxWidth: 1200, margin: '0 auto' }}>
        <Outlet />
      </main>

      <footer style={{ padding: '24px', opacity: .7, fontSize: 12 }}>
        © {new Date().getFullYear()} Farelaunch — Launch right. Launch fair.
      </footer>
    </div>
  );
}
