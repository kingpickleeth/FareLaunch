import { Link } from 'react-router-dom'
import type { Sale } from '../types'

function PhaseBadge({phase}:{phase: Sale['phase']}) {
  const map = {
    active: 'badge badge-active',
    upcoming: 'badge badge-upcoming',
    failed: 'badge badge-failed',
    ended: 'badge'
  } as const
  const label = phase[0].toUpperCase() + phase.slice(1)
  return <span className={map[phase]}>{label}</span>
}

export default function SaleCard({ sale }: { sale: Sale }) {
  const progress = sale.hardCap ? Math.min(100, Math.round((sale.raised / sale.hardCap) * 100)) : 0

  return (
    <div className="card" style={{padding:16, display:'grid', gap:12}}>
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
        <div className="h2">{sale.name}</div>
        <PhaseBadge phase={sale.phase}/>
      </div>

      <div style={{display:'flex', gap:12, flexWrap:'wrap', fontFamily:'var(--font-data)'}}>
        <div>Kind: <b>{sale.kind}</b></div>
        <div>Soft Cap: <b>{sale.softCap}</b></div>
        {sale.hardCap !== undefined && <div>Hard Cap: <b>{sale.hardCap}</b></div>}
        <div>Raised: <b style={{color:'var(--fl-gold)'}}>{sale.raised}</b></div>
        {sale.price && <div>Price: <b>{sale.price}</b></div>}
        {sale.allowlist && <div className="badge" style={{background:'rgba(255,184,46,.15)'}}>Allowlist</div>}
      </div>

      {sale.hardCap !== undefined && (
        <div style={{background:'#13151b', borderRadius:999, height:10, overflow:'hidden'}}>
          <div style={{
            width:`${progress}%`, height:'100%', background:'linear-gradient(90deg, var(--fl-purple), var(--fl-aqua))'
          }}/>
        </div>
      )}

      <div style={{display:'flex', justifyContent:'space-between', gap:12}}>
        <Link to={`/sale/${sale.id}`} className="button button-secondary">View</Link>
        {sale.phase === 'active'
          ? <button className="button button-primary">Join</button>
          : <button className="button" style={{background:'#2a2d36', color:'#fff'}}>Details</button>}
      </div>
    </div>
  )
}
