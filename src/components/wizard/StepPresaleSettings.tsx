import { useMemo, useState } from 'react';
import type { WizardData } from '../../types/wizard';

type Props = {
  value: WizardData;
  onChange: (next: WizardData) => void;
  onNext: () => void;
  onBack: () => void;
};

export default function StepPresaleSettings({ value, onChange, onNext, onBack }: Props) {
  // ---------- helpers ----------
  function toNum(s: unknown): number {
    if (s === null || s === undefined) return NaN;
    const str = String(s).replace(/,/g, '').trim();
    if (!str) return NaN;
    const n = Number(str);
    return Number.isFinite(n) ? n : NaN;
  }
  function toStr(v: unknown): string {
    if (v === null || v === undefined) return '';
    return String(v);
  }
  function formatNumberInputStr(v: string): string {
    const n = toNum(v);
    return Number.isFinite(n) ? n.toLocaleString() : v;
  }

  // ---------- Presale currency ----------
  const [quote] = useState<'WAPE'>((value.sale?.quote ?? 'WAPE') as 'WAPE');

  // ---------- Schedule ----------
  const [start, setStart] = useState<string>(toStr(value.sale?.start));
  const [end, setEnd] = useState<string>(toStr(value.sale?.end));

  function fmtLocal(date: Date) {
    const pad = (n: number) => String(n).padStart(2, '0');
    const y = date.getFullYear();
    const m = pad(date.getMonth() + 1);
    const d = pad(date.getDate());
    const hh = pad(date.getHours());
    const mm = pad(date.getMinutes());
    return `${y}-${m}-${d}T${hh}:${mm}`;
  }

  const now = new Date();
  const maxFuture = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000); // +60 days

  const minStart = fmtLocal(now);
  const maxStart = fmtLocal(maxFuture);

  const minEndDate = useMemo(() => {
    if (!start) return minStart;
    const s = new Date(start);
    return fmtLocal(new Date(s.getTime() + 60 * 1000));
  }, [start]);

  const maxEndDate = useMemo(() => {
    const limit60 = maxFuture;
    if (!start) return fmtLocal(limit60);
    const s = new Date(start);
    const limit14 = new Date(s.getTime() + 14 * 24 * 60 * 60 * 1000);
    const max = limit14.getTime() < limit60.getTime() ? limit14 : limit60;
    return fmtLocal(max);
  }, [start]);

  // ---------- Caps ----------
  const [softCap, setSoftCap] = useState<string>(toStr(value.sale?.softCap));
  const [hardCap, setHardCap] = useState<string>(toStr(value.sale?.hardCap));
  const [minPerWallet, setMinPerWallet] = useState<string>(toStr(value.sale?.minPerWallet));
  const [maxPerWallet, setMaxPerWallet] = useState<string>(toStr(value.sale?.maxPerWallet));

  // ---------- Field validations ----------
  const tStart = Date.parse(start);
  const tEnd = Date.parse(end);

  const startOk = Boolean(start) && Number.isFinite(tStart) && tStart >= now.getTime() && tStart <= maxFuture.getTime();

  const endOk = useMemo(() => {
    if (!end || !Number.isFinite(tEnd)) return false;
    if (!Number.isFinite(tStart)) return false;
    if (tEnd <= tStart) return false;
    // within 14 days of start and within 60 days from now
    const maxByStart = new Date(new Date(start).getTime() + 14 * 24 * 60 * 60 * 1000).getTime();
    if (tEnd > maxByStart) return false;
    if (tEnd > maxFuture.getTime()) return false;
    return true;
  }, [end, tEnd, tStart, start]);

  const scNum = toNum(softCap);
  const hcNum = toNum(hardCap);
  const minNum = toNum(minPerWallet);
  const maxNum = toNum(maxPerWallet);

  const softCapOk = Number.isFinite(scNum) && scNum > 0;
  const hardCapOk = Number.isFinite(hcNum) && hcNum >= scNum && hcNum > 0;
  const minOk = Number.isFinite(minNum) && minNum >= 0; // allow 0 min if you want; it's required to be filled
  const maxOk = Number.isFinite(maxNum) && maxNum >= minNum && maxNum > 0;

  // ---------- Dynamic next issue ----------
  const nextIssue = useMemo(() => {
    if (!startOk) return 'Set a valid start time';
    if (!endOk) return 'Set a valid end time';
    if (!softCapOk) return 'Enter a valid soft cap (> 0)';
    if (!hardCapOk) return 'Enter a valid hard cap (≥ soft cap)';
    if (!minOk) return 'Enter a valid per-wallet minimum (≥ 0)';
    if (!maxOk) return 'Enter a valid per-wallet maximum (≥ min)';
    return null;
  }, [startOk, endOk, softCapOk, hardCapOk, minOk, maxOk]);

  const valid = nextIssue === null;

  // ---------- Save ----------
  function commitAndNext() {
    if (!valid) return;
    onChange({
      ...value,
      sale: {
        ...value.sale,
        quote,
        start,
        end,
        softCap: softCap || undefined,
        hardCap: hardCap || undefined,
        minPerWallet: minPerWallet || undefined,
        maxPerWallet: maxPerWallet || undefined,
      },
    });
    onNext();
  }

  return (
    <div className="card" style={{ padding: 16, display: 'grid', gap: 20 }}>
      <div className="h2">Presale Settings</div>

      {/* Currency + Schedule */}
      <section style={{ display: 'grid', gap: 12 }}>
        <div className="tokenomics-grid-3">
          {/* Presale Currency */}
          <label style={{ display: 'grid', gap: 6 }}>
            <div>Presale Currency</div>
            <input
              value={quote}
              readOnly
              style={{ ...inputStyle, height: 44, background: 'var(--input-bg)', color: 'var(--text)' }}
            />
            <small style={{ visibility: 'hidden' }}>placeholder</small>
          </label>

          {/* Start */}
          <label style={{ display: 'grid', gap: 6 }}>
            <div>Start (local) <span style={{ color: 'red' }}>*</span></div>
            <input
              type="datetime-local"
              value={start}
              min={minStart}
              max={maxStart}
              onFocus={(e) => (e.currentTarget as any).showPicker?.()}
              onClick={(e) => (e.currentTarget as any).showPicker?.()}
              onChange={(e) => {
                const val = e.target.value;
                setStart(val);
                if (end) {
                  const sMs = new Date(val).getTime();
                  const eMs = new Date(end).getTime();
                  const maxEndMs = new Date(maxEndDate).getTime();
                  if (!Number.isFinite(eMs) || eMs <= sMs || eMs > maxEndMs) setEnd('');
                }
              }}
              style={{ ...inputStyle, height: 44 }}
            />
            <small style={{ color: 'var(--muted)' }}>
              Must start within 60 days; not in the past.
            </small>
          </label>

          {/* End */}
          <label style={{ display: 'grid', gap: 6 }}>
            <div>End (local) <span style={{ color: 'red' }}>*</span></div>
            <input
              type="datetime-local"
              value={end}
              min={minEndDate}
              max={maxEndDate}
              onFocus={(e) => (e.currentTarget as any).showPicker?.()}
              onClick={(e) => (e.currentTarget as any).showPicker?.()}
              onChange={(e) => setEnd(e.target.value)}
              style={{ ...inputStyle, height: 44, opacity: start ? 1 : 0.7 }}
              disabled={!start}
            />
            <small style={{ color: 'var(--muted)' }}>
              End within 14 days of start, and within 60 days from today.
            </small>
          </label>
        </div>
      </section>

      {/* Caps */}
      <section style={{ display: 'grid', gap: 12 }}>
        <div className="h2" style={{ fontSize: 20 }}>Purchase Caps</div>

        <div className="tokenomics-grid-3">
          <label style={{ display: 'grid', gap: 6 }}>
            <div>Soft Cap ({quote}) <span style={{ color: 'red' }}>*</span></div>
            <input
              value={softCap}
              onChange={(e) => setSoftCap(e.target.value)}
              onBlur={(e) => setSoftCap(formatNumberInputStr(e.target.value))}
              placeholder="100"
              style={inputStyle}
              inputMode="decimal"
            />
          </label>

          <label style={{ display: 'grid', gap: 6 }}>
            <div>Hard Cap ({quote}) <span style={{ color: 'red' }}>*</span></div>
            <input
              value={hardCap}
              onChange={(e) => setHardCap(e.target.value)}
              onBlur={(e) => setHardCap(formatNumberInputStr(e.target.value))}
              placeholder="500"
              style={inputStyle}
              inputMode="decimal"
            />
          </label>

          <div />
        </div>

        <div className="tokenomics-grid-2">
          <label style={{ display: 'grid', gap: 6 }}>
            <div>Per-Wallet Min ({quote}) <span style={{ color: 'red' }}>*</span></div>
            <input
              value={minPerWallet}
              onChange={(e) => setMinPerWallet(e.target.value)}
              onBlur={(e) => setMinPerWallet(formatNumberInputStr(e.target.value))}
              placeholder="0.2"
              style={inputStyle}
              inputMode="decimal"
            />
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            <div>Per-Wallet Max ({quote}) <span style={{ color: 'red' }}>*</span></div>
            <input
              value={maxPerWallet}
              onChange={(e) => setMaxPerWallet(e.target.value)}
              onBlur={(e) => setMaxPerWallet(formatNumberInputStr(e.target.value))}
              placeholder="5"
              style={inputStyle}
              inputMode="decimal"
            />
          </label>
        </div>
      </section>

      {/* Nav */}
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
        <button className="button" onClick={onBack}>← Back</button>
        <button
          className="button button-primary"
          onClick={commitAndNext}
          disabled={!valid}
          title={nextIssue ?? 'All set'}
          style={{ opacity: valid ? 1 : 0.6 }}
        >
          {valid ? 'Save & Continue' : nextIssue}
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
