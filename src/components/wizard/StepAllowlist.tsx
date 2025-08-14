// src/components/wizard/StepAllowlist.tsx
import { useEffect, useMemo, useState } from 'react';
import type { WizardData } from '../../types/wizard';
import AllowlistUploader from '../AllowlistUploader';
import { isAddress, makeMerkle } from '../../utils/merkle';
// add near top of file (below imports)
function ensureSwitchStyles() {
  const id = 'allowlist-toggle-styles';
  if (typeof document === 'undefined') return;
  const css = `
    .allowlist-toggle{
      display:flex; align-items:center; gap:12px;
      /* prevent iOS zoom */
      font-size:16px;
    }

    .allowlist-toggle > input[type="checkbox"]{
      -webkit-appearance:none; appearance:none;
      position:relative; outline:none;
      width:52px; height:30px; flex:0 0 52px;
      border-radius:999px;
      background: var(--chip-bg, var(--input-bg));
      border:1px solid var(--card-border);
      cursor:pointer; user-select:none; touch-action:manipulation;
      transition: background-color .16s ease, border-color .16s ease, box-shadow .16s ease;
    }

    /* Thumb — perfectly centered vertically */
    .allowlist-toggle > input[type="checkbox"]::after{
      content:''; position:absolute;
      left:3px; top:50%; transform: translate(0,-50%);
      width:24px; height:24px; border-radius:50%;
      background: var(--surface, #fff);
      border: 2px solid #fff;            /* persistent white ring */
      box-shadow: 0 2px 6px rgba(0,0,0,.15);
      transition: transform .16s ease, border-color .16s ease, box-shadow .16s ease;
    }

    /* Checked state */
    .allowlist-toggle > input[type="checkbox"]:checked{
      background: var(--fl-purple, #6c5ce7);
      border-color: var(--input-bg);
    }
    .allowlist-toggle > input[type="checkbox"]:checked::after{
      transform: translate(22px,-50%);   /* keep vertical centering when moved */
      border-color: #fff;                /* keep the white outline visible on purple */
    }

    /* Focus ring for a11y */
    .allowlist-toggle > input[type="checkbox"]:focus-visible{
      box-shadow: 0 0 0 3px color-mix(in oklab, var(--fl-purple, #6c5ce7) 30%, transparent);
    }

    .allowlist-toggle__text{
      display:flex; flex-direction:column; line-height:1.25;
    }
    .allowlist-toggle__text > span{ color: var(--muted); font-size:12px; }
  `;
  const existing = document.getElementById(id) as HTMLStyleElement | null;
  if (existing) existing.textContent = css;
  else {
    const s = document.createElement('style');
    s.id = id;
    s.textContent = css;
    document.head.appendChild(s);
  }
}

type Props = {
  value: WizardData;
  onChange: (next: WizardData) => void;
  onNext: () => void;
  onBack: () => void;
};

type Mode = 'upload' | 'paste';

