import { useEffect, useMemo, useState } from 'react';
import { simulateFairLaunch } from '../lib/simulator/fairLaunchEngine';
import type { FairLaunchInput } from '../lib/simulator/fairLaunchTypes';
import { evaluateFairLaunch, type Suggestion, groupSuggestions, successScore, scoreTone } from '../lib/simulator/fairLaunchSuggest';

const DEFAULT_INPUT: FairLaunchInput = {
  token: { symbol: 'TKN', totalSupply: 1_000_000 },
  base:  { symbol: 'APE' },
  economics: {
    totalRaised: 250,          // in APE by default
    pctTokensToLP: 10,         // % of total supply to LP
    pctRaiseToLP: 60,          // % of raised APE to LP
    pctWithholdOfRemaining: 20 // % of remaining tokens (after LP) to withhold
  },
};

export default function SimulatorPage() {
  const [inp, setInp] = useState<FairLaunchInput>(DEFAULT_INPUT);
  const res = useMemo(() => simulateFairLaunch(inp), [inp]);
  const set = <K extends keyof FairLaunchInput>(k: K, v: FairLaunchInput[K]) =>
    setInp(prev => ({ ...prev, [k]: v }));
  const suggestions = useMemo<Suggestion[]>(
    () => evaluateFairLaunch(inp, res),
    [inp, res]
  );
  const groups = useMemo(() => groupSuggestions(suggestions), [suggestions]);
  const score  = useMemo(() => successScore(suggestions), [suggestions]);
  const tone   = scoreTone(score);
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <header style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 28 }}>Fair Launch Simulator</h1>
          <p style={{ margin: '6px 0 0', color: 'var(--muted)' }}>
            Enter supply, raise, and LP splits. We’ll compute listing price, presale price, opening market cap, and proceeds.
          </p>
        </div>
      </header>

      <section
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(300px, 460px) 1fr',
          gap: 16,
          alignItems: 'start',
        }}
      >
        {/* Editor */}
        <div style={panelStyle}>
          <div style={{ display: 'grid', gap: 12 }}>
            <FieldGroup title="Token">
              <Row>
                <L>Symbol</L>
                <input
                  value={inp.token.symbol}
                  onChange={e => set('token', { ...inp.token, symbol: e.target.value.toUpperCase() })}
                  style={inputStyle}
                />
              </Row>
              <Row>
                <L>Total Supply</L>
                <CommaNumberInput
  value={inp.token.totalSupply}
  onChange={(n) => set('token', { ...inp.token, totalSupply: clampInt(String(n), 0, 1e15) })}
  min={0}
  placeholder="e.g. 1,000,000"
  style={inputStyle}
/>
              </Row>
            </FieldGroup>

            <div style={{ display: 'grid', gap: 12 }}>
  <Row>
    <L>Base Currency</L>
    <select
      value={inp.base.symbol}
      onChange={e => set('base', { symbol: e.target.value as any })}
      style={inputStyle}
    >
      <option value="APE">APE</option>
      <option value="ETH">ETH</option>
      <option value="WETH">WETH</option>
      <option value="USDC">USDC</option>
    </select>
  </Row>

  <Row>
    <L>Total Raised ({inp.base.symbol})</L>
    <CommaNumberInput
      value={inp.economics.totalRaised}
      onChange={(n) =>
        set('economics', { ...inp.economics, totalRaised: clampNum(String(n), 0, 1e12) })
      }
      min={0}
      placeholder={`e.g. 17,500`}
      style={inputStyle}
    />
  </Row>

  <Row>
    <L>% of tokens added to LP</L>
    <CommaNumberInput
      value={inp.economics.pctTokensToLP}
      onChange={(n) =>
        set('economics', { ...inp.economics, pctTokensToLP: clampNum(String(n), 0, 100) })
      }
      min={0}
      max={100}
      placeholder="e.g. 10"
      style={inputStyle}
    />
  </Row>

  <Row>
    <L>% of raise added to LP</L>
    <CommaNumberInput
      value={inp.economics.pctRaiseToLP}
      onChange={(n) =>
        set('economics', { ...inp.economics, pctRaiseToLP: clampNum(String(n), 0, 100) })
      }
      min={0}
      max={100}
      placeholder="e.g. 60"
      style={inputStyle}
    />
  </Row>

  <Row>
    <L>% of tokens to withhold (of remaining after LP)</L>
    <CommaNumberInput
      value={inp.economics.pctWithholdOfRemaining}
      onChange={(n) =>
        set('economics', { ...inp.economics, pctWithholdOfRemaining: clampNum(String(n), 0, 100) })
      }
      min={0}
      max={100}
      placeholder="e.g. 20"
      style={inputStyle}
    />
  </Row>

  <small style={{ color: 'var(--muted)' }}>
    Withhold applies to tokens remaining after LP tokens are removed. Creator proceeds are the raise minus the LP contribution.
  </small>
