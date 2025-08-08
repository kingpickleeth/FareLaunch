import { useMemo, useState } from 'react';
import type { WizardData } from '../../types/wizard';

type Props = {
  value: WizardData;
  onChange: (next: WizardData) => void;
  onNext: () => void;
  onBack: () => void;
};

export default function StepLPFees({ value, onChange, onNext, onBack }: Props) {
  const [percentToLP, setPercentToLP] = useState<number>(value.lp?.percentToLP ?? 60);
  const [lockDays, setLockDays] = useState<30 | 90 | 180 | 365>(value.lp?.lockDays ?? 90);
  const [slippageBps] = useState<number>(value.lp?.slippageBps ?? 50);

  const totalSupply = Number(value.token.totalSupply ?? NaN);
  const supplyFeePct = value.fees?.supplyPct ?? 0.05;  // %
  const raiseFeePct = value.fees?.raisePct ?? 5;       // %
  const salePool = Number(value.sale?.saleTokensPool ?? NaN);

  const platformSupplyFeeTokens = useMemo(() => {
    if (!Number.isFinite(totalSupply)) return NaN;
    return (totalSupply * (supplyFeePct / 100));
  }, [totalSupply, supplyFeePct]);

  // Note: final raise unknown in fair launch until end.
  // We show formula to keep user informed.
  const raiseFormula = `${raiseFeePct}% of total raised at finalize`;

  const canContinue = Number.isFinite(totalSupply) && Number.isFinite(salePool) && percentToLP > 0;

  function commitAndNext() {
    if (!canContinue) return;
    onChange({
      ...value,
      lp: { percentToLP, lockDays, slippageBps },
      fees: { raisePct: raiseFeePct, supplyPct: supplyFeePct },
    });
    onNext();
  }

  return (
    <div className="card" style={{ padding: 16, display: 'grid', gap: 16 }}>
      <div className="h2">LP & Fees</div>

      <section style={{ display: 'grid', gap: 12 }}>
        <div className="h2" style={{ fontSize: 20 }}>Liquidity</div>

        <label style={{ display: 'grid', gap: 6, maxWidth: 360 }}>
          <div>% of raise to add to LP</div>
          <input
            type="range" min={40} max={80} step={5}
            value={percentToLP}
            onChange={(e) => setPercentToLP(Number(e.target.value))}
          />
          <div style={{ fontFamily: 'var(--font-data)' }}>{percentToLP}%</div>
        </label>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {[30, 90, 180, 365].map(d => (
            <button
              key={d}
              type="button"
              className="button"
              onClick={() => setLockDays(d as 30 | 90 | 180 | 365)}
              style={{ background: lockDays === d ? 'var(--fl-purple)' : '#2a2d36', color:'#fff' }}
            >
              Lock {d}d
            </button>
          ))}
        </div>

        <label style={{ display: 'grid', gap: 6, maxWidth: 220 }}>
       
<div>Swap slippage (auto): <b>3.0%</b></div>
        </label>
      </section>

      <section className="card" style={{ background:'#141720', padding: 12, borderRadius: 12, display:'grid', gap: 8 }}>
        <div style={{ fontWeight: 700 }}>Fee Preview</div>
        <div style={{ display:'flex', gap:18, flexWrap:'wrap', fontFamily:'var(--font-data)' }}>
          <div>Platform fee on raise: <b>{raiseFormula}</b></div>
          <div>Platform fee on supply (0.05%): <b>
            {Number.isFinite(platformSupplyFeeTokens)
              ? platformSupplyFeeTokens.toString()
              : '-'
            } tokens
          </b></div>
          <div>LP Pair: <b>{value.token.symbol || 'TOKEN'}/WAPE (Camelot)</b></div>
          <div>Lock Duration: <b>{lockDays} days</b></div>
        </div>
        <small style={{ opacity:.7 }}>
          Final LP amounts are computed at finalize from total raised and the fair-launch price implied by the raise/sale-pool ratio.
        </small>
      </section>

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