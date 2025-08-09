import { useMemo, useState } from 'react';
import type { WizardData } from '../../types/wizard';

type Props = {
  value: WizardData;
  onChange: (next: WizardData) => void;
  onNext: () => void;
  onBack: () => void;
};

export default function StepTokenomics({ value, onChange, onNext, onBack }: Props) {
  const quote = 'WAPE' as const;

  // ---------- helpers ----------
  function toNum(s: unknown): number {
    if (s === null || s === undefined) return NaN;
    const str = String(s).replace(/,/g, '').trim(); // handles numbers/strings/null
    if (!str) return NaN;
    const n = Number(str);
    return Number.isFinite(n) ? n : NaN;
  }

  function toStr(v: unknown): string {
    if (v === null || v === undefined) return '';
    return String(v);
  }

  // ---------- Supply ----------
  const [supply, setSupply] = useState<string>(toStr(value.token.totalSupply));

  // ---------- Keep % ----------
  const [keepPct, setKeepPct] = useState<number>(Number.isFinite(value.sale?.keepPct as any) ? Number(value.sale!.keepPct) : 0);

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

  // ---------- Per-wallet caps ----------
  const [minPerWallet, setMinPerWallet] = useState<string>(toStr(value.sale?.minPerWallet));
  const [maxPerWallet, setMaxPerWallet] = useState<string>(toStr(value.sale?.maxPerWallet));

  // ---------- Derived ----------
  const totalSupply = toNum(supply);
  const keep = Number.isFinite(keepPct) ? Math.max(0, Math.min(100, keepPct)) : 0;

  const salePct = 100 - keep;
  const tokensForSale = Number.isFinite(totalSupply)
    ? Math.floor((totalSupply * salePct) / 100)
    : NaN;

  const valid = useMemo(() => {
    // supply
    if (!Number.isFinite(totalSupply) || totalSupply <= 0) return false;

    // schedule
    if (!start || !end) return false;
    const t0 = Date.parse(start); const t1 = Date.parse(end);
    if (!Number.isFinite(t0) || !Number.isFinite(t1) || t0 >= t1) return false;

    // caps
    const sc = toNum(softCap);
    if (!Number.isFinite(sc) || sc <= 0) return false;

    const hc = toNum(hardCap);
    if (hardCap && (!Number.isFinite(hc) || hc <= sc)) return false;

    // tokens for sale > 0
    if (!Number.isFinite(tokensForSale) || tokensForSale <= 0) return false;

    return true;
  }, [totalSupply, start, end, softCap, hardCap, tokensForSale]);

  function commitAndNext() {
    if (!valid) return;
    onChange({
      ...value,
      token: { ...value.token, totalSupply: supply }, // keep as string in wizard; DB layer can coerce
      sale: {
        ...value.sale,
        quote,
        start,
        end,
        keepPct: keep,
        saleTokensPool: Number.isFinite(tokensForSale) ? String(tokensForSale) : undefined,
        softCap,                                  // keep as string in wizard
        hardCap: hardCap || undefined,
        minPerWallet: minPerWallet || undefined,
        maxPerWallet: maxPerWallet || undefined,
      },
    });
    onNext();
  }

  return (
    <div className="card" style={{ padding: 16, display: 'grid', gap: 20 }}>
      <div className="h2">Tokenomics & Fair Launch</div>

      {/* Supply */}
      <section style={{ display: 'grid', gap: 12 }}>
        <label style={{ display: 'grid', gap: 6 }}>
          <div>Total Supply</div>
          <input
            value={supply}
            onChange={(e) => setSupply(e.target.value)}
            placeholder="1000000000"
            style={inputStyle}
            inputMode="decimal"
          />
          <small style={{ opacity: .7 }}>Fixed supply (v1). Decimals: {value.token.decimals}</small>
        </label>

        <div style={{ display: 'grid', gap: 6, maxWidth: 320 }}>
          <div>Percent to keep (not sold)</div>
          <input
            type="number"
            min={0}
            max={100}
            value={keep}
            onChange={(e) => setKeepPct(Number(e.target.value))}
            style={inputStyle}
          />
          <small style={{ opacity: .7 }}>
            {salePct}% of supply goes to the fair launch sale and Liquidity Pool. Default 0% keep → entire supply sold.
          </small>
        </div>
      </section>

      {/* Schedule */}
      <section style={{ display: 'grid', gap: 12 }}>
        <div
          style={{
            display: 'grid',
            gap: 12,
            gridTemplateColumns: '1fr 1fr 1fr',
            alignItems: 'end',
          }}
        >
          {/* Presale Currency */}
          <label style={{ display: 'grid', gap: 6 }}>
            <div>Presale Currency</div>
            <input value={quote} readOnly style={{ ...inputStyle, height: 44 }} />
            <small style={{ visibility: 'hidden' }}>placeholder</small>
          </label>

          {/* Start */}
          <label style={{ display: 'grid', gap: 6 }}>
            <div>Start (local)</div>
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
            <small style={{ opacity: .7 }}>Must start within 60 days; not in the past.</small>
          </label>

          {/* End */}
          <label style={{ display: 'grid', gap: 6 }}>
            <div>End (local)</div>
            <input
              type="datetime-local"
              value={end}
              min={minEndDate}
              max={maxEndDate}
              onFocus={(e) => (e.currentTarget as any).showPicker?.()}
              onClick={(e) => (e.currentTarget as any).showPicker?.()}
              onChange={(e) => setEnd(e.target.value)}
              style={{ ...inputStyle, height: 44 }}
              disabled={!start}
            />
            <small style={{ opacity: .7 }}>
              End within 14 days of start, and within 60 days from today.
            </small>
          </label>
        </div>
      </section>

      {/* Caps */}
      <section style={{ display: 'grid', gap: 12 }}>
        <div className="h2" style={{ fontSize: 20 }}>Caps</div>

        <div style={{ display: 'grid', gap: 12, gridTemplateColumns: '1fr 1fr 1fr' }}>
          <label style={{ display: 'grid', gap: 6 }}>
            <div>Soft Cap ({quote})</div>
            <input
              value={softCap}
              onChange={(e) => setSoftCap(e.target.value)}
              placeholder="100"
              style={inputStyle}
              inputMode="decimal"
            />
          </label>

          <label style={{ display: 'grid', gap: 6 }}>
            <div>Hard Cap ({quote}) <span style={{ opacity:.6 }}>(optional)</span></div>
            <input
              value={hardCap}
              onChange={(e) => setHardCap(e.target.value)}
              placeholder="(none)"
              style={inputStyle}
              inputMode="decimal"
            />
          </label>

          <div />
        </div>

        <div style={{ display: 'grid', gap: 12, gridTemplateColumns: '1fr 1fr' }}>
          <label style={{ display: 'grid', gap: 6 }}>
            <div>Per-Wallet Min ({quote})</div>
            <input
              value={minPerWallet}
              onChange={(e) => setMinPerWallet(e.target.value)}
              placeholder="0.2"
              style={inputStyle}
              inputMode="decimal"
            />
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            <div>Per-Wallet Max ({quote})</div>
            <input
              value={maxPerWallet}
              onChange={(e) => setMaxPerWallet(e.target.value)}
              placeholder="5"
              style={inputStyle}
              inputMode="decimal"
            />
          </label>
        </div>
      </section>

      {/* Summary */}
      <section className="card" style={{ background: '#141720', padding: 12, borderRadius: 12, display: 'grid', gap: 6 }}>
        <div style={{ fontWeight: 700 }}>Summary (preview)</div>
        {!Number.isFinite(totalSupply) ? (
          <div style={{ opacity: .7 }}>Enter a valid total supply to see estimates.</div>
        ) : (
          <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', fontFamily: 'var(--font-data)' }}>
            <div>Total Supply: <b>{supply || '-'}</b></div>
            <div>Kept by creator: <b>{keep}%</b></div>
            <div>Sale Allocation: <b>{salePct}%</b></div>
            <div>Tokens for Sale: <b>{Number.isFinite(tokensForSale) ? tokensForSale.toString() : '-'}</b></div>
            <div>Price: <b>Determined at end</b> (pro-rata)</div>
          </div>
        )}
      </section>

      {/* Nav */}
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
        <button className="button" onClick={onBack}>← Back</button>
        <button
          className="button button-primary"
          onClick={commitAndNext}
          disabled={!valid}
          style={{ opacity: valid ? 1 : 0.5 }}
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
