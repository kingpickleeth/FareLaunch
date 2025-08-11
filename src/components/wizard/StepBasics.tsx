import { useMemo, useRef, useState } from 'react';
import type { WizardData } from '../../types/wizard';
import { supabase } from '../../lib/supabase';

type Props = {
  value: WizardData;
  onChange: (next: WizardData) => void;
  onNext: () => void;
};

export default function StepBasics({ value, onChange, onNext }: Props) {
  const [local, setLocal] = useState<WizardData>({
    ...value,
    token: { ...value.token, decimals: value.token.decimals ?? 18 }, // default to 18 if missing
  });
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);

  // --- Validation helpers ----------------------------------------------------
  function websiteHint(input?: string): string | null {
    if (!input) return null;
    const v = input.trim();
    if (!v) return null;
    if (/\s/.test(v)) return 'Remove spaces from the URL.';

    const hasProtocol = /^https?:\/\//i.test(v);
    const withoutProto = v.replace(/^https?:\/\//i, '');
    const hasDotTld = /\.[a-z]{2,}$/i.test(withoutProto);

    if (!hasDotTld) {
      // Missing .com/.io/etc
      return `Add a TLD at the end like https://${withoutProto || 'example'}.com`;
    }
    if (!hasProtocol) {
      // Protocol missing, suggest https by default (but http is OK too)
      return `Add https:// to make it https://${withoutProto}`;
    }
    return null; // OK (http or https)
  }

  function twitterHint(input?: string): string | null {
    if (!input) return null;
    const v = input.trim();
    if (!v) return null;

    // Allow full URLs (http or https)
    const urlOk = /^https?:\/\/(x\.com|twitter\.com)\/[A-Za-z0-9_]{1,15}$/i.test(v);
    if (urlOk) return null;

    // Allow @handle
    if (v.startsWith('@')) {
      const h = v.slice(1);
      if (!/^[A-Za-z0-9_]{1,15}$/.test(h)) {
        return 'Use 1–15 letters, numbers, or underscores after @.';
      }
      return null;
    }

    // Bare handle w/o @
    if (/^[A-Za-z0-9_]{1,15}$/i.test(v)) {
      return `Add @ to make it @${v}`;
    }

    return 'Use @handle (1–15 letters/numbers/underscores) or a full URL like https://x.com/handle';
  }

  // Required fields (order matters for button message)
  const nameOk = local.project.name.trim().length >= 2;
  const descOk = (local.project.description?.trim().length ?? 0) >= 2;
  const logoOk = !!local.project.logoUrl && /^https?:\/\//i.test(local.project.logoUrl);
  const tokenNameOk = local.token.name.trim().length >= 2;
  const symOk = /^[A-Z0-9]{2,8}$/.test(local.token.symbol);

  // Optional-but-if-present-must-be-valid
  const webHelp = websiteHint(local.project.website ?? '');
  const twHelp  = twitterHint(local.project.twitter ?? '');
  const webOk   = !local.project.website || !webHelp; // valid if empty OR no hint
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
    if (file.size > 8 * 1024 * 1024) {
      alert('Logo too large (max 8MB).');
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    setLocal(prev => ({
      ...prev,
      project: { ...prev.project, logoUrl: previewUrl },
    }));

    try {
      setUploading(true);

      const ext = (file.name.split('.').pop() || 'png').toLowerCase();
      const safeName =
        (local.project.name || 'project')
          .toLowerCase()
          .replace(/[^a-z0-9-_]/g, '-')
          .replace(/-+/g, '-')
          .slice(0, 40) || 'project';
      const path = `logos/${safeName}-${Date.now()}.${ext}`;

      const { error: upErr } = await supabase
        .storage
        .from('faredrop-logos')
        .upload(path, file, {
          cacheControl: '3600',
          upsert: true,
          contentType: file.type || 'image/png',
        });

      if (upErr) throw upErr;

      const { data } = supabase.storage.from('faredrop-logos').getPublicUrl(path);

      setLocal(prev => ({
        ...prev,
        project: { ...prev.project, logoUrl: data.publicUrl },
      }));
    } catch (e: any) {
      console.error(e);
      alert(`Upload failed: ${e?.message || e}`);
    } finally {
      setUploading(false);
      try { URL.revokeObjectURL(previewUrl); } catch {}
    }
  }

  function openPicker() { fileRef.current?.click(); }
  function onKeyOpen(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openPicker(); }
  }

  function commitAndNext() {
    if (!canContinue) return;
    onChange(local);
    onNext();
  }

  return (
    <div className="card" style={{ padding: 16, display: 'grid', gap: 16, maxWidth: '100%' }}>
      <div className="h2">Basics</div>

      <div className="basics-head">
        {/* Logo */}
        <div style={{ display: 'grid', gap: 10, justifyItems: 'center', minWidth: 0 }}>
          <div
            role="button"
            tabIndex={0}
            onClick={openPicker}
            onKeyDown={onKeyOpen}
            title="Upload logo"
            style={{
              width: 96,
              height: 96,
              borderRadius: 16,
              background: 'var(--input-bg)',
              border: '1px solid var(--input-border)',
              overflow: 'hidden',
              display: 'grid',
              placeItems: 'center',
              cursor: 'pointer',
              position: 'relative',
            }}
          >
            {local.project.logoUrl ? (
              <>
                <img
                  src={local.project.logoUrl}
                  alt="logo preview"
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
                <div
                  style={{
                    position: 'absolute',
                    bottom: 6,
                    right: 6,
                    padding: '2px 6px',
                    borderRadius: 8,
                    background: 'var(--scrim)',
                    color: 'var(--fl-white)',
                    fontSize: 10,
                    opacity: 0.9,
                  }}
                >
                  {uploading ? 'Uploading…' : 'Change'}
                </div>
              </>
            ) : (
              <span style={{ color: 'var(--muted)', fontSize: 12 }}>Click to upload</span>
            )}
          </div>

          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            onChange={e => e.target.files?.[0] && handleLogo(e.target.files[0])}
            style={{ display: 'none' }}
          />
          <button
            type="button"
            className="button"
            onClick={openPicker}
            style={{ padding: '8px 12px', background: 'var(--btn-bg)', border: '1px solid var(--border)', color: 'var(--text)' }}
          >
            Upload Logo<span style={{ color: 'red' }}> *</span>
          </button>
        </div>

        {/* Fields */}
        <div style={{ display: 'grid', gap: 12, minWidth: 0 }}>
          <label style={{ display: 'grid', gap: 6, minWidth: 0 }}>
            <div>Project Name(internal)<span style={{ color: 'red' }}> *</span></div>
            <input
              value={local.project.name}
              onChange={e =>
                setLocal({
                  ...local,
                  project: { ...local.project, name: e.target.value },
                })
              }
              placeholder="Farelaunch"
              style={inputStyle}
            />
          </label>

          <label style={{ display: 'grid', gap: 6, minWidth: 0 }}>
            <div>Short Description<span style={{ color: 'red' }}> *</span></div>
            <textarea
              value={local.project.description ?? ''}
              onChange={e =>
                setLocal({
                  ...local,
                  project: { ...local.project, description: e.target.value },
                })
              }
              rows={3}
              placeholder="One-liner about the project."
              style={{ ...inputStyle, resize: 'vertical' }}
            />
          </label>

          <div className="webtw-grid">
            <label style={{ display: 'grid', gap: 6, minWidth: 0 }}>
              <div>Website</div>
              <input
                value={local.project.website ?? ''}
                onChange={e =>
                  setLocal({
                    ...local,
                    project: { ...local.project, website: e.target.value },
                  })
                }
                placeholder="https://example.com"
                style={inputStyle}
              />
              {webHelp && (
                <div style={{ color: 'red', fontSize: 12, marginTop: 2 }}>{webHelp}</div>
              )}
            </label>

            <label style={{ display: 'grid', gap: 6, minWidth: 0 }}>
              <div>Twitter</div>
              <input
                value={local.project.twitter ?? ''}
                onChange={e =>
                  setLocal({
                    ...local,
                    project: { ...local.project, twitter: e.target.value },
                  })
                }
                placeholder="@project or https://x.com/project"
                style={inputStyle}
              />
              {twHelp && (
                <div style={{ color: 'red', fontSize: 12, marginTop: 2 }}>{twHelp}</div>
              )}
            </label>
          </div>
        </div>
      </div>

      <div className="h2" style={{ marginTop: 8 }}>Token</div>

      <div className="token-grid">
        <label className="name-col" style={{ display: 'grid', gap: 6, minWidth: 0 }}>
          <div>Token Name<span style={{ color: 'red' }}> *</span></div>
          <input
            type="text"
            value={local.token.name}
            onChange={(e) =>
              setLocal({
                ...local,
                token: { ...local.token, name: e.target.value },
              })
            }
            placeholder="Farelaunch Token"
            style={inputStyle}
          />
        </label>

        <label className="ticker-col" style={{ display: 'grid', gap: 6, minWidth: 0 }}>
          <div>Ticker<span style={{ color: 'red' }}> *</span></div>
          <input
            className="ticker-input"
            type="text"
            maxLength={9}
            value={local.token.symbol}
            onChange={(e) =>
              setLocal({
                ...local,
                token: { ...local.token, symbol: e.target.value.toUpperCase() },
              })
            }
            placeholder="FLCH"
            style={inputStyle}
          />
        </label>

        <label className="decimals-col" style={{ display: 'grid', gap: 6, minWidth: 0 }}>
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
            style={{ ...inputStyle, textAlign: 'center' }}
          />
        </label>
      </div>

      <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
        <button
          className="button button-primary"
          onClick={commitAndNext}
          disabled={!canContinue}
          title={nextIssue ?? 'All set'}
          style={{ opacity: canContinue ? 1 : 0.6 }}
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
};
