import { useMemo, useState } from 'react';
import type { WizardData } from '../../types/wizard';

type Props = {
  value: WizardData;
  onChange: (next: WizardData) => void;
  onNext: () => void;
  onBack: () => void;
};

export default function StepTokenomics({ value, onChange, onNext, onBack }: Props) {
  // ---------- helpers ----------
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
  function formatNumberInputStr(v: string): string {
    const n = toNum(v);
    return Number.isFinite(n) ? n.toLocaleString() : v;
  }

  // ---------- Inputs ----------
  const [supply, setSupply] = useState<string>(toStr(value.token.totalSupply));
  const [tokenPctToLP, setTokenPctToLP] = useState<number>(
    Number.isFinite((value.lp as any)?.tokenPercentToLP)
      ? Number((value.lp as any).tokenPercentToLP)
      : 60
  );
  const [raisePctToLP, setRaisePctToLP] = useState<number>(
    Number.isFinite(value.lp?.percentToLP) ? Number(value.lp!.percentToLP) : 60
  );
  const [lockDays, setLockDays] = useState<30 | 90 | 180 | 365>(value.lp?.lockDays ?? 90);
  const [keepPct, setKeepPct] = useState<number>(
    Number.isFinite(value.sale?.keepPct as any) ? Number(value.sale!.keepPct) : 15
  );

  // ---------- Derived ----------
  const totalSupply = toNum(supply);
  const lpTokens = Number.isFinite(totalSupply) ? Math.floor((totalSupply * tokenPctToLP) / 100) : NaN;
  const remainingAfterLP = Number.isFinite(totalSupply) ? Math.max(0, totalSupply - lpTokens) : NaN;
  const keep = Number.isFinite(keepPct) ? Math.max(0, Math.min(100, keepPct)) : 0;
  const keptTokens = Number.isFinite(remainingAfterLP) ? Math.floor((remainingAfterLP * keep) / 100) : NaN;
  const tokensForSale = Number.isFinite(remainingAfterLP) && Number.isFinite(keptTokens) ? Math.max(0, remainingAfterLP - keptTokens) : NaN;
  const keptPctOfTotal = Number.isFinite(totalSupply) && totalSupply > 0 && Number.isFinite(keptTokens) ? (keptTokens / totalSupply) * 100 : NaN;
  const salePctOfTotal = Number.isFinite(totalSupply) && totalSupply > 0 && Number.isFinite(tokensForSale) ? (tokensForSale / totalSupply) * 100 : NaN;
  const ticker = value.token.symbol ? `$${value.token.symbol}` : 'tokens';
  const tokensToLP = lpTokens;
  const valid = useMemo(() => {
    if (!Number.isFinite(totalSupply) || totalSupply <= 0) return false;
    if (!Number.isFinite(lpTokens) || lpTokens < 0 || lpTokens > totalSupply) return false;
    if (!Number.isFinite(keep) || keep < 0 || keep > 100) return false;
    if (!Number.isFinite(tokenPctToLP) || tokenPctToLP < 0 || tokenPctToLP > 100) return false;
    if (!Number.isFinite(raisePctToLP) || raisePctToLP < 40 || raisePctToLP > 80) return false;
    if (![30, 90, 180, 365].includes(lockDays)) return false;
    if (!Number.isFinite(tokensForSale) || tokensForSale <= 0) return false;
    return true;
  }, [totalSupply, lpTokens, keep, tokenPctToLP, raisePctToLP, lockDays, tokensForSale]);
  const creatorRaisePct = 100 - raisePctToLP;

  function commitAndNext() {
    if (!valid) return;
    onChange({
      ...value,
      token: { ...value.token, totalSupply: supply },
      sale: {
        quote: (value.sale?.quote ?? 'WAPE') as 'WAPE',
        kind: value.sale?.kind ?? 'fair',
        ...value.sale,
        keepPct: keep,
        saleTokensPool: Number.isFinite(tokensForSale) ? String(tokensForSale) : undefined,
      },
      lp: {
        percentToLP: raisePctToLP,
        lockDays,
        slippageBps: value.lp?.slippageBps ?? 50,
        tokenPercentToLP: tokenPctToLP,
      },
    });
    onNext();
  }

  return (
    <div className="card" style={{ padding: 16, display: 'grid', gap: 20 }}>
      <div className="h2">Tokenomics</div>

      {/* 1) Supply */}
      <section style={{ display: 'grid', gap: 12 }}>
        <label style={{ display: 'grid', gap: 6 }}>
          <div>Total Supply</div>
          <input
            value={supply}
            onChange={(e) => setSupply(e.target.value)}
            onBlur={(e) => setSupply(formatNumberInputStr(e.target.value))}
            placeholder="1,000,000,000"
            style={inputStyle}
            inputMode="decimal"
          />
          <small style={{ color: 'var(--muted)' }}>
            Fixed supply (v1). Decimals: {value.token.decimals}
          </small>
        </label>
      </section>

      {/* 2) % of TOKENS to LP */}
      <section style={{ display: 'grid', gap: 12 }}>
        <div className="h2" style={{ fontSize: 20 }}>% of Tokens → LP</div>
        <label style={{ display: 'grid', gap: 6, maxWidth: 360 }}>
          <div>What % of total token supply do you want paired into the LP?</div>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={tokenPctToLP}
            onChange={(e) => setTokenPctToLP(Number(e.target.value))}
            style={rangeStyle}
          />
          <div style={{ fontFamily: 'var(--font-data)', display: 'flex', gap: 8, alignItems: 'center' }}>
            <span>{tokenPctToLP}%</span>
            {Number.isFinite(tokensToLP) && (
              <span style={{ opacity: 0.9 }}>
                &nbsp;→&nbsp; <b>{tokensToLP.toLocaleString()}</b> {ticker}
              </span>
            )}
          </div>
        </label>
      </section>

      {/* 3) % of RAISE to LP */}
      <section style={{ display: 'grid', gap: 12 }}>
        <div className="h2" style={{ fontSize: 20 }}>% of Raise → LP</div>
        <label style={{ display: 'grid', gap: 6, maxWidth: 360 }}>
          <div>What % of total raise do you want paired into the LP?</div>
          <input
            type="range"
            min={40}
            max={80}
            step={5}
            value={raisePctToLP}
            onChange={(e) => setRaisePctToLP(Number(e.target.value))}
            style={rangeStyle}
          />
          <div style={{ fontFamily: 'var(--font-data)' }}>
            {raisePctToLP}% of the raised $WAPE
          </div>
        </label>
      </section>

      {/* 4) Lock time */}
      <section style={{ display: 'grid', gap: 12 }}>
        <div className="h2" style={{ fontSize: 20 }}>Lock Liquidity For:</div>
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
                  border: '1px solid var(--border)'
                }}
              >
              {d} days
              </button>
            );
          })}
        </div>
      </section>

      {/* 5) % Remaining (Keep) */}
      <section style={{ display: 'grid', gap: 12, maxWidth: 'min(360px, 100%)' }}>
        <div>% of remaining tokens to hold:</div>
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          value={Number.isFinite(keepPct) ? String(keep) : ''}
          onChange={(e) => {
            const digits = e.target.value.replace(/[^\d]/g, '');
            const n = digits === '' ? NaN : Number(digits);
            const clamped = Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : 0;
            setKeepPct(clamped);
          }}
          style={inputStyle}
        />
        <small style={{ color: 'var(--muted)' }}>
          Applies to the remainder <i>after</i> LP tokens. Default 0% keep → entire remainder goes to sale.
        </small>
      </section>

      {/* Summary */}
      <section
        className="card"
        style={{
          background: 'var(--card-bg)',
          border: '1px solid var(--card-border)',
          padding: 12,
          borderRadius: 12,
          display: 'grid',
          gap: 6
        }}
      >
        <div style={{ fontWeight: 700 }}>Summary:</div>

        {!Number.isFinite(totalSupply) ? (
          <div style={{ color: 'var(--muted)' }}>Enter a valid total supply to see estimates.</div>
        ) : (
          <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', fontFamily: 'var(--font-data)' }}>
            <div>Total Supply: <b>{formatNumberDisplay(supply)}</b></div>

            <div>
              LP Funding: <b>{raisePctToLP}% of Raise</b> / <b>
                {Number.isFinite(lpTokens) ? lpTokens.toLocaleString() : '-'}
              </b> {ticker}
            </div>

            <div>
              Creator Proceeds: <b>
                {Number.isFinite(creatorRaisePct) ? `${creatorRaisePct}% of Raise` : '-'}
              </b> <span style={{ color: 'var(--muted)' }}>(minus fees)</span>
              {' '} & {' '}
              <b>{Number.isFinite(keptTokens) ? keptTokens.toLocaleString() : '-'}</b> {ticker}
              <span style={{ color: 'var(--muted)' }}>
                {' '}({Number.isFinite(keptPctOfTotal) ? keptPctOfTotal.toFixed(2) : '-'}% of total supply)
              </span>
            </div>

            <div>
              Tokens for Sale: <b>
                {Number.isFinite(tokensForSale) ? tokensForSale.toLocaleString() : '-'} {ticker}
              </b>
              <span style={{ color: 'var(--muted)' }}>
                {' '}({Number.isFinite(salePctOfTotal) ? salePctOfTotal.toFixed(2) : '-'}% of total supply)
              </span>
            </div>

            <div>Lock Duration: <b>{lockDays} days</b></div>
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
  background: 'var(--input-bg)',
  border: '1px solid var(--input-border)',
  color: 'var(--text)',
  borderRadius: 12,
  padding: '10px 12px',
  outline: 'none',
};

const rangeStyle: React.CSSProperties = {
  accentColor: 'var(--fl-purple)' as any,   // modern browsers
  width: '100%'
};