</div>

          </div>
        </div>

        {/* Results */}
        <div style={{ display: 'grid', gap: 16 }}>
          <div style={panelStyle}>
            <div style={{ display: 'grid', gap: 10 }}>
              <div style={{ fontWeight: 700, fontSize: 16 }}>Key Outcomes</div>
              <div style={kpiRowStyle}>
                <KPI label={`Listing Price (${inp.base.symbol}/${inp.token.symbol})`} value={fmt(res.listingPrice)} />
                <KPI label={`Presale Price (${inp.base.symbol}/${inp.token.symbol})`} value={fmt(res.presalePrice)} />
                <KPI label="Opening Market Cap" value={`${fmt(res.openingFDV)} ${inp.base.symbol}`} />
                <KPI label="LP Depth" value={`${fmt(res.baseToLP)} ${inp.base.symbol} / ${fmt(res.tokensToLP)} ${inp.token.symbol}`} />
              </div>
              <small style={{ color: 'var(--muted)' }}>
                Listing price = {inp.base.symbol} added to LP ÷ tokens added to LP. Presale price = total raised ÷ tokens for presale.
              </small>
            </div>
          </div>
{/* Combined: Success Score + Suggestions */}
<div style={panelStyle}>
  <div style={{ display: 'grid', gap: 12 }}>
    {/* Header + score chip */}
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
      <div style={{ fontWeight: 800, fontSize: 16 }}>Success & Guidance</div>
      <ScoreChip score={score} tone={tone} />
    </div>

    {/* Progress bar */}
    <div
      style={{
        height: 10,
        background: 'var(--border)',
        borderRadius: 999,
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      <div
        style={{
          width: `${score}%`,
          height: '100%',
          background:
            tone === 'good'
              ? 'linear-gradient(90deg, #00d084, #00b57f)'
              : tone === 'ok'
              ? 'linear-gradient(90deg, #ffd166, #fdbb2d)'
              : 'linear-gradient(90deg, #ff6b6b, #ff3b3b)',
        }}
      />
    </div>

    {/* Small legend + counts */}
    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
      <small style={{ color: 'var(--muted)', flex: '1 1 auto' }}>
        Score reflects detected errors (blockers) and warnings (risks) from your setup.
      </small>
      <CountPill label="Errors" count={groups.error.length} tone="error" />
      <CountPill label="Warnings" count={groups.warn.length} tone="warn" />
      <CountPill label="Info" count={groups.info.length} tone="info" />
    </div>

    {/* Grouped suggestions */}
    {suggestions.length === 0 ? (
      <div style={{ color: 'var(--muted)' }}>No issues detected.</div>
    ) : (
      <div style={{ display: 'grid', gap: 10 }}>
        {groups.error.length > 0 && (
          <div>
            <div style={{ marginBottom: 6 }}>
              <Badge tone="error" /> 
            </div>
            <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.5 }}>
              {groups.error.map((s, i) => (
                <li key={s.code + i} style={{ display: 'grid', gap: 4 }}>
                  <div>{s.message}</div>
                  {s.fix && <small style={{ color: 'var(--muted)' }}>Fix: {s.fix}</small>}
                </li>
              ))}
            </ul>
          </div>
        )}

        {groups.warn.length > 0 && (
          <div>
            <div style={{ marginBottom: 6 }}>
              <Badge tone="warn" />
            </div>
            <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.5 }}>
              {groups.warn.map((s, i) => (
                <li key={s.code + i} style={{ display: 'grid', gap: 4 }}>
                  <div>{s.message}</div>
                  {s.fix && <small style={{ color: 'var(--muted)' }}>Fix: {s.fix}</small>}
                </li>
              ))}
            </ul>
          </div>
        )}

        {groups.info.length > 0 && (
          <div>
            <div style={{ marginBottom: 6 }}>
              <Badge tone="info" />
            </div>
            <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.5 }}>
              {groups.info.map((s, i) => (
                <li key={s.code + i}>{s.message}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    )}
  </div>
</div>

          <div style={panelStyle}>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>Breakdown</div>
            <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.6 }}>
              <li>Tokens to LP: <strong>{fmt(res.tokensToLP)}</strong></li>
              <li>Tokens withheld: <strong>{fmt(res.tokensWithheld)}</strong></li>
              <li>Tokens for presale: <strong>{fmt(res.tokensForPresale)}</strong></li>
              <li>Base to LP: <strong>{fmt(res.baseToLP)} {inp.base.symbol}</strong></li>
              <li>Creator proceeds: <strong>{fmt(res.creatorProceeds)} {inp.base.symbol}</strong></li>
            </ul>
          </div>

          <WhatIfPanel inp={inp} setInp={setInp} />
        </div>
      </section>
    </div>
  );
}

