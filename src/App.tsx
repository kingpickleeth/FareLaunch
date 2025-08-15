// src/App.tsx
import { useEffect, useRef, useState } from 'react';
import { Outlet, NavLink, useLocation, Link } from 'react-router-dom';
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
  const isLight = theme === 'light';

  // geometry (keep even numbers to avoid subpixel blur)
  const TRACK_W = 60;
  const TRACK_H = 32;
  const PAD = 2;          // inner padding (left/right/top/bottom)
  const THUMB = TRACK_H - PAD * 2; // 28

  return (
    <button
      onClick={onToggle}
      aria-label={`Switch to ${isLight ? 'dark' : 'light'} mode`}
      title={`Switch to ${isLight ? 'dark' : 'light'} mode`}
      style={{ appearance: 'none', border: 0, background: 'transparent', padding: 0, cursor: 'pointer' }}
    >
      {/* Track */}
      <div
        style={{
          position: 'relative',
          width: TRACK_W,
          height: TRACK_H,
          borderRadius: TRACK_H / 2,
          border: '1px solid var(--border)',
          background: isLight
            ? 'linear-gradient(180deg, var(--fl-surface) 0%, rgba(0,0,0,0.1) 100%)'
            : 'linear-gradient(180deg, rgba(255,255,255,0.14) 0%, rgba(0,0,0,0.3) 100%)',
          boxShadow: isLight
            ? 'inset 0 1px 3px rgba(0,0,0,.25)'
            : '0 0 6px rgba(255,255,255,0.22), inset 0 1px 3px rgba(0,0,0,.7)',
          transition: 'background .2s ease, box-shadow .2s ease',
        }}
      >
        {/* Moon (left) */}
        <div
          style={{
            position: 'absolute',
            left: PAD + 6, // 8px from edge
            top: '50%',
            transform: 'translateY(-50%)',
            color: 'var(--fl-gold)',
            lineHeight: 0,
            pointerEvents: 'none',
            userSelect: 'none',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 1 0 9.79 9.79Z" />
          </svg>
        </div>

        {/* Sun (right) */}
        <div
          style={{
            position: 'absolute',
            right: PAD + 6, // 8px from edge
            top: '50%',
            transform: 'translateY(-50%)',
            color: 'var(--fl-gold)',
            lineHeight: 0,
            pointerEvents: 'none',
            userSelect: 'none',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12Z" />
            <path d="M12 1v3M12 20v3M4.22 4.22 6.34 6.34M17.66 17.66l2.12 2.12M1 12h3M20 12h3M4.22 19.78 6.34 17.66M17.66 6.34l2.12-2.12" stroke="currentColor" strokeWidth="2" fill="none"/>
          </svg>
        </div>

        {/* Thumb (perfectly centered) */}
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: isLight ? `calc(100% - ${PAD}px - ${THUMB}px)` : `${PAD}px`,
            width: THUMB,
            height: THUMB,
            transform: 'translateY(-50%)',
            borderRadius: THUMB / 2,
            background: isLight ? 'var(--fl-gold)' : '#fff',
            boxShadow: isLight
              ? '0 2px 6px rgba(0,0,0,.3), inset 0 0 0 1px rgba(0,0,0,.15)'
              : '0 2px 6px rgba(0,0,0,.85), 0 0 8px var(--fl-gold), inset 0 0 0 1px rgba(255,255,255,0.3)',
            transition: 'left .18s ease, background .18s ease, box-shadow .18s ease',
          }}
        />
      </div>
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
  // under: const { pathname } = useLocation();
const toolsActive =
/^\/(simulator|launch(?:-erc20)?|locker|faredrop)(\/|$)/.test(pathname);

  const { openConnectModal } = useConnectModal();
  const { theme, toggle } = useTheme();
  const closeTimer = useRef<number | null>(null);

  const openMenu = () => {
    if (closeTimer.current) { window.clearTimeout(closeTimer.current); closeTimer.current = null; }
    setToolsOpen(true);
  };
  const scheduleClose = () => {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => setToolsOpen(false), 150);
  };
  const cancelClose = () => {
    if (closeTimer.current) { window.clearTimeout(closeTimer.current); closeTimer.current = null; }
  };
  
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
const mainRef = useRef<HTMLElement | null>(null);   // ✅ add this
const [navH, setNavH] = useState(0);
useEffect(() => {
  const navEl = navRef.current;
  const scroller = mainRef.current || document.documentElement; // fallback

  if (!navEl || !scroller) return;

  const onScroll = () => {
    const max = scroller.scrollHeight - scroller.clientHeight;
    const t = max > 0 ? (scroller.scrollTop / max) : 0;
    navEl.style.setProperty('--p', `${Math.round(t * 100)}%`);
  };

  onScroll();
  scroller.addEventListener('scroll', onScroll, { passive: true });
  return () => scroller.removeEventListener('scroll', onScroll);
}, []);

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
  position: 'relative', 
display:'flex', justifyContent:'space-between', alignItems:'center',
padding:'16px 24px', background:'var(--nav-bg)',
backdropFilter:'blur(8px)', zIndex:2000}}>
 {/* Brand */}
{/* Brand */}
<Link
  to="/"
  aria-label="Go to homepage"
  style={{
    position: 'relative',
    display: 'flex',
    gap: 12,
    alignItems: 'center',
    textDecoration: 'none',
    color: 'inherit',
    cursor: 'pointer',
  }}
