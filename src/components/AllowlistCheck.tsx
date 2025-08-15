import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { isAddress, makeMerkle } from '../utils/merkle';
import { useAccount } from 'wagmi';

type Props = { saleId?: string; root?: string | null };

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default function AllowlistCheck({ saleId, root }: Props) {
  const { address } = useAccount();
  const [input, setInput] = useState(''); // controlled
  const [status, setStatus] = useState<'idle'|'checking'|'allowed'|'not'|'error'>('idle');
  const [msg, setMsg] = useState<string>('');

  const canCheckRoot = !!root && root.startsWith('0x') && root.length === 66;
  const saleIdValid = !!saleId && UUID_RE.test(String(saleId));

  // Reset when sale/root changes
  useEffect(() => {
    setInput('');
    setStatus('idle');
    setMsg('');
  }, [saleId, root]);

  async function runCheck(addrRaw: string) {
    try {
      setStatus('checking');
      setMsg('');

      if (!canCheckRoot) throw new Error('Allowlist not set for this sale');
      if (!saleIdValid) throw new Error('Missing or invalid saleId');
      if (!supabase) throw new Error('Supabase not configured');

      const addr = addrRaw.trim();
      if (!isAddress(addr)) throw new Error('Invalid address');

      const { data, error } = await supabase
        .from('allowlists')
        .select('address')
        .eq('sale_id', String(saleId));

      if (error) throw error;

      const addrs = (data ?? []).map(r => String(r.address).trim().toLowerCase());
      if (!addrs.length) throw new Error('No allowlist entries found');

      const { getProof, verify } = makeMerkle(addrs);
      const proof = getProof(addr.toLowerCase());
      const ok = verify(addr.toLowerCase(), proof, root!);

      setStatus(ok ? 'allowed' : 'not');
    } catch (e: any) {
      console.error(e);
      setMsg(e?.message || 'Error');
      setStatus('error');
    }
  }

  const short = (a?: string) => (a ? `${a.slice(0,6)}…${a.slice(-4)}` : '');

  return (
    <div className="card" style={{ padding: 12, display: 'grid', gap: 10 }}>
      <div style={{ fontWeight: 700 }}>Allowlist{!saleIdValid ? ' (saleId missing/invalid)' : ''}</div>

      {!canCheckRoot ? (
        <div style={{ opacity:.8, color: 'var(--muted)' }}>Public Sale (no allowlist)</div>
      ) : (
        <>
          <div style={{ fontSize:12, color: 'var(--muted)' }}>
            Merkle root:{' '}
            <code
              className="break-anywhere"
              style={{
                background: 'var(--input-bg)',
                border: '1px solid var(--input-border)',
                padding: '2px 6px',
                borderRadius: 6,
                opacity: .9
              }}
            >
              {root}
            </code>
          </div>

          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
            <input
              placeholder={address ? `${short(address)} (tap “Use my wallet”)` : '0x… wallet to check'}
              value={input}
              onChange={(e)=>setInput(e.target.value)}
              style={{
                flex:1,
                minWidth: 220,
                background: 'var(--input-bg)',
                border: '1px solid var(--input-border)',
                borderRadius: 12,
                color: 'var(--text)',
                padding: '8px 10px',
                outline: 'none'
              }}
            />
            {address && (
              <button
                className="button button-secondary"
                type="button"
                onClick={() => setInput(address)}
                title="Use my wallet"
              >
                Use my wallet
              </button>
            )}
            <button
              className="button button-secondary"
              disabled={!saleIdValid || !isAddress(input)}
              onClick={() => runCheck(input)}
              title={!isAddress(input) ? 'Enter a valid address' : 'Check'}
              style={{ opacity: (!saleIdValid || !isAddress(input)) ? .6 : 1 }}
            >
              Check
            </button>
          </div>

          {status === 'checking' && (
            <div style={{ opacity:.9, color:'var(--muted)' }}>Checking…</div>
          )}
          {status === 'allowed' && (
            <div style={{ color:'var(--success)' }}>✅ On the allowlist</div>
          )}
          {status === 'not' && (
            <div style={{ color:'var(--fl-danger)' }}>❌ Not on the allowlist</div>
          )}
          {status === 'error' && (
            <div style={{ color:'var(--warning)' }}>⚠️ {msg}</div>
          )}
        </>
      )}
    </div>
  );
}