/* ——— What-If controls ——— */
function WhatIfPanel({ inp, setInp }: { inp: FairLaunchInput; setInp: React.Dispatch<React.SetStateAction<FairLaunchInput>> }) {
  const set = <K extends keyof FairLaunchInput>(k: K, v: FairLaunchInput[K]) =>
    setInp(prev => ({ ...prev, [k]: v }));

  return (
    <div style={panelStyle}>
      <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>What-If</div>
      <div style={{ display: 'grid', gap: 12 }}>
        <RangeRow
          label={`Total raised (${inp.base.symbol})`}
          value={inp.economics.totalRaised}
          min={0}
          max={5000}
          step={10}
          onChange={(n) => set('economics', { ...inp.economics, totalRaised: n })}
        />
        <RangeRow
          label="% of tokens added to LP"
          value={inp.economics.pctTokensToLP}
          min={0}
          max={50}
          step={0.5}
          onChange={(n) => set('economics', { ...inp.economics, pctTokensToLP: n })}
        />
        <RangeRow
          label="% of raise added to LP"
          value={inp.economics.pctRaiseToLP}
          min={0}
          max={100}
          step={1}
          onChange={(n) => set('economics', { ...inp.economics, pctRaiseToLP: n })}
        />
        <RangeRow
          label="% of tokens to withhold (post-LP)"
          value={inp.economics.pctWithholdOfRemaining}
          min={0}
          max={100}
          step={1}
          onChange={(n) => set('economics', { ...inp.economics, pctWithholdOfRemaining: n })}
        />
      </div>
    </div>
  );
}

function RangeRow(props: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (n: number) => void;
}) {
  return (
    <div style={{ display: 'grid', gap: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ fontWeight: 700 }}>{props.label}</span>
        <span>{fmt(props.value)}</span>
      </div>
      <input
        type="range"
        min={props.min}
        max={props.max}
        step={props.step}
        value={props.value}
        onChange={(e) => props.onChange(Number(e.target.value))}
      />
    </div>
  );
}

/* ——— helpers / subcomponents ——— */
function CommaNumberInput({
    value,
    onChange,
    min,
    max,
    placeholder,
    style,
  }: {
    value: number;
    onChange: (n: number) => void;
    min?: number;
    max?: number;
    step?: number;
    placeholder?: string;
    style?: React.CSSProperties;
  }) {
    const [text, setText] = useState<string>(() =>
      value === undefined || value === null ? '' : formatWithCommas(value)
    );
  
    // sync when parent value changes externally
    useEffect(() => {
      const current = parseLooseNumber(text);
      if (value !== current) {
        setText(value === undefined || value === null ? '' : formatWithCommas(value));
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [value]);
  
    function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
      const raw = e.target.value;
      setText(raw);
  
      const parsed = parseLooseNumber(raw);
      if (!Number.isNaN(parsed)) {
        let n = parsed;
        if (typeof min === 'number') n = Math.max(min, n);
        if (typeof max === 'number') n = Math.min(max, n);
        onChange(n);
      }
    }
  
    function handleBlur() {
      const parsed = parseLooseNumber(text);
      if (Number.isNaN(parsed)) {
        // reset to last good value
        setText(value === undefined || value === null ? '' : formatWithCommas(value));
      } else {
        let n = parsed;
        if (typeof min === 'number') n = Math.max(min, n);
        if (typeof max === 'number') n = Math.min(max, n);
        setText(formatWithCommas(n));
        onChange(n);
      }
    }
  
    return (
      <input
        type="text"
        inputMode="decimal"
        placeholder={placeholder}
        value={text}
        onChange={handleChange}
        onBlur={handleBlur}
        style={style ?? inputStyle}
      />
    );
  }
  
  // parsing / formatting helpers
  function parseLooseNumber(s: string): number {
    if (!s) return NaN;
    const cleaned = s.replace(/,/g, '').trim();
    if (cleaned === '' || cleaned === '.') return NaN;
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : NaN;
  }
  function formatWithCommas(n: number): string {
    if (!Number.isFinite(n)) return '';
    // show up to 6 decimals if fractional, else integer commas
    const hasFrac = Math.abs(n % 1) > 0;
    return n.toLocaleString(undefined, {
      maximumFractionDigits: hasFrac ? 6 : 0,
    });
  }
  
function KPI({ label, value }: { label: string; value: string }) {
  return (
    <div style={{
      padding: 12,
      border: '1px solid var(--border)',
      borderRadius: 12,
      background: 'var(--fl-surface)'
    }}>
      <div style={{ color: 'var(--muted)', fontSize: 12 }}>{label}</div>
      <div style={{ fontWeight: 800, fontSize: 18 }}>{value}</div>
    </div>
  );
}
function FieldGroup({ title, children }: React.PropsWithChildren<{ title: string }>) {
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <div style={{ fontWeight: 800 }}>{title}</div>
      {children}
      <div style={{ height: 1, background: 'var(--border)', opacity: .4 }} />
    </div>
  );
}
function Row({ children }: React.PropsWithChildren<{}>) {
  return <label style={{ display: 'grid', gap: 6 }}>{children}</label>;
}
function L({ children }: React.PropsWithChildren<{}>) {
  return <span style={{ fontWeight: 700 }}>{children}</span>;
}

