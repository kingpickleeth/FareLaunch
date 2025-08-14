import { useMemo, useState, useEffect } from 'react';
import type { WizardData } from '../../types/wizard';

/* ---------- tiny utils (mirroring Step 2) ---------- */
function toNum(s: unknown): number {
  if (s === null || s === undefined) return NaN;
  const str = String(s).replace(/,/g, '').trim();
  if (!str) return NaN;
  const n = Number(str);
  return Number.isFinite(n) ? n : NaN;
}
function toStr(v: unknown): string { return v == null ? '' : String(v); }
function formatNumberDisplay(v: unknown): string {
  const n = toNum(v);
  return Number.isFinite(n) ? n.toLocaleString() : toStr(v);
}

/* ---------- Info tooltip (from Step 2) ---------- */
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
      position: absolute;
      top: 50%;
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
          if (r.right + 16 > vw) setPlacement('left'); else setPlacement('right');
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
            position: 'absolute',
            zIndex: 40,
            top: '50%',
            transform: 'translateY(calc(-50% + 1px))',
            minWidth: 220, maxWidth: 360,
            padding: '10px 12px',
            borderRadius: 10,
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

/* ---------- Field + Required (like Step 2) ---------- */
function Field({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <label style={{ display: 'grid', gap: 6 }}>
      <div>{label}</div>
      {children}
    </label>
  );
}
function Required() { return <span style={{ color: 'red' }}>*</span>; }

/* ---------- styles (mirroring Step 2) ---------- */
const inputStyle: React.CSSProperties = {
  background: 'var(--input-bg)',
  border: '1px solid var(--input-border)',
  color: 'var(--text)',
  borderRadius: 12,
  padding: '10px 12px',
  outline: 'none',
  width: '100%',
};
const rangeStyle: React.CSSProperties = {
  accentColor: 'var(--fl-purple)' as any,
  width: '100%',
};

/* ---------- props ---------- */
type Props = {
  value: WizardData;
  onChange: (next: WizardData) => void;
  onNext: () => void;
  onBack: () => void;
};

