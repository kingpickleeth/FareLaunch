// components/AllowlistCheck.tsx
import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { isAddress, makeMerkle } from '../utils/merkle';
import { useAccount } from 'wagmi';

type Props = { saleId?: string; root?: string | null }; // ⬅ allow undefined so we can guard

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default function AllowlistCheck({ saleId, root }: Props) {
  const { address } = useAccount();
  const [input, setInput] = useState('');
  const [status, setStatus] = useState<'idle'|'checking'|'allowed'|'not'|'error'>('idle');
  const [msg, setMsg] = useState<string>('');

  const canCheckRoot = !!root && root.startsWith('0x') && root.length === 66;
  const saleIdValid = !!saleId && UUID_RE.test(String(saleId));

  async function runCheck(addrRaw: string) {
    try {
      setStatus('checking');
      setMsg('');

      if (!canCheckRoot) throw new Error('Allowlist not set for this sale');
      if (!saleIdValid) throw new Error('Missing or invalid saleId');
      if (!supabase) throw new Error('Supabase not configured');
      if (!isAddress(addrRaw)) throw new Error('Invalid address');

      const addr = addrRaw.trim().toLowerCase();

      const { data, error } = await supabase
        .from('allowlists')
        .select('address')
        .eq('sale_id', String(saleId)); // now guaranteed valid

      if (error) throw error;

      const addrs = (data ?? []).map(r => String(r.address).trim().toLowerCase());
      if (!addrs.length) throw new Error('No allowlist entries found');

      const { getProof, verify } = makeMerkle(addrs);
      const proof = getProof(addr);
      const ok = verify(addr, proof, root!);

      setStatus(ok ? 'allowed' : 'not');
    } catch (e: any) {
      console.error(e);
      setMsg(e?.message || 'Error');
      setStatus('error');
    }
  }

  const auto = address ?? '';

  // Optional: show a small warning if saleId missing
  const headerNote = !saleIdValid
    ? ' (saleId missing/invalid)'
    : '';

  return (
    <div className="card" style={{ padding: 12, display: 'grid', gap: 8 }}>
      <div style={{ fontWeight: 700 }}>Allowlist{headerNote}</div>

      {!canCheckRoot ? (
        <div style={{ opacity:.75 }}>Open sale or allowlist not set.</div>
      ) : (
        <>
          <div style={{ fontSize:12, opacity:.8 }}>
            Merkle root: <code style={{ opacity:.8 }}>{root}</code>
          </div>

          <div style={{ display:'flex', gap:8 }}>
            <input
              placeholder="0x… wallet to check"
              value={input || auto}
              onChange={(e)=>setInput(e.target.value)}
              style={{ flex:1, background:'#101216', border:'1px solid rgba(255,255,255,.08)', borderRadius:12, color:'white', padding:'8px 10px' }}
            />
            <button
              className="button"
              disabled={!saleIdValid}
              onClick={() => runCheck((input || auto).trim())}
            >
              Check
            </button>
          </div>

          {status === 'checking' && <div style={{ opacity:.8 }}>Checking…</div>}
          {status === 'allowed' && <div style={{ color:'#2ecc71' }}>✅ On the allowlist</div>}
          {status === 'not' && <div style={{ color:'#e74c3c' }}>❌ Not on the allowlist</div>}
          {status === 'error' && <div style={{ color:'#f39c12' }}>⚠️ {msg}</div>}
        </>
      )}
    </div>
  );
}
