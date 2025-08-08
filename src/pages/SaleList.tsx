import SaleCard from '../components/SaleCard'
import { sales } from '../mock/sales'

export default function SaleList() {
  return (
    <div style={{display:'grid', gap:16}}>
      <div className="h1">Explore Launches</div>
      <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(320px, 1fr))', gap:16}}>
        {sales.map(s => <SaleCard key={s.id} sale={s} />)}
      </div>
    </div>
  )
}
