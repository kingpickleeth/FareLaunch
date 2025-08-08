import { Outlet, NavLink } from 'react-router-dom'

export default function App() {
  return (
    <div style={{minHeight:'100%', display:'flex', flexDirection:'column'}}>
      <nav style={{
        display:'flex', justifyContent:'space-between', alignItems:'center',
        padding:'16px 24px', position:'sticky', top:0, background:'rgba(15,17,21,.7)',
        backdropFilter:'blur(8px)', borderBottom:'1px solid rgba(255,255,255,.06)'
      }}>
        <div style={{display:'flex', gap:12, alignItems:'center'}}>
          <div style={{fontFamily:'var(--font-head)', fontWeight:800, color:'var(--fl-gold)', fontSize:22}}>
            Farelaunch
          </div>
          <span style={{fontSize:12, opacity:.7}}>Camelot · ApeChain</span>
        </div>

        <div style={{display:'flex', gap:16}}>
        <NavLink
  to="/"
  className={({ isActive }) => (isActive ? 'badge badge-active' : 'badge')}
  style={({ isActive }) => (isActive ? {} : { background: 'transparent' })}>
  Explore
  </NavLink>
          <NavLink to="/launch" className="button button-secondary">Create Launch</NavLink>
          <NavLink to="/locker" className="button button-primary">Lock LP</NavLink>
        </div>
      </nav>

      <main style={{padding:'24px', flex:1, width:'100%', maxWidth:1200, margin:'0 auto'}}>
        <Outlet/>
      </main>

      <footer style={{padding:'24px', opacity:.7, fontSize:12}}>
        © {new Date().getFullYear()} Farelaunch — Launch right. Launch fair.
      </footer>
    </div>
  )
}