export default function StepTokenomics({ value, onChange, onNext, onBack }: Props) {
  /* ---------------- state ---------------- */
  const [supply, setSupply] = useState<string>(toStr(value.token.totalSupply)); // user-entered string
  // sliders start at 0 and require "touch"
  const [tokenPctToLP, setTokenPctToLP] = useState<number>(0);
  const [raisePctToLP, setRaisePctToLP] = useState<number>(0);
  const [tokenPctTouched, setTokenPctTouched] = useState<boolean>(false);
  const [raisePctTouched, setRaisePctTouched] = useState<boolean>(false);
  // lock initially unselected; appears only after both sliders touched
  const [lockDays, setLockDays] = useState<30 | 90 | 180 | 365 | undefined>(undefined);
  // keep shows only after lock selected
  const [keepPct, setKeepPct] = useState<number | ''>('');
  const [keepTouched, setKeepTouched] = useState<boolean>(false);

  /* ---------------- derived ---------------- */
  const totalSupply = toNum(supply);
  const totalSupplyOk = Number.isFinite(totalSupply) && totalSupply > 0;

  const ticker = value.token.symbol ? `$${value.token.symbol}` : 'tokens';

  const tokenPctToLPOk = Number.isFinite(tokenPctToLP) && tokenPctToLP >= 0 && tokenPctToLP <= 100;
  const raisePctToLPOk = Number.isFinite(raisePctToLP) && raisePctToLP >= 0 && raisePctToLP <= 100;

  const lpTokens = totalSupplyOk ? Math.floor((totalSupply * tokenPctToLP) / 100) : NaN;
  const remainingAfterLP = totalSupplyOk ? Math.max(0, totalSupply - (lpTokens || 0)) : NaN;

  const keepVal = typeof keepPct === 'number' ? keepPct : NaN;
  const keepOk = Number.isFinite(keepVal) && keepVal >= 0 && keepVal <= 100;

  const keptTokens =
    totalSupplyOk && Number.isFinite(remainingAfterLP) && Number.isFinite(keepVal)
      ? Math.floor((remainingAfterLP * keepVal) / 100)
      : NaN;

  const tokensForSale =
    totalSupplyOk && Number.isFinite(remainingAfterLP) && Number.isFinite(keptTokens)
      ? Math.max(0, remainingAfterLP - keptTokens)
      : NaN;

  const keptPctOfTotal =
    totalSupplyOk && Number.isFinite(keptTokens) && totalSupply > 0
      ? (keptTokens / totalSupply) * 100
      : NaN;

  const salePctOfTotal =
    totalSupplyOk && Number.isFinite(tokensForSale) && totalSupply > 0
      ? (tokensForSale / totalSupply) * 100
      : NaN;


  /* ---------------- staged gating & validation ----------------
     Order of guidance (first failure becomes CTA label):
     1) total supply
     2) tokens→LP slider must be moved (touch) & valid (0–100)
     3) raise→LP slider must be moved (touch) & valid (0–100)
     4) lock selection required
     5) keep % required (0–100)
  ------------------------------------------------------------- */
  const lockOk = lockDays === 30 || lockDays === 90 || lockDays === 180 || lockDays === 365;

  const nextIssue = useMemo(() => {
    if (!totalSupplyOk) return 'Enter a valid total supply (> 0)';
    if (!tokenPctTouched || !tokenPctToLPOk) return 'Set “% of tokens → LP” (0–100)';
    if (!raisePctTouched || !raisePctToLPOk) return 'Set “% of raise → LP” (0–100)';
    if (!lockOk) return 'Select a liquidity lock duration';
    if (!keepTouched || !keepOk) return 'Enter “% to keep” (0–100)';
    return null;
  }, [totalSupplyOk, tokenPctTouched, tokenPctToLPOk, raisePctTouched, raisePctToLPOk, lockOk, keepTouched, keepOk]);

  const valid = nextIssue === null;

  /* ---------------- commit ---------------- */
  function commitAndNext() {
    if (!valid) return;
    onChange({
      ...value,
      token: { ...value.token, totalSupply: supply },
      sale: {
        quote: (value.sale?.quote ?? 'WAPE') as 'WAPE',
        kind: value.sale?.kind ?? 'fair',
        ...value.sale,
        keepPct: Number.isFinite(keepVal) ? keepVal : 0,
        saleTokensPool: Number.isFinite(tokensForSale) ? String(tokensForSale) : undefined,
      },
      lp: {
        percentToLP: raisePctToLP,
        lockDays: lockDays as 30 | 90 | 180 | 365,
        slippageBps: value.lp?.slippageBps ?? 50,
        tokenPercentToLP: tokenPctToLP,
      },
    });
    onNext();
  }

  /* ---------------- UI helpers ---------------- */
  const supplyPlaceholder = '1,000,000,000';
  const lpTokensHint =
    totalSupplyOk && Number.isFinite(lpTokens)
      ? `${lpTokens.toLocaleString()} ${ticker}`
      : '—';

  /* ---------------- render ---------------- */
  return (
    <div className="card" style={{ padding: 16, display: 'grid', gap: 20 }}>
      <div className="h2">Tokenomics</div>

      {/* 1) Supply */}
      <section style={{ display: 'grid', gap: 12 }}>
        <Field
          label={
            <>
              Total Supply <Required />
              <InfoIcon text={`The total fixed supply of your token.`} />
            </>
          }
        >
          <input
            value={toStr(supply)}
            onChange={(e) => setSupply(e.target.value)}
            onBlur={(e) => {
              const n = toNum(e.target.value);
              if (!Number.isFinite(n) || n <= 0) setSupply('');
              else setSupply(n.toLocaleString());
            }}
            placeholder={supplyPlaceholder}
            style={inputStyle}
            inputMode="decimal"
          />
          <small style={{ color: 'var(--muted)' }}>
            Fixed supply (v1). Decimals: {value.token.decimals}
          </small>
        </Field>
      </section>

      {/* 2) % sliders — only after supply valid */}
      {totalSupplyOk && (
        <>
          {/* % of TOKENS to LP */}
          <section style={{ display: 'grid', gap: 12 }}>
            <div className="h2" style={{ fontSize: 20 }}>% of Tokens → LP</div>
            <Field
              label={
                <>
                  What % of total token supply do you want paired into the liquidity pool? <Required />
                  <InfoIcon text="These tokens are paired against the raise to form the initial liquidity pool." />
                </>
              }
            >
              <div style={{ maxWidth: 360 }}>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={tokenPctToLP}
                  onChange={(e) => { setTokenPctToLP(Number(e.target.value)); setTokenPctTouched(true); }}
                  style={rangeStyle}
                />
                <div
                  style={{
                    fontFamily: 'var(--font-data)',
                    display: 'flex',
                    gap: 8,
                    alignItems: 'center',
                    marginTop: 6,
                  }}
                >
                  <span>{tokenPctToLP}%</span>
                  <span style={{ opacity: 0.9 }}>
                    &nbsp;→&nbsp; <b>{lpTokensHint}</b>
                  </span>
                </div>
              </div>
            </Field>
          </section>

          {/* % of RAISE to LP */}
          <section style={{ display: 'grid', gap: 12 }}>
            <div className="h2" style={{ fontSize: 20 }}>% of Raise → LP</div>
            <Field
              label={
                <>
                  What % of total raise do you want paired into the liquidity pool? <Required />
                  <InfoIcon text="Portion of raised WAPE that will be paired with your tokens to seed the LP." />
                </>
              }
            >
              <div style={{ maxWidth: 360 }}>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={raisePctToLP}
                  onChange={(e) => { setRaisePctToLP(Number(e.target.value)); setRaisePctTouched(true); }}
                  style={rangeStyle}
                />
                <div style={{ fontFamily: 'var(--font-data)', marginTop: 6 }}>
                  {raisePctToLP}% of the raised $WAPE
                </div>
              </div>
            </Field>
          </section>
        </>
      )}

      {/* 3) Lock — only after BOTH sliders have been touched */}
      {totalSupplyOk && tokenPctTouched && raisePctTouched && (
        <section style={{ display: 'grid', gap: 12 }}>
          <div className="h2" style={{ fontSize: 20 }}>
            Lock Liquidity For: <Required />
            <InfoIcon text="How long your LP tokens remain locked in the locker. Longer locks build trust." />
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {[30, 90, 180, 365].map((d) => {
              const active = lockDays === d;
              return (
                <button
                  key={d}
                  type="button"
                  className="button"
                  onClick={() => setLockDays(d as 30 | 90 | 180 | 365)}
                  style={{
                    background: active ? 'var(--fl-purple)' : 'var(--btn-bg)',
                    color: active
                      ? 'var(--chip-active-fg, #ffffff)'
                      : 'var(--chip-fg, var(--fl-purple))',
                    border: '1px solid var(--border)',
                  }}
                  aria-pressed={active}
                >
                  {d} days
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* 4) Keep % — only after lock picked */}
      {totalSupplyOk && tokenPctTouched && raisePctTouched && lockOk && (
        <section style={{ display: 'grid', gap: 12, maxWidth: 'min(360px, 100%)' }}>
          <Field
            label={
              <>
                % of remaining tokens to hold: <Required />
                <InfoIcon text="After removing LP tokens, this % of the remainder is kept by the creator. The rest goes to the sale pool." />
              </>
            }
          >
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={typeof keepPct === 'number' ? String(Math.max(0, Math.min(100, keepPct))) : ''}
              onChange={(e) => {
                setKeepTouched(true);
                const digits = e.target.value.replace(/[^\d]/g, '');
                const n = digits === '' ? NaN : Number(digits);
                if (!Number.isFinite(n)) { setKeepPct(''); return; }
                const clamped = Math.min(100, Math.max(0, n));
                setKeepPct(clamped);
              }}
              onBlur={(e) => {
                const n = Number(e.target.value);
                if (!Number.isFinite(n) || n < 0) { setKeepPct(0); setKeepTouched(true); }
                else if (n > 100) { setKeepPct(100); setKeepTouched(true); }
              }}
              placeholder="0 – 100"
              style={inputStyle}
            />
            <small style={{ color: 'var(--muted)' }}>
              Applies to the remainder <i>after</i> LP tokens. Set to 0% to route all remainder to sale.
            </small>
          </Field>
        </section>
      )}

      {/* Review panel — themed clearer; only when we have supply */}
      {totalSupplyOk && (
        <section
          className="card"
          style={{
            background: 'var(--fl-surface, var(--card-bg))',
            border: '1px solid var(--card-border)',
            padding: 14,
            borderRadius: 14,
            display: 'grid',
            gap: 10,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontWeight: 800, letterSpacing: 0.2 }}>Review</div>
            <div style={{
              fontSize: 12,
              padding: '2px 8px',
              borderRadius: 999,
              border: '1px solid var(--card-border)',
              background: 'var(--input-bg)',
              color: 'var(--muted)'
            }}>
              Preview
            </div>
          </div>

          <div style={{ borderTop: '1px dashed var(--card-border)', paddingTop: 10, display: 'grid', gap: 8, fontFamily: 'var(--font-data)' }}>
            <Row label="Total Supply" value={<b>{formatNumberDisplay(supply)}</b>} />
            {tokenPctTouched && (
              <Row
                label="% Tokens → LP"
                value={
                  <>
                    <b>{tokenPctToLP}%</b>
                    <span style={{ opacity: 0.7 }}> &nbsp;·&nbsp; </span>
                    <b>{Number.isFinite(lpTokens) ? lpTokens.toLocaleString() : '-'}</b> {ticker}
                  </>
                }
              />
            )}
            {raisePctTouched && (
              <Row
                label="% Raise → LP"
                value={<b>{raisePctToLP}%</b>}
              />
            )}
            {lockOk && <Row label="Lock Duration" value={<b>{lockDays} days</b>} />}
            {keepTouched && keepOk && (
              <>
                <Row
                  label="% Remaining Kept"
                  value={
                    <>
                      <b>{keepVal}%</b>
                      <span style={{ opacity: 0.7 }}> &nbsp;·&nbsp; </span>
                      <b>{Number.isFinite(keptTokens) ? keptTokens.toLocaleString() : '-'}</b> {ticker}
                      <span style={{ color: 'var(--muted)' }}>
                        {' '}({Number.isFinite(keptPctOfTotal) ? keptPctOfTotal.toFixed(2) : '-'}%)
                      </span>
                    </>
                  }
                />
                <Row
                  label="Tokens for Sale"
                  value={
                    <>
                      <b>{Number.isFinite(tokensForSale) ? tokensForSale.toLocaleString() : '-'}</b> {ticker}
                      <span style={{ color: 'var(--muted)' }}>
                        {' '}({Number.isFinite(salePctOfTotal) ? salePctOfTotal.toFixed(2) : '-'}%)
                      </span>
                    </>
                  }
                />
              </>
            )}
          </div>
        </section>
      )}

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

/* small presentational row for the review panel */
function Row({ label, value }: { label: React.ReactNode; value: React.ReactNode }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '1fr auto',
      alignItems: 'center',
      gap: 12,
      padding: '6px 8px',
      borderRadius: 10,
      background: 'var(--review-row-bg, transparent)'
    }}>
      <div style={{ opacity: 0.8 }}>{label}</div>
      <div>{value}</div>
    </div>
  );
}