>
  <img
    src="https://dengdefense.xyz/taxi.svg"
    alt="FareLaunch logo"
    width={46}
    height={46}
    style={{
      display: 'block',
      borderRadius: 8,
      objectFit: 'contain',
    }}
  />

<div
  className="brand-glow"
  style={{
    fontFamily: 'var(--font-head)',
    fontWeight: 800,
    fontSize: isMobile ? 30 : 30,
    lineHeight: 1,
  }}
>
  FareLaunch
</div>

  <span className="navsubtitle" style={{ fontSize: 12, color: 'var(--muted)', opacity: .9 }}>
    {' '}on ApeChain // Camelot
  </span>
</Link>


  {/* Right side */}
  {!isMobile ? (
    // ===== DESKTOP: your original block unchanged =====
    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
     <NavLink
  to="/"
  className={({ isActive }) => `navbtn ${isActive ? 'is-active' : ''}`}
  onMouseDown={(e) => {
    const t = e.currentTarget as HTMLElement;
    const r = t.getBoundingClientRect();
    t.style.setProperty('--rx', `${e.clientX - r.left}px`);
    t.style.setProperty('--ry', `${e.clientY - r.top}px`);
    t.classList.add('do-ripple');
    // clear the ripple class after the anim
    setTimeout(() => t.classList.remove('do-ripple'), 420);
  }}
>
  Explore
</NavLink>


      {/* Tools link + hover dropdown (no button) */}
      <div
  ref={toolsWrapRef}
  style={{ position: 'relative' }}
  onMouseEnter={openMenu}
  onMouseLeave={scheduleClose}
  onKeyDown={(e) => { if (e.key === 'Escape') setToolsOpen(false); }}
  className="tools-wrap"
>
  <button
    type="button"
    className={`navbtn navbtn--plain ${toolsActive ? 'is-active' : ''}`}
    aria-haspopup="menu"
    aria-expanded={toolsOpen}
    onMouseDown={(e) => {
      const t = e.currentTarget as HTMLElement;
      const r = t.getBoundingClientRect();
      t.style.setProperty('--rx', `${e.clientX - r.left}px`);
      t.style.setProperty('--ry', `${e.clientY - r.top}px`);
      t.classList.add('do-ripple');
      setTimeout(() => t.classList.remove('do-ripple'), 420);
    }}
    onClick={() => setToolsOpen(v => !v)}
  >
    Tools ▾
  </button>

  <div
    className={`menu-card ${toolsOpen ? 'show' : ''}`}
    role="menu"
    aria-hidden={!toolsOpen}
    onMouseEnter={cancelClose}
    onMouseLeave={scheduleClose}
  >
    <NavLink to="/simulator"   className={({isActive}) => `menu-item${isActive ? ' is-active' : ''}`} role="menuitem">Launch Simulator</NavLink>
    <NavLink to="/launch"      className={({isActive}) => `menu-item${isActive ? ' is-active' : ''}`} role="menuitem">Create FareLaunch</NavLink>
    <NavLink to="/launch-erc20" className={({isActive}) => `menu-item${isActive ? ' is-active' : ''}`} role="menuitem">Create ERC20</NavLink>
    <NavLink to="/locker"      className={({isActive}) => `menu-item${isActive ? ' is-active' : ''}`} role="menuitem">Liquidity Locker</NavLink>
    <NavLink to="/faredrop"    className={({isActive}) => `menu-item${isActive ? ' is-active' : ''}`} role="menuitem">FareDrop</NavLink>
  </div>
</div>


      <NavLink to="/me" className={({ isActive }) => `navbtn ${isActive ? 'is-active' : ''}`}  onMouseDown={(e) => {
    const t = e.currentTarget as HTMLElement;
    const r = t.getBoundingClientRect();
    t.style.setProperty('--rx', `${e.clientX - r.left}px`);
    t.style.setProperty('--ry', `${e.clientY - r.top}px`);
    t.classList.add('do-ripple');
    // clear the ripple class after the anim
    setTimeout(() => t.classList.remove('do-ripple'), 420);
  }}
>Dashboard</NavLink>


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
   <div className="nav-underline" />
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
    <div style={{ height: navH, background: 'var(--menu-panel-bg, var(--fl-surface))' }} />

    {/* Solid menu panel */}
<div
  style={{
    background: 'var(--menu-panel-bg, var(--fl-surface))',
    color: 'var(--text)',
    padding: 12,
    display: 'grid',
    gap: 6,
    borderBottom: '1px solid var(--panel-border, var(--fl-border, var(--border)))',
    boxShadow: 'var(--shadow)',
    position: 'relative',
    zIndex: 1001
  }}
  onClick={(e) => e.stopPropagation()}
>

      {/* menu items here */}

      <NavLink
        to="/"
        style={({ isActive }) => (isActive ? linkActive : linkIdle)}
        onClick={() => setMenuOpen(false)}
      >
        Explore
      </NavLink>
      <div style={{ height: 1, background: 'var(--panel-border, var(--border))', opacity: .6, margin: '6px 0' }} />

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
        <div style={{ height: 1, background: 'var(--panel-border, var(--border))', opacity: .6, margin: '6px 0' }} />

        {toolsMobileOpen && (
          <div
            id="mobile-tools-submenu"
            style={{ display: 'grid', gap: 4, paddingLeft: 6, marginTop: 4 }}
          >
               <NavLink
              to="/simulator"
              style={({ isActive }) => (isActive ? linkActive : linkIdle)}
              onClick={() => {
                setToolsMobileOpen(false);
                setMenuOpen(false);
              }}
            >Launch Simulator</NavLink>
            <NavLink
              to="/launch"
              style={({ isActive }) => (isActive ? linkActive : linkIdle)}
              onClick={() => {
                setToolsMobileOpen(false);
                setMenuOpen(false);
              }}
            >
              Create FareLaunch
            </NavLink>
            <NavLink
  to="/launch-erc20"
  style={({ isActive }) => (isActive ? linkActive : linkIdle)}
  onClick={() => {
    setToolsMobileOpen(false);
    setMenuOpen(false);
  }}
>
  Create ERC20
</NavLink>

         
            <NavLink
              to="/locker"
              style={({ isActive }) => (isActive ? linkActive : linkIdle)}
              onClick={() => {
                setToolsMobileOpen(false);
                setMenuOpen(false);
              }}
            >
              Liquidity Locker
            </NavLink>
            <NavLink to="/faredrop" style={({ isActive }) => (isActive ? linkActive : linkIdle)} onClick={() => { setToolsMobileOpen(false); setMenuOpen(false); }}>
  FareDrop
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
<main
  ref={mainRef}
  /* ✅ attach */
  style={{
    padding:'24px',
    flex:'1 1 auto',
    minHeight:0,
    overflowY:'auto',
    width:'100%',
    maxWidth:1200,
    margin:'0 auto'
  }}
>

  <Outlet />
</main>

<footer style={{ padding: '24px', color: 'var(--muted)', fontSize: 12 }}>
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      flexWrap: 'nowrap',       // 👈 don’t wrap
      width: '100%',
      minWidth: 0,              // enable flex text truncation
    }}
  >
    <div
      style={{
        flex: '1 1 auto',
        minWidth: 0,            // 👈 required for ellipsis
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        opacity: 0.9,
      }}
    >
      © {new Date().getFullYear()} Farelaunch — Launch right. Launch fair.
    </div>

    {/* Right side toggle; never drops below on mobile */}
    <div style={{ flex: '0 0 auto' }}>
      <ThemeToggle theme={theme} onToggle={toggle} />
    </div>
  </div>
</footer>

    </div>
  );
}
