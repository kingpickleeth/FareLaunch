import { useParams, Link } from 'react-router-dom'
import { sales } from '../mock/sales'
import SaleCard from '../components/SaleCard'

export default function SaleDetail() {
  const { id } = useParams()
  const sale = sales.find(s => s.id === id)
  if (!sale) return <div>Sale not found.</div>
  return (
    <div style={{display:'grid', gap:16}}>
      <Link to="/" className="badge" style={{background:'#2a2d36', width:'fit-content'}}>← Back</Link>
      <SaleCard sale={sale}/>
      <div className="card" style={{padding:16}}>
        <div className="h2">About</div>
        <p>Project description, tokenomics, timelines, and links will go here.</p>
      </div>
    </div>
  )
}
