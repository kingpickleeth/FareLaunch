import { useEffect, useMemo, useRef, useState } from 'react';
import type { WizardData } from '../../types/wizard';

/* ---------- tiny utils ---------- */
function pad(n: number) { return String(n).padStart(2, '0'); }
function fmtLocal(date: Date) {
  const y = date.getFullYear();
  const m = pad(date.getMonth() + 1);
  const d = pad(date.getDate());
  const hh = pad(date.getHours());
  const mm = pad(date.getMinutes());
  return `${y}-${m}-${d}T${hh}:${mm}`;
}
function parseLocal(s?: string) {
  if (!s) return undefined;
  const t = Date.parse(s);
  return Number.isFinite(t) ? new Date(t) : undefined;
}
function startOfDay(d: Date) { const x = new Date(d); x.setHours(0,0,0,0); return x; }
function endOfDay(d: Date)   { const x = new Date(d); x.setHours(23,59,0,0); return x; }
function addMonths(d: Date, m: number) { const x = new Date(d); x.setMonth(x.getMonth() + m); return x; }
function clampDate(d: Date, min: Date, max: Date) {
  if (d.getTime() < min.getTime()) return new Date(min);
  if (d.getTime() > max.getTime()) return new Date(max);
  return d;
}
function sameYMD(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function humanRange(a?: Date, b?: Date) {
  if (!a || !b) return '';
  const ms = b.getTime() - a.getTime();
  if (ms <= 0) return '';
  const mins = Math.floor(ms / 60000);
  const d = Math.floor(mins / (60 * 24));
  const h = Math.floor((mins % (60 * 24)) / 60);
  const m = mins % 60;
  const parts: string[] = [];
  if (d) parts.push(`${d}d`);
  if (h) parts.push(`${h}h`);
  if (m || (!d && !h)) parts.push(`${m}m`);
  return parts.join(' ');
}
function display(dt?: Date) {
  return dt
    ? dt.toLocaleString(undefined, { year: 'numeric', month: '2-digit', day: '2-digit', hour: 'numeric', minute: '2-digit' })
    : '—';
}
function toNum(s: unknown): number {
  if (s == null) return NaN;
  const n = Number(String(s).trim());
  return Number.isFinite(n) ? n : NaN;
}

/* ---------- compact popover (calendar + hour/min) ---------- */
type DTPProps = {
  value?: string;
  min?: string; // inclusive
  max?: string; // inclusive
  onChange: (next: string) => void;
  disabled?: boolean;
  placeholder?: string;
};
function InfoIcon({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const tipRef = useRef<HTMLDivElement | null>(null);
  const iconRef = useRef<HTMLSpanElement | null>(null);
  const [placement, setPlacement] = useState<'right' | 'left'>('right');

  // Auto-flip when near the right edge
  useEffect(() => {
    if (!open || !tipRef.current || !iconRef.current) return;
    const tip = tipRef.current.getBoundingClientRect();
    const vw = window.innerWidth || document.documentElement.clientWidth;
    setPlacement(tip.right + 16 > vw ? 'left' : 'right');
  }, [open]);


  return (
    <span
      ref={iconRef}
      className="fl-info"
      onMouseEnter={() => setOpen(true)}
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
        width: 16,
        height: 16,
        borderRadius: '50%',
        fontSize: 12,
        lineHeight: 1,
        cursor: 'help',
        userSelect: 'none',
        color: 'var(--muted)',
        border: '1px solid var(--card-border)',
        background: 'transparent',
        transition: 'color .12s ease, border-color .12s ease, background .12s ease',
      }}
      aria-label={text}
      title="" // disable native title bubble
    >
      i

      {open && (
        <div
          ref={tipRef}
          className={`fl-tip ${placement === 'left' ? 'fl-left' : 'fl-right'}`}
          role="tooltip"
          style={{
            position: 'absolute',
            zIndex: 40,
            top: '50%',
            // positions use CSS class (right/left) below; keep here for TS types
            left: undefined as unknown as number,
            right: undefined as unknown as number,
            transform: 'translateY(calc(-50% + 1px))', // subtle downward nudge so the arrow meets the "i"
            minWidth: 220,
            maxWidth: 360,
            padding: '10px 12px',
            borderRadius: 10,
            fontSize: 12,
            lineHeight: 1.45,
            // THEME-AWARE colors: only variables, no hardcoded dark fallback
            background: 'var(--tooltip-bg, var(--popover-bg, var(--input-bg)))',
            color: 'var(--tooltip-text, var(--text))',
            border: '1px solid var(--tooltip-border, var(--card-border))',
            boxShadow: '0 10px 30px rgba(0,0,0,.18)',
            whiteSpace: 'normal',
            wordBreak: 'break-word',
            overflowWrap: 'anywhere',
          }}
        >
          {text}
        </div>
      )}
    </span>
  );
}

