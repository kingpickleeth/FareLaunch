import { useMemo, useRef, useState, useEffect } from 'react';
import type { WizardData } from '../../types/wizard';
import { supabase } from '../../lib/supabase';

type Props = {
  value: WizardData;
  onChange: (next: WizardData) => void;
  onNext: () => void;
};

/* gold number chip header (same as elsewhere) */
function StepHeader({ n, text }: { n: number; text: string }) {
  return (
    <div className="stepheader">
      <span aria-hidden className="stepchip">{n}</span>
      <span className="steptitle">{text}</span>
    </div>
  );
}

export default function StepBasics({ value, onChange, onNext }: Props) {
  const [local, setLocal] = useState<WizardData>({
    ...value,
    token: { ...value.token, decimals: value.token.decimals ?? 18 },
  });
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);

  /* -------- inject responsive CSS once (classes, no inline columns) -------- */
  useEffect(() => {
    const id = 'wizard-basics-css';
    if (document.getElementById(id)) return;
    const s = document.createElement('style');
    s.id = id;
    s.textContent = `
      .wizard-card { padding: 16px; display: grid; gap: 16px; max-width: 100%; }

      .stepheader { display: flex; align-items: center; gap: 8px; }
      .stepchip {
        display:inline-flex; align-items:center; justify-content:center;
        width:22px; height:22px; border-radius:999px;
        background: color-mix(in srgb, var(--fl-gold) 18%, transparent);
        border:1px solid var(--fl-gold); color: var(--fl-gold);
        font-weight:900; font-size:12px;
      }
      .steptitle { font-weight: 800; color: var(--text); }

      /* grids */
      .basics-head { display:grid; grid-template-columns: 130px 1fr; gap:16px; align-items:start; }
      .webtw-grid  { display:grid; grid-template-columns: 1fr 1fr; gap:12px; }
   /* ===== Token row (desktop) ===== */
.token-grid{
  display:grid;
  /* name grows, ticker compact, decimals tiny, CTA space */
  grid-template-columns: 1fr 220px 90px auto;
  column-gap: 12px;
  align-items: end;        /* bottoms line up */
}

/* keep the compact fields compact */
.ticker-col .ticker-input{ width:100%; }
.decimals-col .decimals-input{
  width: 90px;             /* tiny, predictable */
  text-align:center;
  padding-left:10px;
  padding-right:10px;
}

/* Trim the ticker/decimals even more on mid-width screens so the gap never balloons */
@media (max-width: 1200px){
  .token-grid{ grid-template-columns: 1fr 200px 82px auto; }
}

/* Stack cleanly on mobile; inputs stretch full width; CTA becomes full-width */
@media (max-width: 720px){
  .token-grid{ grid-template-columns: 1fr; row-gap: 12px; }
  .ticker-col .ticker-input,
  .decimals-col .decimals-input{ width:100%; }
  .wizard-cta{ justify-self: stretch; }
}

      .name-col { grid-column: 1 / span 1; }
      .ticker-col { grid-column: 2 / span 1; }
      .decimals-col { grid-column: 3 / span 1; }

      .logo-box {
        width:96px; height:96px; border-radius:16px;
        background: var(--input-bg); border:1px solid var(--input-border);
        overflow:hidden; display:grid; place-items:center; cursor:pointer; position:relative;
      }

 .logo-wrap { display:grid; gap:10px; justify-items:center; } /* center logo + button */
 .upload-btn { justify-self:center; }
 .wizard-cta { justify-self:end; max-width:320px; }
 
      /* mobile */
      @media (max-width: 640px) {
        .basics-head { grid-template-columns: 1fr; }
        .webtw-grid  { grid-template-columns: 1fr; }
        .token-grid  { grid-template-columns: 1fr; }
        .name-col, .ticker-col, .decimals-col { grid-column: auto; }
 .upload-btn, .wizard-cta { width:100%; justify-self:stretch; }
         .logo-wrap { justify-items: center; }
      }
    `;
    document.head.appendChild(s);
  }, []);

  // --- Validation helpers ----------------------------------------------------
  function websiteHint(input?: string): string | null {
    if (!input) return null;
    const v = input.trim();
    if (!v) return null;
    if (/\s/.test(v)) return 'Remove spaces from the URL.';
    const hasProtocol = /^https?:\/\//i.test(v);
    const withoutProto = v.replace(/^https?:\/\//i, '');
    const hasDotTld = /\.[a-z]{2,}$/i.test(withoutProto);
    if (!hasDotTld) return `Add a TLD at the end like https://${withoutProto || 'example'}.com`;
    if (!hasProtocol) return `Add https:// to make it https://${withoutProto}`;
    return null;
  }
  function twitterHint(input?: string): string | null {
    if (!input) return null;
    const v = input.trim();
    if (!v) return null;
    const urlOk = /^https?:\/\/(x\.com|twitter\.com)\/[A-Za-z0-9_]{1,15}$/i.test(v);
    if (urlOk) return null;
    if (v.startsWith('@')) {
      const h = v.slice(1);
      if (!/^[A-Za-z0-9_]{1,15}$/.test(h)) return 'Use 1–15 letters, numbers, or underscores after @.';
      return null;
    }
    if (/^[A-Za-z0-9_]{1,15}$/i.test(v)) return `Add @ to make it @${v}`;
    return 'Use @handle (1–15 letters/numbers/underscores) or a full URL like https://x.com/handle';
  }

  // Required
  const nameOk = local.project.name.trim().length >= 2;
  const descOk = (local.project.description?.trim().length ?? 0) >= 2;
  const logoOk = !!local.project.logoUrl && /^https?:\/\//i.test(local.project.logoUrl);
  const tokenNameOk = local.token.name.trim().length >= 2;
  const symOk = /^[A-Z0-9]{2,8}$/.test(local.token.symbol);

  // Optional-but-if-present-must-be-valid
  const webHelp = websiteHint(local.project.website ?? '');
  const twHelp  = twitterHint(local.project.twitter ?? '');
  const webOk   = !local.project.website || !webHelp;
  const twOk    = !local.project.twitter || !twHelp;

  const nextIssue = useMemo(() => {
    if (!nameOk) return 'Enter a project name';
    if (!descOk) return 'Add a short description';
    if (!logoOk) return 'Upload a logo';
    if (!tokenNameOk) return 'Enter a token name';
    if (!symOk) return 'Enter a valid ticker (2–8 A–Z/0–9)';
    if (!webOk) return `Fix website: ${webHelp}`;
    if (!twOk) return `Fix Twitter: ${twHelp}`;
    return null;
  }, [nameOk, descOk, logoOk, tokenNameOk, symOk, webOk, webHelp, twOk, twHelp]);

  const canContinue = !nextIssue;

  // --- Upload logo -----------------------------------------------------------
  async function handleLogo(file: File) {
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) { alert('Logo too large (max 8MB).'); return; }
    const previewUrl = URL.createObjectURL(file);
    setLocal(prev => ({ ...prev, project: { ...prev.project, logoUrl: previewUrl } }));
    try {
      setUploading(true);
      const ext = (file.name.split('.').pop() || 'png').toLowerCase();
      const safeName =
        (local.project.name || 'project')
          .toLowerCase().replace(/[^a-z0-9-_]/g, '-').replace(/-+/g, '-').slice(0, 40) || 'project';
      const path = `logos/${safeName}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from('faredrop-logos')
        .upload(path, file, { cacheControl: '3600', upsert: true, contentType: file.type || 'image/png' });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from('faredrop-logos').getPublicUrl(path);
      setLocal(prev => ({ ...prev, project: { ...prev.project, logoUrl: data.publicUrl } }));
    } catch (e:any) {
      console.error(e); alert(`Upload failed: ${e?.message || e}`);
    } finally {
      setUploading(false);
      try { URL.revokeObjectURL(previewUrl); } catch {}
    }
  }
  function openPicker() { fileRef.current?.click(); }
  function onKeyOpen(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openPicker(); }
  }
  function commitAndNext() { if (!canContinue) return; onChange(local); onNext(); }

  return (
    <div className="card wizard-card">
      {/* 1. Basics */}
      <StepHeader n={1} text="Basics" />
      <div className="basics-head">
        {/* Logo column */}
        <div className="logo-wrap" style={{ display:'grid', gap:10 }}>
          <div
            role="button" tabIndex={0} onClick={openPicker} onKeyDown={onKeyOpen} title="Upload logo"
            className="logo-box"
          >
            {local.project.logoUrl ? (
              <>
                <img src={local.project.logoUrl} alt="logo preview" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                <div style={{
                  position:'absolute', bottom:6, right:6, padding:'2px 6px', borderRadius:8,
                  background:'var(--scrim)', color:'var(--fl-white)', fontSize:10, opacity:.9,
                }}>
                  {uploading ? 'Uploading…' : 'Change'}
                </div>
              </>
            ) : (
              <span style={{ color:'var(--muted)', fontSize:12 }}>Click to upload</span>
            )}
          </div>

          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            onChange={e => e.target.files?.[0] && handleLogo(e.target.files[0])}
            style={{ display:'none' }}
          />
          <button type="button" className="button button-secondary" onClick={openPicker}>
            Upload Logo<span style={{ color:'var(--fl-danger, #c62828)' }}> *</span>
          </button>
        </div>

        {/* Fields column */}
        <div style={{ display:'grid', gap:12, minWidth:0 }}>
          <label style={{ display:'grid', gap:6, minWidth:0 }}>
            <div>Project Name (internal)<span style={{ color:'var(--fl-danger, #c62828)' }}> *</span></div>
            <input
              value={local.project.name}
              onChange={e => setLocal({ ...local, project: { ...local.project, name: e.target.value } })}
              placeholder="Farelaunch"
              style={inputStyle}
            />
          </label>

          <label style={{ display:'grid', gap:6, minWidth:0 }}>
            <div>Short Description<span style={{ color:'var(--fl-danger, #c62828)' }}> *</span></div>
            <textarea
              value={local.project.description ?? ''}
              onChange={e => setLocal({ ...local, project: { ...local.project, description: e.target.value } })}
              rows={3}
              placeholder="One-liner about the project."
              style={{ ...inputStyle, resize:'vertical' }}
            />
          </label>

          <div className="webtw-grid">
            <label style={{ display:'grid', gap:6, minWidth:0 }}>
              <div>Website</div>
              <input
                value={local.project.website ?? ''}
                onChange={e => setLocal({ ...local, project: { ...local.project, website: e.target.value } })}
                placeholder="https://example.com"
                style={inputStyle}
              />
              {webHelp && <div style={{ color:'var(--fl-danger, #c62828)', fontSize:12, marginTop:2 }}>{webHelp}</div>}
            </label>

            <label style={{ display:'grid', gap:6, minWidth:0 }}>
              <div>Twitter</div>
              <input
                value={local.project.twitter ?? ''}
                onChange={e => setLocal({ ...local, project: { ...local.project, twitter: e.target.value } })}
                placeholder="@project or https://x.com/project"
                style={inputStyle}
              />
              {twHelp && <div style={{ color:'var(--fl-danger, #c62828)', fontSize:12, marginTop:2 }}>{twHelp}</div>}
            </label>
          </div>
        </div>
      </div>

      {/* 2. Token */}
      <StepHeader n={2} text="Token" />
      <div className="token-grid">
        <label className="name-col" style={{ display:'grid', gap:6, minWidth:0 }}>
          <div>Token Name<span style={{ color:'var(--fl-danger, #c62828)' }}> *</span></div>
          <input
            type="text"
            value={local.token.name}
            onChange={(e) => setLocal({ ...local, token: { ...local.token, name: e.target.value } })}
            placeholder="Farelaunch Token"
            style={inputStyle}
          />
        </label>

        <label className="ticker-col" style={{ display:'grid', gap:6, minWidth:0 }}>
          <div>Ticker<span style={{ color:'var(--fl-danger, #c62828)' }}> *</span></div>
          <input
            className="ticker-input"
            type="text"
            maxLength={9}
            value={local.token.symbol}
            onChange={(e) => setLocal({ ...local, token: { ...local.token, symbol: e.target.value.toUpperCase() } })}
            placeholder="FLCH"
            style={inputStyle}
          />
        </label>

        <label className="decimals-col" style={{ display:'grid', gap:6, minWidth:0 }}>
          <div>Decimals</div>
          <input
            className="decimals-input"
            type="number"
            min={0}
            max={18}
            value={local.token.decimals ?? 18}
            onChange={(e) =>
              setLocal({
                ...local,
                token: {
                  ...local.token,
                  decimals: Math.max(0, Math.min(18, Number(e.target.value))),
                },
              })
            }
            style={{ ...inputStyle, textAlign:'center' }}
          />
        </label>
      </div>

      {/* CTA */}
      <div style={{ display:'flex', gap:12, justifyContent:'flex-end', flexWrap:'wrap' }}>
        <button
          className={`button ${canContinue ? 'button-primary' : ''} wizard-cta`}
          onClick={commitAndNext}
          disabled={!canContinue}
          title={nextIssue ?? 'All set'}
        >
          {canContinue ? 'Save & Continue' : nextIssue}
        </button>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  background: 'var(--input-bg)',
  border: '1px solid var(--input-border)',
  color: 'var(--text)',
  borderRadius: 12,
  padding: '10px 12px',
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
};
