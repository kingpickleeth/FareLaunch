export default function Locker() {
  return (
    <div className="card" style={{padding:16, display:'grid', gap:12}}>
      <div className="h2">LP Locker</div>
      <p>Lock LP tokens from any pair. Choose duration (preset), beneficiary, and confirm.</p>
      <button className="button button-secondary">Lock LP</button>
    </div>
  )
}