function DateTimePopover({ value, min, max, onChange, disabled, placeholder }: DTPProps) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLDivElement | null>(null);
  const popRef = useRef<HTMLDivElement | null>(null);

  const now = new Date();
  const valDate = parseLocal(value);
  const minDate = parseLocal(min) ?? now;
  const maxDate = parseLocal(max) ?? addMonths(now, 2);

  function commit(next: Date) {
    next.setSeconds(0, 0);
    onChange(fmtLocal(clampDate(next, minDate, maxDate)));
  }

  const [viewMonth, setViewMonth] = useState<Date>(() => startOfDay(valDate ?? now));

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!open) return;
      const t = e.target as Node;
      if (popRef.current?.contains(t)) return;
      if (anchorRef.current?.contains(t)) return;
      setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const grid = useMemo(() => {
    const first = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1);
    const startWeekday = (first.getDay() + 6) % 7; // Mon=0
    const start = new Date(first);
    start.setDate(first.getDate() - startWeekday);
    const cells: Date[] = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      cells.push(d);
    }
    return cells;
  }, [viewMonth]);

  function setDatePart(day: Date) {
    const base = valDate ?? new Date();
    const picked = new Date(day);
    picked.setHours(base.getHours(), base.getMinutes(), 0, 0);
    commit(picked);
  }

  // time controls (hour/min) with boundary disabling
  const active = valDate ?? minDate;
  const hours = active.getHours();
  const minutes = active.getMinutes();

  const isMinDay = sameYMD(active, minDate);
  const isMaxDay = sameYMD(active, maxDate);
  const minHour = isMinDay ? minDate.getHours() : 0;
  const maxHour = isMaxDay ? maxDate.getHours() : 23;
  const minuteSteps = Array.from({ length: 12 }, (_, i) => i * 5);

  function hourDisabled(h: number) { return h < minHour || h > maxHour; }
  function minuteDisabled(m: number, h: number) {
    if (isMinDay && h === minHour && m < minDate.getMinutes()) return true;
    if (isMaxDay && h === maxHour && m > maxDate.getMinutes()) return true;
    return false;
  }
  function setHour(h: number) {
    const next = new Date(active);
    next.setHours(h, minutes, 0, 0);
    if (minuteDisabled(next.getMinutes(), h)) {
      const safe = minuteSteps.find((mm) => !minuteDisabled(mm, h)) ?? (isMaxDay ? maxDate.getMinutes() : minDate.getMinutes());
      next.setMinutes(safe, 0, 0);
    }
    commit(next);
  }
  function setMinute(m: number) { const next = new Date(active); next.setMinutes(m, 0, 0); commit(next); }

  const toggleOpen = () => { if (!disabled) setOpen((v) => !v); };

  return (
    <div ref={anchorRef} style={{ position: 'relative', width: '100%', opacity: disabled ? 0.6 : 1 }}>
      <button type="button" onClick={toggleOpen} className="dtp-input" style={dtpInputStyle} disabled={disabled}>
        <span style={{ opacity: value ? 1 : 0.6 }}>
          {value ? display(parseLocal(value)) : (placeholder ?? 'Select date & time')}
        </span>
        <span aria-hidden>📅</span>
      </button>

      {open && (
        <div ref={popRef} style={dtpPopoverStyle} className="dtp-popover">
          {/* Header */}
          <div style={popHeaderStyle}>
            <button type="button" onClick={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1))} style={navBtnStyle} aria-label="Previous month">‹</button>
            <div style={{ fontWeight: 700 }}>{viewMonth.toLocaleString(undefined, { month: 'long', year: 'numeric' })}</div>
            <button type="button" onClick={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1))} style={navBtnStyle} aria-label="Next month">›</button>
          </div>

          {/* Weekdays */}
          <div style={weekdayRowStyle}>
            {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map((w) => (
              <div key={w} style={{ opacity: 0.7, fontSize: 12 }}>{w}</div>
            ))}
          </div>

          {/* Grid with strong greying for out-of-range */}
          <div style={gridStyle}>
            {grid.map((d, i) => {
              const inMonth = d.getMonth() === viewMonth.getMonth();
              const tooEarly = d.getTime() < startOfDay(minDate).getTime();
              const tooLate  = d.getTime() > endOfDay(maxDate).getTime();
              const disabledCell = tooEarly || tooLate;
              const isSelected = valDate ? sameYMD(d, valDate) : false;
              return (
                <button
                  type="button"
                  key={i}
                  onClick={() => !disabledCell && setDatePart(d)}
                  disabled={disabledCell}
                  style={{
                    ...cellStyle,
                    opacity: disabledCell ? 0.25 : (inMonth ? 1 : 0.45),
                    color: disabledCell ? 'var(--muted)' : 'var(--text)',
                    borderColor: isSelected ? 'var(--fl-gold)' : 'transparent',
                    background: isSelected ? 'rgba(255,184,46,0.12)' : 'transparent',
                    cursor: disabledCell ? 'not-allowed' : 'pointer',
                  }}
                  title={disabledCell ? 'Unavailable' : undefined}
                >
                  {d.getDate()}
                </button>
              );
            })}
          </div>

          {/* Time (no seconds) */}
          <div style={timeRowStyle}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <label style={{ fontSize: 12, opacity: 0.8 }}>Time</label>
              <select value={hours} onChange={(e) => setHour(Number(e.target.value))} style={selectStyle}>
                {Array.from({ length: 24 }, (_, h) => (
                  <option key={h} value={h} disabled={hourDisabled(h)}>{pad(h)}</option>
                ))}
              </select>
              <span>:</span>
              <select value={Math.floor(minutes / 5) * 5} onChange={(e) => setMinute(Number(e.target.value))} style={selectStyle}>
                {minuteSteps.map((m) => (
                  <option key={m} value={m} disabled={minuteDisabled(m, hours)}>{pad(m)}</option>
                ))}
              </select>
              <span style={{ opacity: 0.65, fontSize: 12 }}>
                ({parseLocal(value)?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) ?? '--:--'})
              </span>
            </div>
          </div>

          <div style={popFooterStyle}>
            <div style={{ fontSize: 12, opacity: 0.75 }}>Local: <strong>{display(parseLocal(value))}</strong></div>
            <button type="button" className="button button-primary" onClick={() => setOpen(false)} style={{ padding: '8px 10px' }}>Done</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- main step ---------- */