export default function StepAllowlist({ value, onChange, onNext, onBack }: Props) {
  ensureSwitchStyles(); // injects once; safe on hot reload
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
      setAddresses([]);
      setRoot('');
      setCount(0);
      setPasteText('');
      setInvalidCount(0);
    }
  }, [enabled]);

  // parse helper for paste mode
  function parsePasted(text: string) {
    const raw = text
      .split(/[\n,]+/g)
      .map(s => s.trim())
      .filter(Boolean);

    const bad: string[] = [];
    const good = raw.filter(a => {
      const ok = isAddress(a);
      if (!ok) bad.push(a);
      return ok;
    });

    // de-dupe (case-insensitive), lowercase
    const dedup = Array.from(new Set(good.map(a => a.toLowerCase())));

    if (dedup.length === 0) {
      setAddresses([]);
      setRoot('');
      setCount(0);
      setInvalidCount(bad.length);
      return;
    }

    const { root } = makeMerkle(dedup);
    setAddresses(dedup);
    setRoot(root);
    setCount(dedup.length);
    setInvalidCount(bad.length);
  }

  // live recompute merkle when pasting
  useEffect(() => {
    if (!enabled || mode !== 'paste') return;
    parsePasted(pasteText);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pasteText, enabled, mode]);

  // summary validation
  const canContinue = useMemo(() => {
    if (!enabled) return true;
    return root.startsWith('0x') && root.length === 66 && count > 0;
  }, [enabled, root, count]);

  function commitAndNext() {
    onChange({
      ...value,
      allowlist: enabled
        ? { enabled: true, root, count, addresses }
        : { enabled: false },
    });
    onNext();
  }

  return (
    <div className="card" style={{ padding: 16, display: 'grid', gap: 16 }}>
      <div className="h2">Allowlist</div>

      {/* Enable toggle (already themed in your CSS) */}
      <label className="allowlist-toggle">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
        />
        <span className="allowlist-toggle__text">
          <b>Enable allowlist</b>
          <span>(private sale)</span>
        </span>
      </label>

      {!enabled ? (
        <div style={{ color: 'var(--muted)' }}>
          Leave disabled for an open sale. You can turn it on later before launch if needed.
        </div>
      ) : (
        <div
          className="card"
          style={{
            background: 'var(--card-bg)',
            border: '1px solid var(--card-border)',
            padding: 12,
            borderRadius: 12,
            display: 'grid',
            gap: 12
          }}
        >
          {/* Mode toggle — styled like your chips */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              className="button"
              onClick={() => setMode('upload')}
              style={{
                borderRadius: 999,
                padding: '6px 12px',
                background: mode === 'upload' ? 'var(--chip-active-bg)' : 'var(--chip-bg)',
                color: mode === 'upload' ? 'var(--chip-active-fg)' : 'var(--chip-fg)',
                border: `1px solid var(--chip-border)`,
                fontWeight: 700
              }}
            >
              Upload CSV
            </button>
            <button
              type="button"
              className="button"
              onClick={() => setMode('paste')}
              style={{
                borderRadius: 999,
                padding: '6px 12px',
                background: mode === 'paste' ? 'var(--chip-active-bg)' : 'var(--chip-bg)',
                color: mode === 'paste' ? 'var(--chip-active-fg)' : 'var(--chip-fg)',
                border: `1px solid var(--chip-border)`,
                fontWeight: 700
              }}
            >
              Paste addresses
            </button>
          </div>

          {mode === 'upload' ? (
            <AllowlistUploader
              onResult={({ root, count, addresses }) => {
                setRoot(root);
                setCount(count);
                setAddresses(addresses);
                setPasteText('');
                setInvalidCount(0);
              }}
            />
          ) : (
            <div style={{ display: 'grid', gap: 8 }}>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                Paste addresses separated by commas or new lines. We’ll validate, de-dupe, lowercase, and build the Merkle root.
              </div>

              <textarea
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                placeholder={`0x1111...\n0x2222...\n0x3333...`}
                rows={8}
                style={{
                  background: 'var(--input-bg)',
                  border: '1px solid var(--input-border)',
                  color: 'var(--text)',
                  borderRadius: 12,
                  padding: '10px 12px',
                  fontFamily: 'var(--font-data)',
                  resize: 'vertical',
                  minHeight: 120,
                  outline: 'none'
                }}
              />

              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontFamily: 'var(--font-data)' }}>
                <span>Valid: <b style={{ color: 'var(--fl-aqua)' }}>{count}</b></span>
                <span>Invalid: <b style={{ color: 'var(--fl-danger)' }}>{invalidCount}</b></span>
              </div>

              {root && (
                <div style={{ display: 'grid', gap: 6 }}>
                  <div>Merkle Root:</div>
                  <code
                    style={{
                      background: 'var(--input-bg)',
                      border: '1px solid var(--input-border)',
                      color: 'var(--text)',
                      padding: 8,
                      borderRadius: 8,
                      wordBreak: 'break-all',
                      opacity: .95
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
      <div
        className="card"
        style={{
          background: 'var(--card-bg)',
          border: '1px solid var(--card-border)',
          padding: 12,
          borderRadius: 12
        }}
      >
        <div style={{ fontWeight: 700, marginBottom: 6 }}>Summary</div>
        <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', fontFamily: 'var(--font-data)' }}>
          <div>Allowlist: <b>{enabled ? 'Enabled' : 'Disabled'}</b></div>
          {enabled && (
            <>
              <div>Addresses: <b>{count}</b></div>
              <div>
                Root:{' '}
                <code style={{ color: 'var(--muted)' }}>
                  {root ? `${root.slice(0,10)}…${root.slice(-6)}` : '-'}
                </code>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Nav */}
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
        <button className="button" onClick={onBack}>← Back</button>
        <button
          className="button button-primary"
          onClick={commitAndNext}
          disabled={!canContinue}
          style={{ opacity: canContinue ? 1 : 0.5 }}
        >
          Save & Continue
        </button>
      </div>
    </div>
  );
}
