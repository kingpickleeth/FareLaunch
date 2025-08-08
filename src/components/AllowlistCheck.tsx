import { useMemo, useState } from 'react';
import { isAddress } from '../utils/merkle';

export default function AllowlistCheck({ root }: { root?: string | null }) {
  const [addr, setAddr] = useState('');
  const [eligible, setEligible] = useState<boolean | null>(null);

  const canCheck = useMemo(() => !!root && root.startsWith('0x') && root.length === 66, [root]);

  function check() {
    if (!canCheck) return;
    const a = addr.trim();
    if (!isAddress(a)) { setEligible(null); return; }
    // In MVP we don’t have the full list here; real check is contract-side using a proof.
    // For demo: just show that an allowlist exists and hint “proof check happens on-chain”.
    // If you want true client proof now, pass the addresses array down and build proof via merkletreejs.
    setEligible(true); // pretend eligible; replace when you wire real proof path
  }

  return (
    <div className="card" style={{ padding: 12, display: 'grid', gap: 8 }}>
      <div style={{ fontWeight: 700 }}>Allowlist</div>
      {!canCheck ? (
        <div style={{ opacity:.75 }}>Open sale or allowlist not set.</div>
      ) : (
        <>
          <div style={{ fontSize:12, opacity:.8 }}>Merkle root: <code style={{ opacity:.8 }}>{root}</code></div>
          <div style={{ display:'flex', gap:8 }}>
            <input
              placeholder="0x… your wallet"
              value={addr}
              onChange={(e)=>setAddr(e.target.value)}
              style={{ flex:1, background:'#101216', border:'1px solid rgba(255,255,255,.08)', borderRadius:12, color:'white', padding:'8px 10px' }}
            />
            <button className="button" onClick={check}>Check</button>
          </div>
          {eligible === true && <div style={{ color:'#2ecc71' }}>Eligible (demo)</div>}
          {eligible === false && <div style={{ color:'#e74c3c' }}>Not eligible</div>}
        </>
      )}
    </div>
  );
}
