// src/components/wizard/StepAllowlist.tsx
import { useEffect, useMemo, useState } from 'react';
import type { WizardData } from '../../types/wizard';
import AllowlistUploader from '../AllowlistUploader';
import { isAddress, makeMerkle } from '../../utils/merkle';

/* ──────────────────────────────────────────────────────────────
   Step header chip
   ────────────────────────────────────────────────────────────── */
function StepHeader({ n, text, info }: { n: number; text: string; info?: React.ReactNode }) {
  return (
    <div className="stepheader" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span aria-hidden className="stepchip">{n}</span>
      <span className="steptitle" style={{ fontWeight: 800 }}>{text}</span>
      {info}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
   Tooltip (theme-aware)
   ────────────────────────────────────────────────────────────── */
function ensureTooltipCSS() {
  const tipId = 'fl-tooltip-styles';
  const css = `
    .fl-info:hover {
      color: var(--text);
      background: var(--tooltip-hover-bg, var(--input-bg));
      border-color: var(--input-border);
    }
    .fl-tip { position: relative; }
    .fl-tip::after {
      content: '';
      position: absolute; top: 50%;
      transform: translateY(-50%) rotate(45deg);
      width: 12px; height: 12px;
      background: var(--tooltip-bg, var(--popover-bg, var(--input-bg)));
      border: 1px solid var(--tooltip-border, var(--card-border));
      border-right: 0; border-bottom: 0;
      box-shadow: -2px 2px 6px rgba(0,0,0,.10);
    }
    .fl-right { left: calc(100% + 4px); }
    .fl-right::after { left: -4px; }
    .fl-left  { right: calc(100% + 4px); }
    .fl-left::after { right: -4px; transform: translateY(-50%) rotate(225deg); }
  `;
  if (typeof document !== 'undefined') {
    const existing = document.getElementById(tipId) as HTMLStyleElement | null;
    if (existing) existing.textContent = css;
    else {
      const s = document.createElement('style');
      s.id = tipId;
      s.textContent = css;
      document.head.appendChild(s);
    }
  }
}
function InfoIcon({ text }: { text: string }) {
  useEffect(() => { ensureTooltipCSS(); }, []);
  const [open, setOpen] = useState(false);
  const [placement, setPlacement] = useState<'right' | 'left'>('right');
  return (
    <span
      className="fl-info"
      onMouseEnter={() => {
        setOpen(true);
        const vw = window.innerWidth || document.documentElement.clientWidth;
        setTimeout(() => {
          const el = document.querySelector('.fl-tip') as HTMLElement | null;
          if (!el) return;
          const r = el.getBoundingClientRect();
          setPlacement(r.right + 16 > vw ? 'left' : 'right');
        }, 0);
      }}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      tabIndex={0}
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: 6,
        width: 16, height: 16,
        borderRadius: '50%',
        fontSize: 12, lineHeight: 1,
        cursor: 'help', userSelect: 'none',
        color: 'var(--muted)',
        border: '1px solid var(--card-border)',
        background: 'transparent',
        transition: 'color .12s ease, border-color .12s ease, background .12s ease',
      }}
      aria-label={text}
      title=""
    >
      i
      {open && (
        <div
          className={`fl-tip ${placement === 'left' ? 'fl-left' : 'fl-right'}`}
          role="tooltip"
          style={{
            position: 'absolute', zIndex: 40, top: '50%',
            transform: 'translateY(calc(-50% + 1px))',
            minWidth: 220, maxWidth: 360,
            padding: '10px 12px', borderRadius: 10,
            fontSize: 12, lineHeight: 1.45,
            background: 'var(--tooltip-bg, var(--popover-bg, var(--input-bg)))',
            color: 'var(--tooltip-text, var(--text))',
            border: '1px solid var(--tooltip-border, var(--card-border))',
            boxShadow: '0 10px 30px rgba(0,0,0,.18)',
            whiteSpace: 'normal', wordBreak: 'break-word', overflowWrap: 'anywhere',
          }}
        >
          {text}
        </div>
      )}
    </span>
  );
}

/* ──────────────────────────────────────────────────────────────
   Local styles
   ────────────────────────────────────────────────────────────── */
