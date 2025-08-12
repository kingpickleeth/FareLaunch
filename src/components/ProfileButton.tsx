import { useEffect, useMemo, useRef, useState } from 'react';
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
  if (!payload.avatar_url) payload.avatar_url = DEFAULT_AVATAR;
  const { data, error } = await supabase
    .from('creators')
    .upsert(payload, { onConflict: 'wallet' })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export default function ProfileButton({ onConnect }: { onConnect?: () => void }) {
  const { address, isConnected, isConnecting } = useAccount();
  const { disconnect } = useDisconnect();

  const [open, setOpen] = useState(false);
  const [creator, setCreator] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [form, setForm] = useState<{ display_name: string; avatar_url: string }>({ display_name: '', avatar_url: '' });

  const wrapRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // inject tiny CSS for shine/pop/spin
  useEffect(() => {
    const id = 'fl-prof-btn-css';
    if (document.getElementById(id)) return;
    const style = document.createElement('style');
    style.id = id;
    style.textContent = `
    /* ===== Shine (wide, clipped, slower) ===== */
    .fl-shine{ overflow:hidden; isolation:isolate; position:relative; }
    .fl-shine > *{ position:relative; z-index:1; }
  
    @keyframes flShine{
      0%{   transform:translateX(-130%); }
      100%{ transform:translateX(230%);  }
    }
  
    .fl-shine::after{
      content:"";
      position:absolute; top:0; bottom:0;
      left:-60%;                 /* start further left */
      width:160%;                /* wide enough to cross large pills */
      pointer-events:none; z-index:0;
      background:linear-gradient(110deg, transparent 0%, rgba(255,255,255,.75) 12%, transparent 24%);
      filter:blur(1px);
      border-radius:inherit;     /* clip to pill */
      transform:translateX(-130%);
      will-change:transform;
      contain:paint;             /* prevent paint bleed */
    }
  
    /* slower default = 1.25s; override with --shine-duration on the element if desired */
    .fl-shine:hover::after,
    .fl-shine:focus-visible::after{
      animation: flShine var(--shine-duration, 1.1s) cubic-bezier(.2,.7,.15,1) 1;
    }
  /* ==== Force slower speed + linear, override any earlier 0.9s rule ==== */
.button.fl-shine:hover::after,
.button.fl-shine:focus-visible::after,
.fl-shine:hover::after,
.fl-shine:focus-visible::after {
  animation-name: flShine !important;
  animation-duration: var(--shine-duration, 1.6s) !important; /* <- slower */
  animation-timing-function: var(--shine-ease, linear) !important; /* <- steady speed */
  animation-iteration-count: 1 !important;
  animation-fill-mode: none !important;
  animation-delay: 0s !important;
}
    /* ===== Pop / caret / spinner / avatar mask (unchanged) ===== */
    @keyframes flPop{from{opacity:0;transform:scale(.96)}to{opacity:1;transform:scale(1)}}
    .fl-pop{animation:flPop .14s ease;transform-origin:100% 0}
  
    @keyframes flSpin{to{transform:rotate(360deg)}}
    .fl-caret{transition:transform .14s ease, opacity .14s ease}
    .fl-caret.open{transform:rotate(180deg)}
  
    .avatar-hover-mask{opacity:0;transition:opacity .15s}
    .avatar-hover-mask:hover{opacity:1!important}
  `;  
    document.head.appendChild(style);
  }, []);

  // load / ensure creator row
  useEffect(() => {
    if (!isConnected || !address) {
      setCreator(null);
      setForm({ display_name: '', avatar_url: '' });
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        let c = await getCreator(address);
        if (!c) c = await upsertCreator({ wallet: address });
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

  // close on outside click + ESC
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  const title = (creator?.display_name ?? form.display_name ?? '').trim() || short(address);
  const avatar = form.avatar_url || creator?.avatar_url || DEFAULT_AVATAR;
  const fullAddr = address || '';

  // nice deterministic ring hue from wallet
  const hue = useMemo(() => {
    const s = (address ?? 'hunter').toLowerCase();
    let n = 0;
    for (let i = 0; i < s.length; i++) n = (n * 31 + s.charCodeAt(i)) >>> 0;
    return n % 360;
  }, [address]);

  if (!isConnected) {
    return (
      <button
        className="button button-primary"
        onClick={onConnect}
        style={{
          position: 'relative',
          fontWeight: 800,
          padding: '10px 14px',
          borderRadius: 14,
          background: 'linear-gradient(180deg, var(--fl-gold) 0%, #d9991f 100%)',
          color: '#1b1200',
          border: '1px solid rgba(0,0,0,.1)',
          boxShadow: '0 10px 24px rgba(255,184,46,.35), inset 0 1px 0 rgba(255,255,255,.6)',
        }}
      >
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

  function copy(addr: string) { navigator.clipboard.writeText(addr).catch(() => {}); }

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      {/* Navbar button */}
      <button
        className="button fl-shine"
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        disabled={isConnecting}
        style={{
          ['--shine-duration' as any]: '1.1s',
          ['--shine-ease' as any]: 'linear',     // or 'cubic-bezier(.25,.8,.2,1)'
          overflow: 'hidden',
          isolation: 'isolate',
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '8px 12px',
          height: 40,
          borderRadius: 14,
          border: '1px solid rgba(0,0,0,.1)',
          background: 'var(--fl-gold)',
          color: '#1a1300',
          fontWeight: 800,
          letterSpacing: .2,
          boxShadow: open
            ? '0 10px 28px rgba(255,184,46,.45), inset 0 1px 0 rgba(255,255,255,.65)'
            : '0 10px 22px rgba(255,184,46,.35), inset 0 1px 0 rgba(255,255,255,.65)',
          transform: 'translateZ(0)',
          transition: 'transform .06s ease, box-shadow .12s ease, filter .12s ease',
        }}
        onMouseDown={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.985)'; }}
        onMouseUp={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
      >
        {/* Avatar with glowing ring */}
        <div
          style={{
            position: 'relative',
            width: 28, height: 28, borderRadius: 12,
            overflow: 'hidden', flex: '0 0 auto',
            boxShadow: `0 0 0 2px rgba(0,0,0,.15), 0 0 12px hsla(${hue} 90% 55% / .35)`,
          }}
        >
          <img
            src={avatar}
            alt=""
            width={28}
            height={28}
            style={{ display:'block', width:'100%', height:'100%', objectFit:'cover' }}
          />
        </div>

        {/* Label */}
        <span style={{ fontWeight: 800, fontSize: 16, lineHeight: 1 }}>
          {title}
        </span>

        {/* Caret / spinner */}
        {isConnecting || saving ? (
          <span
            aria-hidden
            style={{
              width: 16, height: 16, borderRadius: 999,
              border: '2px solid rgba(0,0,0,.35)', borderTopColor: '#fff',
              animation: 'flSpin .7s linear infinite'
            }}
          />
        ) : (
          <svg
            width="14" height="14" viewBox="0 0 24 24" aria-hidden
            className={`fl-caret ${open ? 'open' : ''}`}
            style={{ opacity: .9 }}
          >
            <path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2" />
          </svg>
        )}
      </button>

      {/* Popover */}
      {open && (
        <div
          className="fl-pop"
          role="menu"
          style={{
            position: 'absolute',
            top: 'calc(100% + 10px)',
            right: 0,
            width: 320,
            padding: 14,
            display: 'grid',
            gap: 14,
            background: 'var(--menu-panel-bg, var(--fl-surface))',
            color: 'var(--text)',
            border: '1px solid var(--panel-border, var(--border))',
            borderRadius: 'var(--radius)',
            boxShadow: '0 16px 40px rgba(0,0,0,.35)',
            zIndex: 4000
          }}
        >
          {/* Header: avatar (editable) + name */}
          <div style={{ display:'grid', justifyItems:'center', gap:10 }}>
            <div
              onClick={() => fileInputRef.current?.click()}
              title="Change avatar"
              style={{
                width: 72, height: 72, borderRadius: '50%', position: 'relative',
                cursor: 'pointer', overflow: 'hidden',
                border: '1px solid var(--border)', boxShadow:'inset 0 0 0 1px rgba(255,255,255,.08)'
              }}
            >
              <img
                src={avatar}
                alt=""
                width={72}
                height={72}
                style={{ display:'block', width:'100%', height:'100%', objectFit:'cover' }}
              />
              {/* hover mask */}
              <div className="avatar-hover-mask"
                style={{
                  position:'absolute', inset:0, display:'grid', placeItems:'center',
                  background:'linear-gradient(to bottom, rgba(0,0,0,.0), rgba(0,0,0,.35))',
                  color:'#fff'
                }}>
                {saving ? (
                  <div style={{
                    width:22, height:22, borderRadius:999, border:'2px solid rgba(255,255,255,.6)',
                    borderTopColor:'transparent', animation:'flSpin .8s linear infinite'
                  }}/>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25z" stroke="white"/>
                    <path d="M20.71 7.04a1.003 1.003 0 0 0 0-1.42l-2.34-2.34a1.003 1.003 0 0 0-1.42 0l-1.83 1.83 3.75 3.75 1.84-1.82z" stroke="white"/>
                  </svg>
                )}
              </div>
            </div>

            {/* hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display:'none' }}
              onChange={(e)=> e.target.files?.[0] && onAvatarPick(e.target.files[0])}
            />

            {/* Name row */}
            {!editingName ? (
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <div style={{ fontWeight:800, fontSize:20, textAlign:'center', color:'var(--fl-gold)' }}>
                  {title}
                </div>
                <button
                  className="button"
                  onClick={() => setEditingName(true)}
                  style={{ padding:'4px 10px', fontSize:12, border:'1px solid var(--border)', }}
                >
                  Edit
                </button>
              </div>
            ) : (
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <input
                  autoFocus
                  placeholder="Display name"
                  value={form.display_name}
                  onChange={e=>setForm({ ...form, display_name: e.target.value })}
                  style={{
                    background:'var(--input-bg)', color:'var(--text)', fontSize:'1rem',
                    padding:'8px 10px', borderRadius: 8, border:'1px solid var(--input-border)', outline:'none',
                  }}
                />
                <button className="button button-primary" disabled={saving} onClick={saveName} style={{ padding:'6px 10px' }}>
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
            )}

            {/* Wallet + actions */}
            {fullAddr && (
              <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                <span
                  onClick={() => copy(fullAddr)}
                  style={{ fontFamily:'var(--font-data)', fontSize:12, color:'var(--muted)', cursor:'pointer', userSelect:'none' }}
                  title="Click to copy"
                >
                  {short(fullAddr)}
                </span>

                <button
                  className="button"
                  onClick={() => copy(fullAddr)}
                  style={{ padding:'2px 6px', fontSize:11, border:'1px solid var(--border)' }}
                  title="Copy address"
                  aria-label="Copy address"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <rect x="9" y="9" width="10" height="10" rx="2" stroke="currentColor"/>
                    <rect x="5" y="5" width="10" height="10" rx="2" stroke="currentColor" opacity=".8"/>
                  </svg>
                </button>

                <button
                  className="button"
                  onClick={disconnectWallet}
                  style={{ padding:'2px 6px', fontSize:16, border:'1px solid var(--border)' }}
                  title="Disconnect wallet"
                  aria-label="Disconnect wallet"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M12 3v8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                    <path d="M6.2 6.2a7 7 0 1 0 11.6 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                </button>
              </div>
            )}
          </div>

          {/* Joined date */}
          <div style={{ textAlign:'center', fontSize:12, color:'var(--muted)' }}>
            {creator?.created_at ? `Joined: ${new Date(creator.created_at).toLocaleDateString()}` : '—'}
          </div>
        </div>
      )}
    </div>
  );
}
