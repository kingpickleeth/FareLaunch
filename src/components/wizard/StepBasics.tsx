import { useMemo, useRef, useState } from 'react';
import type { WizardData } from '../../types/wizard';

type Props = {
  value: WizardData;
  onChange: (next: WizardData) => void;
  onNext: () => void;
};

export default function StepBasics({ value, onChange, onNext }: Props) {
  const [local, setLocal] = useState<WizardData>(value);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const canContinue = useMemo(() => {
    const nameOk = local.project.name.trim().length >= 2;
    const tokenNameOk = local.token.name.trim().length >= 2;
    const symOk = /^[A-Z0-9]{2,8}$/.test(local.token.symbol);
    const decOk =
      Number.isFinite(local.token.decimals) &&
      local.token.decimals >= 0 &&
      local.token.decimals <= 18;
    const siteOk =
      !local.project.website ||
      /^https:\/\/.+/i.test(local.project.website.trim());
    return nameOk && tokenNameOk && symOk && decOk && siteOk;
  }, [local]);

  function handleLogo(file: File) {
    if (!file) return;
    if (file.size > 1024 * 1024 * 2) {
      alert('Logo too large (max 2MB).');
      return;
    }
    const reader = new FileReader();
    reader.onload = () =>
      setLocal(prev => ({
        ...prev,
        project: { ...prev.project, logoUrl: String(reader.result) },
      }));
    reader.readAsDataURL(file);
  }

  function openPicker() {
    fileRef.current?.click();
  }

  function onKeyOpen(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openPicker();
    }
  }

  function commitAndNext() {
    if (!canContinue) return;
    onChange(local);
    onNext();
  }

  return (
    <div className="card" style={{ padding: 16, display: 'grid', gap: 16 }}>
      <div className="h2">Basics</div>

      <div
        style={{
          display: 'grid',
          gap: 12,
          gridTemplateColumns: '120px 1fr',
          alignItems: 'center',
        }}
      >
        <div style={{ display: 'grid', gap: 10, justifyItems: 'center' }}>
          {/* Clickable logo tile */}
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
              background: '#101216',
              border: '1px solid rgba(255,255,255,.12)',
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
                    background: 'rgba(0,0,0,.5)',
                    fontSize: 10,
                    opacity: 0.9,
                  }}
                >
                  Change
                </div>
              </>
            ) : (
              <span style={{ opacity: 0.6, fontSize: 12 }}>Click to upload</span>
            )}
          </div>

          {/* Hidden input; visible button that looks like a button */}
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
            style={{
              padding: '8px 12px',
              border: '1px solid rgba(255,255,255,.12)',
            }}
          >
            Upload Logo
          </button>
        </div>

        <div style={{ display: 'grid', gap: 12 }}>
          <label style={{ display: 'grid', gap: 6 }}>
            <div>Project Name</div>
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

          <label style={{ display: 'grid', gap: 6 }}>
            <div>Short Description</div>
            <textarea
              value={local.project.description ?? ''}
              onChange={e =>
                setLocal({
                  ...local,
                  project: {
                    ...local.project,
                    description: e.target.value,
                  },
                })
              }
              rows={3}
              placeholder="One-liner about the project."
              style={{ ...inputStyle, resize: 'vertical' }}
            />
          </label>

          <div style={{ display: 'grid', gap: 12, gridTemplateColumns: '1fr 1fr' }}>
            <label style={{ display: 'grid', gap: 6 }}>
              <div>Website (https)</div>
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
            </label>

            <label style={{ display: 'grid', gap: 6 }}>
              <div>Twitter</div>
              <input
                value={local.project.twitter ?? ''}
                onChange={e =>
                  setLocal({
                    ...local,
                    project: { ...local.project, twitter: e.target.value },
                  })
                }
                placeholder="@project"
                style={inputStyle}
              />
            </label>
          </div>
        </div>
      </div>

      <div className="h2" style={{ marginTop: 8 }}>Token</div>

      <div
  style={{
    display: 'grid',
    gap: 12,
    /* Token name prefers >=160px; ticker prefers 100–160px; decimals prefers 60–100px */
    gridTemplateColumns: 'minmax(160px, 1fr) minmax(100px, 160px) minmax(30px, 70px)',
  }}
>
  {/* Token Name */}
  <label style={{ display: 'grid', gap: 6 }}>
    <div>Token Name</div>
    <input
      value={local.token.name}
      onChange={e =>
        setLocal({
          ...local,
          token: { ...local.token, name: e.target.value },
        })
      }
      placeholder="Farelaunch Token"
      style={inputStyle}
    />
  </label>

  {/* Ticker */}
  <label style={{ display: 'grid', gap: 6 }}>
    <div>Ticker</div>
    <input
      value={local.token.symbol}
      onChange={e =>
        setLocal({
          ...local,
          token: {
            ...local.token,
            symbol: e.target.value.toUpperCase(),
          },
        })
      }
      placeholder="FLCH"
      style={inputStyle}
      maxLength={8}
    />
  </label>

 {/* Decimals */}
<label style={{ display: 'grid', gap: 6 }}>
  <div>Decimals</div>
  <input
    type="number"
    min={0}
    max={18}
    value={local.token.decimals}
    onChange={e =>
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


      <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
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

const inputStyle: React.CSSProperties = {
  background: '#101216',
  border: '1px solid rgba(255,255,255,.08)',
  color: 'var(--fl-white)',
  borderRadius: 12,
  padding: '10px 12px',
  outline: 'none',
};