function injectAllowlistCSS() {
  const id = 'wizard-allowlist-css';
  if (typeof document === 'undefined' || document.getElementById(id)) return;
  const s = document.createElement('style');
  s.id = id;
  s.textContent = `
    .wizard-card { padding:16px; display:grid; gap:16px; max-width:100%; }

    .stepchip{
      display:inline-flex; align-items:center; justify-content:center;
      width:22px; height:22px; border-radius:999px;
      background: color-mix(in srgb, var(--fl-gold) 18%, transparent);
      border:1px solid var(--fl-gold); color: var(--fl-gold);
      font-weight:900; font-size:12px;
    }

    .mode-chip {
      border-radius:999px;
      padding:6px 12px;
      font-weight:700;
      border:1px solid var(--chip-border);
      background: var(--chip-bg);
      color: var(--chip-fg);
      transition: background .15s ease, color .15s ease, border-color .15s ease;
    }
    .mode-chip[aria-pressed="true"]{
      background: var(--chip-active-bg);
      color: var(--chip-active-fg);
      border-color: var(--chip-active-bg);
      box-shadow: 0 2px 12px color-mix(in srgb, var(--chip-active-bg) 24%, transparent);
    }

    .aw-input, .aw-textarea {
      background: var(--input-bg);
      border: 1px solid var(--input-border);
      color: var(--text);
      border-radius: 12px;
      padding: 10px 12px;
      outline: none;
      width: 100%;
      box-sizing: border-box;
    }
    .aw-textarea { resize: vertical; min-height: 120px; font-family: var(--font-data); }

    .aw-card { background: var(--card-bg); border: 1px solid var(--card-border); padding: 12px; border-radius: 12px; }

    .aw-preview {
      max-height: 180px; overflow: auto;
      background: var(--input-bg); border: 1px solid var(--input-border);
      border-radius: 10px; padding: 8px; font-family: var(--font-data);
    }
    .aw-kv { display:flex; gap:8px; flex-wrap:wrap; }
    .aw-badge { border:1px solid var(--card-border); background: var(--input-bg); padding:2px 8px; border-radius:999px; font-size:12px; color: var(--muted); }
  `;
  document.head.appendChild(s);
}

/* ──────────────────────────────────────────────────────────────
   Toggle styles (switch)
   ────────────────────────────────────────────────────────────── */
function ensureSwitchStyles() {
  const id = 'allowlist-toggle-styles';
  if (typeof document === 'undefined') return;
  const css = `
    .allowlist-toggle{ display:flex; align-items:center; gap:12px; font-size:16px; }
    .allowlist-toggle > input[type="checkbox"]{
      -webkit-appearance:none; appearance:none;
      position:relative; outline:none; width:52px; height:30px; flex:0 0 52px;
      border-radius:999px; background: var(--chip-bg, var(--input-bg));
      border:1px solid var(--card-border); cursor:pointer; user-select:none; touch-action:manipulation;
      transition: background-color .16s ease, border-color .16s ease, box-shadow .16s ease;
    }
    .allowlist-toggle > input[type="checkbox"]::after{
      content:''; position:absolute; left:3px; top:50%; transform: translate(0,-50%);
      width:24px; height:24px; border-radius:50%; background: var(--surface, #fff);
      border: 2px solid #fff; box-shadow: 0 2px 6px rgba(0,0,0,.15);
      transition: transform .16s ease, border-color .16s ease, box-shadow .16s ease;
    }
    .allowlist-toggle > input[type="checkbox"]:checked{
      background: var(--fl-purple, #6c5ce7); border-color: var(--input-bg);
    }
    .allowlist-toggle > input[type="checkbox"]:checked::after{ transform: translate(22px,-50%); border-color:#fff; }
    .allowlist-toggle > input[type="checkbox"]:.focus-visible{ box-shadow: 0 0 0 3px color-mix(in oklab, var(--fl-purple, #6c5ce7) 30%, transparent); }
    .allowlist-toggle__text{ display:flex; flex-direction:column; line-height:1.25; }
    .allowlist-toggle__text > span{ color: var(--muted); font-size:12px; }
  `;
  const existing = document.getElementById(id) as HTMLStyleElement | null;
  if (existing) existing.textContent = css;
  else {
    const s = document.createElement('style'); s.id = id; s.textContent = css; document.head.appendChild(s);
  }
}