type Props = {
  value: WizardData;
  onChange: (next: WizardData) => void;
  onNext: () => void;
  onBack: () => void;
};

export default function StepPresaleSettings({ value, onChange, onNext, onBack }: Props) {
  const now = new Date();
  const maxFuture = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
  const [quote] = useState<'WAPE'>((value.sale?.quote ?? 'WAPE') as 'WAPE');

  // schedule
  const [start, setStart] = useState<string>(value.sale?.start ? String(value.sale?.start) : '');
  const [end, setEnd] = useState<string>(value.sale?.end ? String(value.sale?.end) : '');

  const minStart = fmtLocal(now);
  const maxStart = fmtLocal(maxFuture);

  const minEndStr = useMemo(() => {
    const s = parseLocal(start);
    if (!s) return fmtLocal(new Date(now.getTime() + 60 * 1000));
    return fmtLocal(new Date(s.getTime() + 60 * 1000));
  }, [start, now]);

  const maxEndStr = useMemo(() => {
    const s = parseLocal(start);
    if (!s) return fmtLocal(maxFuture);
    const limit14 = new Date(s.getTime() + 14 * 24 * 60 * 60 * 1000);
    return fmtLocal(limit14.getTime() < maxFuture.getTime() ? limit14 : maxFuture);
  }, [start, maxFuture]);

  const startDate = parseLocal(start);
  const endDate = parseLocal(end);

  // IMPORTANT: do NOT autofill end. Only clamp when the user HAS set an end.
  useEffect(() => {
    if (!startDate || !endDate) return; // no auto-fill
    const minE = new Date(startDate.getTime() + 60 * 1000);
    const maxE = parseLocal(maxEndStr)!;
    if (endDate.getTime() <= startDate.getTime() || endDate.getTime() > maxE.getTime()) {
      const fixed = clampDate(endDate, minE, maxE);
      fixed.setSeconds(0, 0);
      setEnd(fmtLocal(fixed));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [start]);

  // caps
  const [softCap, setSoftCap] = useState<string>(value.sale?.softCap ? String(value.sale?.softCap) : '');
  const [hardCap, setHardCap] = useState<string>(value.sale?.hardCap ? String(value.sale?.hardCap) : '');
  const [minPerWallet, setMinPerWallet] = useState<string>(value.sale?.minPerWallet ? String(value.sale?.minPerWallet) : '');
  const [maxPerWallet, setMaxPerWallet] = useState<string>(value.sale?.maxPerWallet ? String(value.sale?.maxPerWallet) : '');

  // validations
  const tStart = Number.isFinite(Date.parse(start)) ? Date.parse(start) : NaN;
  const tEnd = Number.isFinite(Date.parse(end)) ? Date.parse(end) : NaN;

  const startOk = Boolean(start) && Number.isFinite(tStart) && tStart >= now.getTime() && tStart <= maxFuture.getTime();
  const endOk = useMemo(() => {
    if (!end || !Number.isFinite(tEnd) || !Number.isFinite(tStart)) return false;
    if (tEnd <= tStart) return false;
    const maxByStart = new Date(new Date(start).getTime() + 14 * 24 * 60 * 60 * 1000).getTime();
    if (tEnd > maxByStart) return false;
    if (tEnd > maxFuture.getTime()) return false;
    return true;
  }, [end, tEnd, tStart, start, maxFuture]);

  const scheduleReady = startOk && endOk;

  const scNum = toNum(softCap);
  const hcNum = toNum(hardCap);
  const minNum = toNum(minPerWallet);
  const maxNum = toNum(maxPerWallet);

  const softCapOk = Number.isFinite(scNum) && scNum > 0;
  const hardCapOk =
  Number.isFinite(hcNum) && Number.isFinite(scNum) && hcNum >= scNum && hcNum > 0;
  const minOk = Number.isFinite(minNum) && minNum >= 0;
  const maxOk = Number.isFinite(maxNum) && maxNum >= minNum && maxNum > 0;

  const hardCapPlaceholder = softCapOk ? `Enter an amount greater than ${scNum} $WAPE` : 'enter soft cap first';
  const maxPerWalletPlaceholder = minOk ? `Enter a limit higher than ${minNum} $WAPE` : 'enter per-wallet min first';

  // live clamp: don’t allow typing below thresholds
  function onHardCapChange(v: string) {
    if (!softCapOk) { setHardCap(''); return; }
    const n = toNum(v);
    if (!Number.isFinite(n)) { setHardCap(v); return; }
    setHardCap(String(Math.max(n, scNum)));
  }
  function onMaxPerWalletChange(v: string) {
    if (!minOk) { setMaxPerWallet(''); return; }
    const n = toNum(v);
    if (!Number.isFinite(n)) { setMaxPerWallet(v); return; }
    setMaxPerWallet(String(Math.max(n, minNum)));
  }

  const nextIssue = useMemo(() => {
    if (!scheduleReady) return 'Set a valid start and end time';
    if (!softCapOk) return 'Enter a valid soft cap (> 0)';
    if (!hardCapOk) return 'Enter a valid hard cap (≥ soft cap)';
    if (!minOk) return 'Enter a valid per-wallet minimum (≥ 0)';
    if (!maxOk) return 'Enter a valid per-wallet maximum (≥ min)';
    return null;
  }, [scheduleReady, softCapOk, hardCapOk, minOk, maxOk]);

  const valid = nextIssue === null;

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
  const endPlaceholder = !start
  ? "Enter a start date first"
  : end
    ? undefined // will show the formatted end date instead
    : "Select end";

  return (
    <div className="card" style={{ padding: 16, display: 'grid', gap: 20 }}>
      <div className="h2">Presale Settings</div>

      {/* Currency + Schedule */}
      <section style={{ display: 'grid', gap: 12 }}>
        <div className="tokenomics-grid-3">
          <Field label="Presale Currency">
            <input value={quote} readOnly style={{ ...inputStyle, height: 44, background: 'var(--input-bg)', color: 'var(--text)' }} />
            <small style={{ visibility: 'hidden' }}>placeholder</small>
          </Field>

          {/* START */}
          <Field label={<>Presale Start <Required /></>}>
            <DateTimePopover
              value={start}
              min={minStart}
              max={maxStart}
              onChange={(next) => setStart(next)}
              placeholder="Select start"
            />
            <small style={{ color: 'var(--muted)' }}>Must start within 60 days; not in the past.</small>
          </Field>

          {/* END (no autofill) */}
        <Field label={<>Presale End <Required /></>}>
  <DateTimePopover
    value={end}
    min={minEndStr}
    max={maxEndStr}
    onChange={(next) => {
      const s = parseLocal(start);
      const chosen = parseLocal(next);
      if (!s || !chosen) return setEnd(next);
      const minE = new Date(s.getTime() + 60 * 1000);
      const maxE = parseLocal(maxEndStr)!;
      const fixed = clampDate(chosen, minE, maxE);
      fixed.setSeconds(0, 0);
      setEnd(fmtLocal(fixed));
    }}
    disabled={!start}
    placeholder={endPlaceholder} // ← here
  />
  <small style={{ color: 'var(--muted)' }}>
    End within 14 days of start, and within 60 days from today.
  </small>
</Field>
        </div>

        {/* Duration preview */}
        <div style={durationStyle}>
          <span style={{ opacity: 0.8 }}>⏱️ Duration:</span>
          <strong>{startDate && endDate ? humanRange(startDate, endDate) || '—' : '—'}</strong>
          <span style={{ opacity: 0.6 }}>
            ({display(startDate)} → {display(endDate)})
          </span>
        </div>
      </section>

      {/* Caps (only after valid dates) */}
      {scheduleReady && (
        <section style={{ display: 'grid', gap: 12 }}>
          <div className="h2" style={{ fontSize: 20 }}>Purchase Caps</div>

          <div className="tokenomics-grid-3">
            {/* Soft Cap */}
            <Field
  label={
    <>
      Soft Cap ({quote}) <Required />
      <InfoIcon text="This is the MINIMUM amount of money that must be raised for your token to launch. If it is not reached, all contributors are refunded at the end of the presale." />
    </>
  }
>
              <input
                type="number"
                step="any"
                min={0}
                value={softCap}
                onChange={(e) => setSoftCap(e.target.value)}
                onBlur={(e) => {
                  const v = toNum(e.target.value);
                  if (!Number.isFinite(v) || v <= 0) setSoftCap('');
                  else setSoftCap(String(v));
                }}
                placeholder="e.g. 100"
                style={inputStyle}
                inputMode="decimal"
              />
            </Field>

            {/* Hard Cap (greyed & disabled until Soft Cap valid; live clamp to ≥ soft cap) */}
            <Field
  label={
    <>
      Hard Cap ({quote}) <Required />
      <InfoIcon text="This is the MAXIMUM amount of money your presale can raise. Once this amount is reached, the presale will end automatically." />
    </>
  }
>

              <div style={{ opacity: softCapOk ? 1 : 0.5 }}>
                <input
                  type="number"
                  step="any"
                  min={softCapOk ? scNum : undefined}
                  value={hardCap}
                  onChange={(e) => onHardCapChange(e.target.value)}
                  onBlur={(e) => {
                    const v = toNum(e.target.value);
                    if (!softCapOk) { setHardCap(''); return; }
                    if (!Number.isFinite(v) || v < scNum) setHardCap(String(scNum));
                  }}
                  placeholder={hardCapPlaceholder}
                  style={inputStyle}
                  inputMode="decimal"
                  disabled={!softCapOk}
                />
              </div>
            </Field>

            <div />
          </div>

          <div className="tokenomics-grid-2">
            {/* Per-wallet Min */}
            <Field
  label={
    <>
      Per-Wallet Min ({quote}) <Required />
      <InfoIcon text="This is the MINIMUM amount of money that a contributer is required to spend on your token." />
    </>
  }
>

              <input
                type="number"
                step="any"
                min={0}
                value={minPerWallet}
                onChange={(e) => setMinPerWallet(e.target.value)}
                onBlur={(e) => {
                  const v = toNum(e.target.value);
                  if (!Number.isFinite(v) || v < 0) setMinPerWallet('0');
                  else setMinPerWallet(String(v));
                }}
                placeholder="e.g. 0.2"
                style={inputStyle}
                inputMode="decimal"
              />
            </Field>

            {/* Per-wallet Max (greyed/disabled until Min valid; live clamp to ≥ min) */}
            <Field
  label={
    <>
      Per-Wallet Max ({quote}) <Required />
      <InfoIcon text="This is the total MAXIMUM amount that an individual contributor is allowed to spend on your token." />
    </>
  }
>

              <div style={{ opacity: minOk ? 1 : 0.5 }}>
                <input
                  type="number"
                  step="any"
                  min={minOk ? minNum : undefined}
                  value={maxPerWallet}
                  onChange={(e) => onMaxPerWalletChange(e.target.value)}
                  onBlur={(e) => {
                    const v = toNum(e.target.value);
                    if (!minOk) { setMaxPerWallet(''); return; }
                    if (!Number.isFinite(v) || v < minNum) setMaxPerWallet(String(minNum));
                  }}
                  placeholder={maxPerWalletPlaceholder}
                  style={inputStyle}
                  inputMode="decimal"
                  disabled={!minOk}
                />
              </div>
            </Field>
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

/* ---------- presentational helpers ---------- */
function Field({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <label style={{ display: 'grid', gap: 6 }}>
      <div>{label}</div>
      {children}
    </label>
  );
}
function Required() { return <span style={{ color: 'red' }}>*</span>; }

/* ---------- styles ---------- */
const inputStyle: React.CSSProperties = {
  background: 'var(--input-bg)',
  border: '1px solid var(--input-border)',
  color: 'var(--text)',
  borderRadius: 12,
  padding: '10px 12px',
  outline: 'none',
  width: '100%',
};

const dtpInputStyle: React.CSSProperties = {
  ...inputStyle,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  height: 44,
  width: '100%',
  cursor: 'pointer',
};

const dtpPopoverStyle: React.CSSProperties = {
  position: 'absolute',
  zIndex: 10,
  top: 'calc(100% + 8px)',
  right: 0,
  minWidth: 320,
  padding: 12,
  borderRadius: 14,
  border: '1px solid var(--card-border)',
  background: 'var(--fl-surface, var(--surface, #1A1C23))',
  color: 'var(--text)',
  boxShadow: '0 10px 30px rgba(0,0,0,.35)',
  animation: 'dtpIn .12s ease-out',
};
const popHeaderStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 2px', marginBottom: 8 };
const navBtnStyle: React.CSSProperties = { border: '1px solid var(--card-border)', background: 'transparent', color: 'var(--text)', borderRadius: 10, padding: '4px 10px', cursor: 'pointer' };
const weekdayRowStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, padding: '4px 0' };
const gridStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 };
const cellStyle: React.CSSProperties = { border: '1px solid transparent', borderRadius: 10, padding: '8px 0', background: 'transparent', color: 'var(--text)' };
const timeRowStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--card-border)' };
const selectStyle: React.CSSProperties = { ...inputStyle, height: 36, padding: '6px 8px', width: 80 };
const popFooterStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 };
const durationStyle: React.CSSProperties = {
  marginTop: 6,
  padding: '10px 12px',
  borderRadius: 12,
  border: '1px dashed var(--input-border)',
  background: 'var(--input-bg)',
  color: 'var(--text)',
  fontSize: 13,
  display: 'flex',
  alignItems: 'center',
  gap: 8,
};

/* one-time keyframe */
const styleTagId = 'dtp-keyframe-style';
if (typeof document !== 'undefined' && !document.getElementById(styleTagId)) {
  const style = document.createElement('style');
  style.id = styleTagId;
  style.innerHTML = `@keyframes dtpIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }`;
  document.head.appendChild(style);
}
// one-time tooltip styles (theme-aware + arrow + side positioning)
// tooltip styles (theme-aware + arrow + side positioning) — upsert, not one-time
const tipStyleId = 'fl-tooltip-styles';
const tipCSS = `
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
    width: 12px;
    height: 12px;
    background: var(--tooltip-bg, var(--popover-bg, var(--input-bg)));
    border: 1px solid var(--tooltip-border, var(--card-border));
    border-right: 0;
    border-bottom: 0;
    box-shadow: -2px 2px 6px rgba(0,0,0,.10);
  }

  /* Right side placement (default) — bring bubble closer to the icon */
  .fl-right { left: calc(100% + 4px); }
  .fl-right::after { left: -4px; }

  /* Left side placement (auto-flip near screen edge) */
  .fl-left  { right: calc(100% + 4px); }
  .fl-left::after { right: -4px; transform: translateY(-50%) rotate(225deg); }
`;

if (typeof document !== 'undefined') {
  const existing = document.getElementById(tipStyleId) as HTMLStyleElement | null;
  if (existing) {
    existing.textContent = tipCSS;          // ✅ update existing styles
  } else {
    const s = document.createElement('style');
    s.id = tipStyleId;
    s.textContent = tipCSS;                  // ✅ first injection
    document.head.appendChild(s);
  }
}
