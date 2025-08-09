// src/App.tsx
import { useEffect, useRef, useState } from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { useAccount } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import ProfileButton from './components/ProfileButton';
import { useConnectModal } from '@rainbow-me/rainbowkit';
// THEME -----------------------------------------------------------------------
type Theme = 'dark' | 'light';
const THEME_KEY = 'farelaunch:theme';

function getInitialTheme(): Theme {
  // explicit saved choice wins
  const saved = typeof window !== 'undefined' ? localStorage.getItem(THEME_KEY) : null;
  if (saved === 'light' || saved === 'dark') return saved as Theme;
  // else fall back to OS
  if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: light)').matches) {
    return 'light';
  }
  return 'dark';
}

function useTheme() {
  const [theme, setTheme] = useState<Theme>(getInitialTheme);

  useEffect(() => {
    // reflect to <html data-theme="light|dark">
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  // keep in sync if user changes OS theme (only when user hasn't explicitly chosen)
  useEffect(() => {
    const mql = window.matchMedia('(prefers-color-scheme: light)');
    const onChange = () => {
      const saved = localStorage.getItem(THEME_KEY);
      if (!saved) setTheme(mql.matches ? 'light' : 'dark');
    };
    mql.addEventListener?.('change', onChange);
    return () => mql.removeEventListener?.('change', onChange);
  }, []);

  return { theme, setTheme, toggle: () => setTheme(t => (t === 'dark' ? 'light' : 'dark')) };
}

function ThemeToggle({ theme, onToggle }: { theme: Theme; onToggle: () => void }) {
  // Simple bulb icon that “lights up” in light mode
  const isLight = theme === 'light';
  return (
    <button
      onClick={onToggle}
      aria-label={`Switch to ${isLight ? 'dark' : 'light'} mode`}
      title={`Switch to ${isLight ? 'dark' : 'light'} mode`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 40,
        height: 40,
        borderRadius: 12,
        border: '1px solid var(--border)',
        background: 'var(--btn-bg)',
        color: 'var(--text)',
        cursor: 'pointer',
        transition: 'transform .12s ease',
      }}
      onMouseDown={e => (e.currentTarget.style.transform = 'scale(0.97)')}
      onMouseUp={e => (e.currentTarget.style.transform = 'scale(1)')}
    >
      <svg width="22" height="22" viewBox="0 0 24 24" role="img" aria-hidden="true">
        {/* Bulb */}
        <path
          d="M9 18h6v1a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2v-1Z"
          fill="currentColor"
          opacity=".85"
        />
        <path
          d="M12 3a7 7 0 0 0-4.95 11.95c.44.44.95 1.36.95 2.05h8c0-.69.51-1.61.95-2.05A7 7 0 0 0 12 3Z"
          fill="currentColor"
          opacity={isLight ? '1' : '.6'}
        />
        {/* Little “glow” lines only in light mode */}
        {isLight && (
          <>
            <path d="M12 0v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M21 12h2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M1 12H3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M18.364 5.636 19.778 4.22" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M4.222 19.778 5.636 18.364" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </>
        )}
      </svg>
    </button>
  );
}

const PUBLIC_ROUTES = new Set<string>(['/']);

// shared link styles
// shared link styles (theme-driven)
const linkBase: React.CSSProperties = {
  color: 'var(--link, var(--text))',        // falls back to --text if --link not set
  textDecoration: 'none',
  padding: '8px 10px',
  borderRadius: 10,
  fontWeight: 600,
  opacity: 0.9,
};
const linkActive: React.CSSProperties = {
  ...linkBase,
  background: 'var(--link-active-bg, rgba(0,0,0,.08))',
  opacity: 1
};
const linkIdle: React.CSSProperties = {
  ...linkBase,
  background: 'transparent'
};

export default function App() {
  const { isConnected } = useAccount();
  const { pathname } = useLocation();
  const isPublic = PUBLIC_ROUTES.has(pathname);
  const { openConnectModal } = useConnectModal();
  const { theme, toggle } = useTheme();

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
<div className="app-shell" style={{ height: '100dvh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}> 
  
<nav ref={navRef}
style={{
display:'flex', justifyContent:'space-between', alignItems:'center',
padding:'16px 24px', background:'var(--nav-bg)',
backdropFilter:'blur(8px)',borderBottom:'1px solid var(--fl-gold)', zIndex:2000}}>
 {/* Brand */}
<div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
  <img
    src="https://dengdefense.xyz/taxi.svg"
    alt="FareLaunch logo"
    width={46}
    height={46}
    style={{
      display: 'block',
      borderRadius: 8,         // optional: matches your rounded vibe
      objectFit: 'contain',
    }}
  />

  <div
    style={{
      fontFamily: 'var(--font-head)',
      fontWeight: 800,
      color: 'var(--fl-gold)',
      fontSize: isMobile ? 30 : 30,
      lineHeight: 1,
    }}
  >
    FareLaunch
  </div>

  <span className="navsubtitle" style={{ fontSize: 12, color: 'var(--muted)', opacity: .9 }}>
    {' '}on ApeChain // Camelot
  </span>
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
           background: 'var(--menu-panel-bg, var(--fl-surface))',
           border: '1px solid var(--panel-border, var(--fl-border, rgba(255,255,255,.08)))',
           borderRadius: 12,
           minWidth: 180,
           padding: 6,
           display: 'grid',
           gap: 4,
           boxShadow: 'var(--shadow)',
           zIndex: 100
         }}
       >
       
            <NavLink
              to="/launch"
              style={({ isActive }) => ({
                ...linkIdle,
                display: 'block',
                background: isActive ? 'var(--item-active-bg, rgba(0,0,0,.08))' : 'transparent'
              })}
            >
              Create Launch
            </NavLink>
            <NavLink
              to="/locker"
              style={({ isActive }) => ({
                ...linkIdle,
                display: 'block',
                background: isActive ? 'var(--item-active-bg, rgba(0,0,0,.08))' : 'transparent'
              })}
            >
              Lock LP
            </NavLink>
          </div>
        )}
      </div>

      <NavLink to="/me" style={({ isActive }) => (isActive ? linkActive : linkIdle)}>Dashboard</NavLink>

  {/* THEME TOGGLE */}
  <ThemeToggle theme={theme} onToggle={toggle} />


      <div style={{ marginLeft: 8 }}>
        <ProfileButton onConnect={openConnectModal} />
      </div>
    </div>
  ) : (
    // ===== MOBILE: show hamburger =====
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <ThemeToggle theme={theme} onToggle={toggle} />
      <button
        aria-label="Toggle menu"
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen(v => !v)}
        style={{
          background: 'transparent',
          border: '1px solid var(--border)',
          color: 'var(--text)',
          borderRadius: 10,
          padding: isMobile ? '10px 14px' : '8px 10px',
          fontWeight: 700,
          cursor: 'pointer',
          fontSize: isMobile ? 22 : 18,
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
      zIndex: 1000,
      background: 'var(--scrim)',
      overflowY: 'auto',
      WebkitOverflowScrolling: 'touch',
      display: 'flex',
      flexDirection: 'column'
    }}
    onClick={() => setMenuOpen(false)} // click outside closes menu
  >
    {/* Spacer so panel starts just below navbar height */}
    <div style={{ height: navH }} />

    {/* Solid menu panel */}
    <div
      style={{
        background: '#0F1115',
        padding: 12,
        display: 'grid',
        gap: 6,
        borderBottom: '1px solid rgba(255,255,255,.06)',
        position: 'relative',
        zIndex: 1001 // keep menu content above the background scrim
      }}
      onClick={(e) => e.stopPropagation()} // prevent closing when clicking inside menu
    >
      {/* menu items here */}

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
           background: toolsMobileOpen
  ? 'var(--item-active-bg, rgba(0,0,0,.08))'
  : 'transparent',
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

      <div
  style={{
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
    justifyContent: 'flex-end'     // 👉 push ProfileButton to the right
  }}
>
  <ProfileButton
    onConnect={() => {
      setMenuOpen(false);
      openConnectModal?.();        // still opens modal if tapped while disconnected
    }}
  />
</div>

    </div>
  </div>
)}
   <main style={{ padding:'24px', flex:'1 1 auto', minHeight:0, overflowY:'auto',
   width:'100%', maxWidth:1200, margin:'0 auto' }}><Outlet />
      </main>

      <footer style={{ padding: '24px', color: 'var(--muted)', fontSize: 12 }}>
        © {new Date().getFullYear()} Farelaunch — Launch right. Launch fair.
      </footer>
    </div>
  );
}