/* ──────────────────────────────────────────────────────────────
   Helpers
   ────────────────────────────────────────────────────────────── */
type Mode = 'upload' | 'paste';
function toCsvPreviewRows(list: string[], max = 50) { return list.slice(0, max); }

/* ──────────────────────────────────────────────────────────────
   Props
   ────────────────────────────────────────────────────────────── */
type Props = {
  value: WizardData;
  onChange: (next: WizardData) => void;
  onNext: () => void;
  onBack: () => void;
  stepNumber?: number;
};

export default function StepAllowlist({ value, onChange, onNext, onBack, stepNumber = 4 }: Props) {
  useEffect(() => { injectAllowlistCSS(); ensureSwitchStyles(); }, []);

  const [enabled, setEnabled] = useState<boolean>(!!value.allowlist?.enabled);
  const [mode, setMode] = useState<Mode>('upload');

  // canonical allowlist state
  const [addresses, setAddresses] = useState<string[]>(value.allowlist?.addresses ?? []);
  const [root, setRoot] = useState<string>(value.allowlist?.root ?? '');
  const [count, setCount] = useState<number>(value.allowlist?.count ?? 0);

  // paste UI state
  const [pasteText, setPasteText] = useState<string>('');
  const [invalidCount, setInvalidCount] = useState<number>(0);

  // reset when toggling off
  useEffect(() => {
    if (!enabled) {
      setAddresses([]); setRoot(''); setCount(0);
      setPasteText(''); setInvalidCount(0);
    }
  }, [enabled]);

  // parse & build merkle for paste mode
  function parsePasted(text: string) {
    const raw = text.split(/[\n,]+/g).map(s => s.trim()).filter(Boolean);
    const bad: string[] = [];
    const good = raw.filter(a => {
      const ok = isAddress(a);
      if (!ok) bad.push(a);
      return ok;
    });
    const dedup = Array.from(new Set(good.map(a => a.toLowerCase())));
    if (dedup.length === 0) {
      setAddresses([]); setRoot(''); setCount(0); setInvalidCount(bad.length);
      return;
    }
    const { root } = makeMerkle(dedup);
    setAddresses(dedup); setRoot(root); setCount(dedup.length); setInvalidCount(bad.length);
  }
  useEffect(() => {
    if (!enabled || mode !== 'paste') return;
    parsePasted(pasteText);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pasteText, enabled, mode]);

  // dynamic CTA guidance
  const nextIssue = useMemo(() => {
    if (!enabled) return null; // open sale → nothing required
    // enabled
    const rootOk = root.startsWith('0x') && root.length === 66;
    if (mode === 'upload') {
      if (count <= 0) return 'Upload a CSV with 1+ valid addresses';
      if (!rootOk) return 'CSV processed, but Merkle root looks invalid';
      return null;
    }
    // paste
    const hasText = pasteText.trim().length > 0;
    if (!hasText) return 'Paste 1+ wallet addresses';
    if (count <= 0 && invalidCount > 0) return 'No valid addresses detected — check formatting';
    if (invalidCount > 0 && count > 0) {
      const s = invalidCount === 1 ? '' : 'es';
      return `Fix ${invalidCount} invalid address${s}`;
    }
    if (count <= 0) return 'Add at least 1 valid address';
    if (!rootOk) return 'Unable to compute Merkle root';
    return null;
  }, [enabled, mode, pasteText, count, invalidCount, root]);

  const valid = nextIssue === null;

  function commitAndNext() {
    if (!valid) return;
    onChange({
      ...value,
      allowlist: enabled ? { enabled: true, root, count, addresses } : { enabled: false },
    });
    onNext();
  }

  return (
    <div className="card wizard-card">
      <StepHeader
        n={stepNumber}
        text="Allowlist"
        info={<InfoIcon text="Turn on an allowlist for a private sale. Upload a CSV or paste addresses; we’ll validate, de-dupe, and generate the Merkle root used on-chain." />}
      />

      {/* Enable toggle */}
      <label className="allowlist-toggle">
        <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
        <span className="allowlist-toggle__text">
          <b>Enable allowlist</b>
          <span>(private sale)</span>
        </span>
      </label>

      {!enabled ? (
        <div style={{ color: 'var(--muted)' }}>
          Leave disabled for an open sale. You can enable it anytime before launch.
        </div>
      ) : (
        <div className="aw-card" role="group" aria-labelledby="allowlist-mode">
          {/* Mode chips */}
          <div id="allowlist-mode" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
            <button
              type="button"
              className="button mode-chip"
              aria-pressed={mode === 'upload'}
              onClick={() => setMode('upload')}
            >
              Upload CSV
            </button>
            <button
              type="button"
              className="button mode-chip"
              aria-pressed={mode === 'paste'}
              onClick={() => setMode('paste')}
            >
              Paste addresses
            </button>
          </div>

          {/* Body */}
          {mode === 'upload' ? (
            <AllowlistUploader
              onResult={({ root, count, addresses }) => {
                setRoot(root); setCount(count); setAddresses(addresses);
                setPasteText(''); setInvalidCount(0);
              }}
            />
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                Paste addresses separated by commas or new lines. We’ll validate, de-dupe, lowercase, and build the Merkle root.
              </div>

              <textarea
                className="aw-textarea"
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                placeholder={`0x1111...\n0x2222...\n0x3333...`}
                rows={8}
              />

              <div className="aw-kv" style={{ fontFamily: 'var(--font-data)' }}>
                <span className="aw-badge">Valid: <b style={{ color: 'var(--fl-aqua)' }}>{count}</b></span>
                <span className="aw-badge">Invalid: <b style={{ color: 'var(--fl-danger)' }}>{invalidCount}</b></span>
              </div>

              {addresses.length > 0 && (
                <div style={{ display: 'grid', gap: 6 }}>
                  <div style={{ fontWeight: 700 }}>
                    Preview <span style={{ color: 'var(--muted)', fontWeight: 400 }}>(first {Math.min(50, addresses.length)})</span>
                  </div>
                  <div className="aw-preview">
                    {toCsvPreviewRows(addresses).map((a, i) => (
                      <div key={i} style={{ fontSize: 12, lineHeight: 1.4 }}>{a}</div>
                    ))}
                    {addresses.length > 50 && (
                      <div style={{ opacity: 0.7, marginTop: 6, fontSize: 12 }}>…and {addresses.length - 50} more</div>
                    )}
                  </div>
                </div>
              )}

              {root && (
                <div style={{ display: 'grid', gap: 6 }}>
                  <div style={{ fontWeight: 700 }}>Merkle Root</div>
                  <code
                    style={{
                      background: 'var(--input-bg)',
                      border: '1px solid var(--input-border)',
                      color: 'var(--text)',
                      padding: 8, borderRadius: 8, wordBreak: 'break-all', opacity: .95
                    }}
                  >
                    {root}
                  </code>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Summary */}
      <div className="aw-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <div style={{ fontWeight: 800 }}>Summary</div>
          <span className="aw-badge">Preview</span>
        </div>
        <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', fontFamily: 'var(--font-data)' }}>
          <div>Allowlist: <b>{enabled ? 'Enabled' : 'Disabled'}</b></div>
          {enabled && (
            <>
              <div>Addresses: <b>{count}</b></div>
              <div>
                Root: <code style={{ color: 'var(--muted)' }}>{root ? `${root.slice(0, 10)}…${root.slice(-6)}` : '-'}</code>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Nav */}
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
        <button className="button button-secondary" onClick={onBack}>← Back</button>
        <button
          className={`button ${valid ? 'button-primary' : ''}`}
          onClick={commitAndNext}
          disabled={!valid}
          title={valid ? 'All set' : nextIssue ?? undefined}
          style={{ opacity: valid ? 1 : 0.75 }}
        >
          {valid ? 'Save & Continue' : nextIssue}
        </button>
      </div>
    </div>
  );
}
