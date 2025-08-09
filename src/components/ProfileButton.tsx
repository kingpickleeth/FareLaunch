import { useEffect, useRef, useState } from 'react';
import { useAccount, useDisconnect } from 'wagmi';
import { supabase } from '../lib/supabase';
const DEFAULT_AVATAR = 'https://dengdefense.xyz/taxi.svg';

function short(addr?: string) { return addr ? `${addr.slice(0,6)}…${addr.slice(-4)}` : ''; }

async function getCreator(wallet: string) {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('creators')
    .select('*')
    .eq('wallet', wallet)
    .maybeSingle();
  if (error) throw error;
  return data;
}
async function upsertCreator(payload: { wallet: string; display_name?: string | null; avatar_url?: string | null }) {
  const defaultAvatar = 'https://dengdefense.xyz/taxi.svg';
  if (!payload.avatar_url) {
    payload.avatar_url = defaultAvatar;
  }
  const { data, error } = await supabase
    .from('creators')
    .upsert(payload, { onConflict: 'wallet' })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export default function ProfileButton({ onConnect }: { onConnect?: () => void }) {
  const { address, isConnected } = useAccount();
  const [open, setOpen] = useState(false);
  const [creator, setCreator] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [form, setForm] = useState<{ display_name: string; avatar_url: string }>({ display_name: '', avatar_url: '' });
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { disconnect } = useDisconnect();

  useEffect(() => {
    if (!isConnected || !address) {
      setCreator(null);
      setForm({ display_name: '', avatar_url: '' });
      return;
    }
  
    let cancelled = false;
    (async () => {
      try {
        // 1) Try to load
        let c = await getCreator(address);
  
        // 2) If none, create immediately with defaults
        if (!c) {
          c = await upsertCreator({ wallet: address });
        }
  
        if (!cancelled) {
          setCreator(c);
          setForm({
            display_name: c?.display_name ?? '',
            avatar_url: c?.avatar_url ?? '',
          });
        }
      } catch (e) {
        console.error(e);
      }
    })();
  
    return () => { cancelled = true; };
  }, [address, isConnected]);  

  if (!isConnected) {
    return (
      <button className="button button-primary" onClick={onConnect}>
        Connect Wallet
      </button>
    );
  }
  function disconnectWallet() {
    try {
      disconnect();
      setOpen(false);
      setCreator(null);
      setForm({ display_name: '', avatar_url: '' });
    } catch (e) {
      console.error(e);
    }
  }
  
  const title = (creator?.display_name ?? form.display_name ?? '').trim() || short(address);
  const avatar = form.avatar_url || creator?.avatar_url || DEFAULT_AVATAR;
  const fullAddr = address || '';

  async function onAvatarPick(file: File) {
    if (!supabase || !address) return;
    try {
      setSaving(true);
      const ext = file.name.split('.').pop() || 'png';
      const path = `${address}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage.from('avatars').upload(path, file, {
        cacheControl: '3600',
        upsert: false,
      });
      if (upErr) { alert(upErr.message); return; }
      const { data: pub } = supabase.storage.from('avatars').getPublicUrl(path);
      const url = pub.publicUrl;

      setForm(f => ({ ...f, avatar_url: url }));
      const updated = await upsertCreator({ wallet: address, avatar_url: url });
      setCreator(updated);
    } catch (e: any) {
      console.error(e);
      alert(e?.message || 'Avatar upload failed');
    } finally {
      setSaving(false);
    }
  }

  async function saveName() {
    if (!address) return;
    const name = form.display_name.trim() || null;
    try {
      setSaving(true);
      const updated = await upsertCreator({ wallet: address, display_name: name });
      setCreator(updated);
      setEditingName(false);
    } catch (e: any) {
      console.error(e);
      alert(e?.message || 'Failed to save username');
    } finally {
      setSaving(false);
    }
  }

  function copy(addr: string) {
    navigator.clipboard.writeText(addr).catch(() => {});
  }

  return (
    <div style={{ position: 'relative' }}>
      {/* Navbar button: avatar left, name right (both vertically centered) */}
      <button
        className="button"
        onClick={() => setOpen(v => !v)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '4px 10px',
          height: '36px'
        }}
      >
        {avatar ? (
          <img
            src={avatar}
            alt=""
            width={32}
            height={32}
            style={{ borderRadius: '14px',
                objectFit: 'cover' }}
          />
        ) : (
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: '50%',
              background: '#2a2d36'
            }}
          />
        )}
        <span style={{ fontWeight: 600, fontSize: '1rem', display:'flex', alignItems:'center' }}>{title}</span>
      </button>

      {open && (
        <div className="card" style={{
          position:'absolute', right:0, marginTop:8, width:360, padding:16, display:'grid', gap:14,
          background:'#141720', borderRadius:12, boxShadow:'0 6px 24px rgba(0,0,0,.35)', zIndex:1000
        }}>
          {/* Top: avatar (always editable) */}
          <div style={{ display:'grid', justifyItems:'center', gap:10 }}>
            <div
              onClick={() => fileInputRef.current?.click()}
              title="Change avatar"
              style={{
                width: 64,
                height: 64,
                borderRadius: '50%',
                position: 'relative',
                cursor: 'pointer',
                background: avatar ? 'transparent' : 'rgba(255,255,255,.08)',
                display: 'grid',
                placeItems: 'center',
                overflow: 'hidden'
              }}
            >
              {avatar ? (
                <>
                  <img
                    src={avatar}
                    alt=""
                    width={64}
                    height={64}
                    style={{ borderRadius: '50%', objectFit:'cover', display:'block' }}
                  />
                  <div
                    style={{
                      position:'absolute', inset:0, borderRadius:'50%',
                      background:'rgba(0,0,0,.35)', display:'grid', placeItems:'center',
                      opacity:0, transition:'opacity .15s'
                    }}
                    className="avatar-hover-mask"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                      <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25z" stroke="white" />
                      <path d="M20.71 7.04a1.003 1.003 0 0 0 0-1.42l-2.34-2.34a1.003 1.003 0 0 0-1.42 0l-1.83 1.83 3.75 3.75 1.84-1.82z" stroke="white"/>
                    </svg>
                  </div>
                </>
              ) : (
                <div style={{ color:'rgba(255,255,255,.6)', fontSize:12 }}>
                  Add photo
                </div>
              )}
            </div>

            {/* hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display:'none' }}
              onChange={(e)=> e.target.files?.[0] && onAvatarPick(e.target.files[0])}
            />

            {/* Username row: title + Change/Save */}
            {!editingName ? (
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <div style={{ fontWeight:700, fontSize:20, textAlign:'center', color:'var(--fl-gold)' }}>{title}</div>
                <button
                  className="button"
                  onClick={() => setEditingName(true)}
                  style={{ padding:'2px 8px', fontSize:12, backgroundColor:'var(--fl-purple)' }}
                >
                  Change Name
                </button>
              </div>
            ) : (
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <input
                  autoFocus
                  placeholder="Display name"
                  value={form.display_name}
                  onChange={e=>setForm({ ...form, display_name: e.target.value })}
                  style={{ background:'#101216', color:'white', fontSize:'1.1rem', padding:'8px 10px', borderRadius: 8, border:'1px solid rgba(255,255,255,.08)' }}
                />
                <button
                  className="button button-primary"
                  disabled={saving}
                  onClick={saveName}
                  style={{ padding:'6px 10px' }}
                >
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
            )}

            {/* Wallet line with copy (click text or icon) */}
            {fullAddr && (
  <div style={{ display:'flex', alignItems:'center', gap:6 }}>
    <span
      onClick={() => copy(fullAddr)}
      style={{
        fontFamily:'var(--font-data)',
        fontSize:12,
        opacity:.8,
        color:'white',
        cursor:'pointer',
        userSelect:'none'
      }}
      title="Click to copy"
    >
      {short(fullAddr)}
    </span>

    {/* Copy button */}
    <button
      className="button"
      onClick={() => copy(fullAddr)}
      style={{ padding:'2px 6px', fontSize:11 }}
      title="Copy address"
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
        <rect x="9" y="9" width="10" height="10" rx="2" stroke="currentColor"/>
        <rect x="5" y="5" width="10" height="10" rx="2" stroke="currentColor" opacity=".8"/>
      </svg>
    </button>

    {/* Disconnect button */}
    <button
      className="button"
      onClick={disconnectWallet}
      style={{ padding:'2px 6px', fontSize:11 }}
      title="Disconnect wallet"
    >
      {/* power icon */}
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M12 3v8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        <path d="M6.2 6.2a7 7 0 1 0 11.6 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      </svg>
    </button>
  </div>
)}
          </div>

          {/* Action links — centered, side-by-side with outline */}
          <div style={{ display:'flex', gap:10, justifyContent:'center' }}>
            <a
              className="button"
              href="/me"
              style={{
                minWidth:140, textAlign:'center',
                border: '1px solid rgba(255,255,255,.12)', color: '#1A1C23'
              }}
            >
              Dashboard
            </a>
            <a
              className="button"
              href="/launch"
              style={{
                minWidth:140, textAlign:'center',color: '#1A1C23',
                border: '1px solid rgba(255,255,255,.12)'
              }}
            >
              Create launch
            </a>
          </div>

          {/* Joined date moved below buttons */}
          <div style={{ textAlign:'center', opacity:.75, fontSize:12, color:'white' }}>
            {creator?.created_at ? `Joined: ${new Date(creator.created_at).toLocaleDateString()}` : '—'}
          </div>
        </div>
      )}

      <style>{`
        .avatar-hover-mask:hover { opacity: 1 !important; }
      `}</style>
    </div>
  );
}