const panelStyle: React.CSSProperties = {
  border: '1px solid var(--border)',
  borderRadius: 14,
  padding: 14,
  background: 'var(--fl-surface)',
  boxShadow: 'var(--shadow)',
};
const inputStyle: React.CSSProperties = {
  background: 'var(--input-bg, #0000)',
  border: '1px solid var(--border)',
  borderRadius: 10,
  padding: '10px 12px',
  color: 'var(--text)',
  outline: 'none',
};
const kpiRowStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(4, minmax(160px, 1fr))',
  gap: 10,
};

function clampInt(s: string, min: number, max: number) {
  const n = Math.max(min, Math.min(max, Math.floor(Number(s) || 0)));
  return n;
}
function clampNum(s: string, min: number, max: number) {
  const n = Math.max(min, Math.min(max, Number(s) || 0));
  return n;
}
function fmt(n: number) {
  if (!isFinite(n)) return '—';
  if (n === 0) return '0';
  const abs = Math.abs(n);
  const digits = abs >= 1 ? 4 : 6;
  return n.toLocaleString(undefined, { maximumFractionDigits: digits });
}
function Badge({ tone }: { tone: 'error' | 'warn' | 'info' }) {
    const bg =
      tone === 'error' ? 'rgba(255,80,80,.15)' :
      tone === 'warn'  ? 'rgba(255,200,0,.15)' :
                         'rgba(80,160,255,.15)';
    const fg =
      tone === 'error' ? '#ff5050' :
      tone === 'warn'  ? '#e6b800' :
                         '#66aaff';
    return (
      <span style={{
        display: 'inline-block',
        padding: '2px 8px',
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 800,
        background: bg,
        color: fg,
        border: `1px solid ${fg}33`,
        marginRight: 6,
        textTransform: 'uppercase',
        letterSpacing: .3
      }}>
        {tone}
      </span>
    );
  }
  function ScoreChip({ score, tone }: { score: number; tone: 'bad' | 'ok' | 'good' }) {
    const bg =
      tone === 'good' ? 'rgba(0,208,132,.15)' :
      tone === 'ok'   ? 'rgba(255,210,102,.15)' :
                        'rgba(255,107,107,.15)';
    const fg =
      tone === 'good' ? '#00d084' :
      tone === 'ok'   ? '#fdbb2d' :
                        '#ff6b6b';
    return (
      <span style={{
        padding: '4px 10px',
        borderRadius: 999,
        background: bg,
        color: fg,
        border: `1px solid ${fg}33`,
        fontWeight: 800
      }}>
        {score}/100
      </span>
    );
  }
  
  function CountPill({ label, count, tone }: { label: string; count: number; tone: 'error' | 'warn' | 'info' }) {
    const colors = tone === 'error'
      ? { bg: 'rgba(255,80,80,.15)', fg: '#ff5050' }
      : tone === 'warn'
      ? { bg: 'rgba(255,200,0,.15)', fg: '#e6b800' }
      : { bg: 'rgba(80,160,255,.15)', fg: '#66aaff' };
    return (
      <span style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 10px',
        borderRadius: 999,
        background: colors.bg,
        color: colors.fg,
        border: `1px solid ${colors.fg}33`,
        fontWeight: 700,
        fontSize: 12
      }}>
        {label}: <strong style={{ fontSize: 13 }}>{count}</strong>
      </span>
    );
  }
  