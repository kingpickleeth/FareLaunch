import { useEffect, useMemo, useState } from 'react';
import StepBasics from '../components/wizard/StepBasics';
import StepTokenomics from '../components/wizard/StepTokenomics'; // <-- NEW
import { defaultWizard } from '../types/wizard';
import type { WizardData } from '../types/wizard';
import StepAllowlist from '../components/wizard/StepAllowlist';
import StepLPFees from '../components/wizard/StepLPFees';
import StepReview from '../components/wizard/StepReview';

const STORAGE_KEY = 'farelaunch_wizard_v1';

export default function LaunchWizard() {
  const [step, setStep] = useState(0);
  const [data, setData] = useState<WizardData>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as WizardData) : defaultWizard;
    } catch { return defaultWizard; }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [data]);

  const steps = useMemo(() => [
    { key: 'basics', label: 'Basics' },
    { key: 'tokenomics', label: 'Tokenomics' }, // merged
    { key: 'allowlist', label: 'Allowlist' },
    { key: 'lpfees', label: 'LP & Fees' },
    { key: 'review', label: 'Review' },  
  ], []);
  

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div className="card" style={{ padding: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div className="h2">Create Launch</div>
        <div style={{ fontFamily: 'var(--font-data)' }}>
          Step {step + 1} / {steps.length} — {steps[step].label}
        </div>
      </div>

      {step === 0 && (
        <StepBasics value={data} onChange={setData} onNext={() => setStep(1)} />
      )}

      {step === 1 && (
        <StepTokenomics value={data} onChange={setData} onNext={() => setStep(2)} onBack={() => setStep(0)} />
      )}
{step === 2 && (
  <StepAllowlist
    value={data}
    onChange={setData}
    onNext={() => setStep(3)}
    onBack={() => setStep(1)}
  />
)}
{step === 3 && (
  <StepLPFees
    value={data}
    onChange={setData}
    onNext={() => setStep(4)}
    onBack={() => setStep(2)}
  />
)}

{step === 4 && (
  <StepReview
    value={data}
    onBack={() => setStep(3)}
    onFinish={() => alert('Saved draft! (Deploy comes after contracts)')}
  />
)}

    </div>
  );
}
