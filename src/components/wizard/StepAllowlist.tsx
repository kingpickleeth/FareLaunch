// src/components/wizard/StepAllowlist.tsx
import { useEffect, useMemo, useState } from 'react';
import type { WizardData } from '../../types/wizard';
import AllowlistUploader from '../AllowlistUploader';
import { isAddress, makeMerkle } from '../../utils/merkle';

type Props = {
  value: WizardData;
  onChange: (next: WizardData) => void;
  onNext: () => void;
  onBack: () => void;
};

type Mode = 'upload' | 'paste';

export default function StepAllowlist({ value, onChange, onNext, onBack }: Props) {
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
    // split by newline OR comma
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
    console.log('[StepAllowlist][commit] about to save', {
      enabled,
      root,
      count,
      addressesLen: addresses.length,
      sample: addresses.slice(0, 3),
      mode,
    });

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

      <label className="button" style={{ background:'#2a2d36', color:'#fff', width:'fit-content' }}>
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          style={{ marginRight: 8, color:'#ffffff' }}
        />
        Enable allowlist (private sale)
      </label>

      {!enabled ? (
        <div style={{ opacity: .8 }}>
          Leave disabled for an open sale. You can turn it on later before launch if needed.
        </div>
      ) : (
        <div className="card" style={{ background:'#141720', padding:12, borderRadius:12, display:'grid', gap:12 }}>
          {/* Mode toggle */}
          <div style={{ display:'flex', gap:8 }}>
            <button
              type="button"
              className="button"
              onClick={()=>setMode('upload')}
              style={{
                borderRadius:999,
                padding:'6px 12px',
                border:'1px solid rgba(255,255,255,.18)',
                background: mode==='upload' ? 'var(--fl-white)' : 'transparent',
                color: mode==='upload' ? '#000' : 'var(--fl-white)',
                fontWeight:700
              }}
            >
              Upload CSV
            </button>
            <button
              type="button"
              className="button"
              onClick={()=>setMode('paste')}
              style={{
                borderRadius:999,
                padding:'6px 12px',
                border:'1px solid rgba(255,255,255,.18)',
                background: mode==='paste' ? 'var(--fl-white)' : 'transparent',
                color: mode==='paste' ? '#000' : 'var(--fl-white)',
                fontWeight:700
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
                // clear paste state if coming from paste → upload
                setPasteText('');
                setInvalidCount(0);
              }}
            />
          ) : (
            <div style={{ display:'grid', gap:8 }}>
              <div style={{ fontSize:12, opacity:.85 }}>
                Paste addresses separated by commas or new lines. We’ll validate, de-dupe, lowercase, and build the Merkle root.
              </div>
              <textarea
                value={pasteText}
                onChange={(e)=>setPasteText(e.target.value)}
                placeholder={`0x1111...\n0x2222...\n0x3333...`}
                rows={8}
                style={{
                  background:'#101216',
                  border:'1px solid rgba(255,255,255,.08)',
                  color:'var(--fl-white)',
                  borderRadius:12,
                  padding:'10px 12px',
                  fontFamily:'var(--font-data)',
                  resize:'vertical',
                  minHeight:120
                }}
              />
              <div style={{ display:'flex', gap:16, flexWrap:'wrap', fontFamily:'var(--font-data)', opacity:.9 }}>
                <span>Valid: <b style={{ color:'var(--fl-aqua)' }}>{count}</b></span>
                <span>Invalid: <b style={{ color:'var(--fl-danger)' }}>{invalidCount}</b></span>
              </div>
              {root && (
                <div style={{ display:'grid', gap:6 }}>
                  <div>Merkle Root:</div>
                  <code
                    style={{
                      background:'#0f1115',
                      padding:8,
                      borderRadius:8,
                      wordBreak:'break-all',
                      opacity:.9
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
      <div className="card" style={{ background: '#141720', padding: 12, borderRadius: 12 }}>
        <div style={{ fontWeight: 700, marginBottom: 6 }}>Summary</div>
        <div style={{ display:'flex', gap:18, flexWrap:'wrap', fontFamily:'var(--font-data)' }}>
          <div>Allowlist: <b>{enabled ? 'Enabled' : 'Disabled'}</b></div>
          {enabled && (
            <>
              <div>Addresses: <b>{count}</b></div>
              <div>Root: <code style={{ opacity:.8 }}>
                {root ? `${root.slice(0,10)}…${root.slice(-6)}` : '-'}
              </code></div>
            </>
          )}
        </div>
      </div>

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
