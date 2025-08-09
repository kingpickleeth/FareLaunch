// src/pages/LaunchWizard.tsx
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import StepBasics from '../components/wizard/StepBasics';
import StepTokenomics from '../components/wizard/StepTokenomics';
import { defaultWizard } from '../types/wizard';
import type { WizardData } from '../types/wizard';
import StepAllowlist from '../components/wizard/StepAllowlist';
import StepLPFees from '../components/wizard/StepLPFees';
import StepReview from '../components/wizard/StepReview';
import { getLaunch } from '../data/launches';

function makeFresh(): WizardData {
  // deep clone so steps don't share object refs
  return JSON.parse(JSON.stringify(defaultWizard));
}

// Map a DB row -> WizardData shape your steps expect
function rowToWizard(row: any): WizardData {
  return {
    project: {
      name: row.name ?? '',
      description: row.description ?? '',
      website: row.website ?? '',
      twitter: row.twitter ?? '',
      logoUrl: row.logo_url ?? '',
    },
    token: {
      name: row.token_name ?? '',
      symbol: row.token_symbol ?? '',
      decimals: row.token_decimals ?? 18,
      totalSupply: row.token_total_supply ?? undefined,
    },
    sale: {
      quote: row.quote ?? 'WAPE',
      start: row.start_at ?? '',
      end: row.end_at ?? '',
      softCap: row.soft_cap ?? undefined,
      hardCap: row.hard_cap ?? undefined,
      keepPct: row.keep_pct ?? 0,
      saleTokensPool: row.sale_tokens_pool ?? undefined,
      minPerWallet: row.min_per_wallet ?? undefined,
      maxPerWallet: row.max_per_wallet ?? undefined,
    },
    allowlist: row.allowlist_enabled
      ? {
          enabled: true,
          root: row.allowlist_root ?? '',
          count: row.allowlist_count ?? 0,
          // addresses live in `allowlists` table; we don't hydrate them into the wizard
        }
      : { enabled: false },
    lp: {
      percentToLP: row.lp_percent ?? 60,
      lockDays: row.lp_lock_days ?? 90,
      // adjust if you store slippage elsewhere
      slippageBps: (row as any).slippage_bps ?? 50,
    },
    fees: {
      raisePct: row.raise_fee_pct ?? 5,
      supplyPct: row.supply_fee_pct ?? 0.05,
    },
  };
}

const STORAGE_KEY = 'farelaunch_wizard_v1';

export default function LaunchWizard() {
  const [step, setStep] = useState(0);
  const [data, setData] = useState<WizardData>(makeFresh());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [hydrateKey, setHydrateKey] = useState(0); // ⬅️ forces steps to remount after hydration
  const [search] = useSearchParams();

  useEffect(() => {
    const id = search.get('id');
    if (!id) {
      // New create flow → fresh form
      setEditingId(null);
      setData(makeFresh());
      setStep(0);
      setHydrateKey((k) => k + 1); // remount steps with fresh state
      return;
    }

    // Editing a draft/existing launch → load and hydrate
    setLoading(true);
    getLaunch(id)
      .then((row) => {
        setEditingId(row.id);
        setData(rowToWizard(row));
        setStep(0);                 // optional: always start at step 0 when editing
        setHydrateKey((k) => k + 1); // remount steps so local useState picks up new props
      })
      .catch((e) => {
        console.error('Failed to load launch', e);
        // fall back to fresh if something goes wrong
        setEditingId(null);
        setData(makeFresh());
        setStep(0);
        setHydrateKey((k) => k + 1);
      })
      .finally(() => setLoading(false));
  }, [search]);

  const steps = useMemo(
    () => [
      { key: 'basics', label: 'Basics' },
      { key: 'tokenomics', label: 'Tokenomics' },
      { key: 'allowlist', label: 'Allowlist' },
      { key: 'lpfees', label: 'LP & Fees' },
      { key: 'review', label: 'Review' },
    ],
    []
  );

  function resetWizard() {
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
    setEditingId(null);
    setData(makeFresh());
    setStep(0);
    setHydrateKey((k) => k + 1);
  }

  if (loading) {
    return <div style={{ padding: 24 }}>Loading draft…</div>;
  }

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div className="card" style={{ padding: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div className="h2">{editingId ? 'Edit Launch' : 'Create Launch'}</div>
        <div style={{ fontFamily: 'var(--font-data)' }}>
          Step {step + 1} / {steps.length} — {steps[step].label}
        </div>
      </div>

      {step === 0 && (
        <StepBasics
          key={`basics-${hydrateKey}`}   // ⬅️ remount when data changes
          value={data}
          onChange={setData}
          onNext={() => setStep(1)}
        />
      )}

      {step === 1 && (
        <StepTokenomics
          key={`tok-${hydrateKey}`}
          value={data}
          onChange={setData}
          onNext={() => setStep(2)}
          onBack={() => setStep(0)}
        />
      )}

      {step === 2 && (
        <StepAllowlist
          key={`allow-${hydrateKey}`}
          value={data}
          onChange={setData}
          onNext={() => setStep(3)}
          onBack={() => setStep(1)}
        />
      )}

      {step === 3 && (
        <StepLPFees
          key={`lp-${hydrateKey}`}
          value={data}
          onChange={setData}
          onNext={() => setStep(4)}
          onBack={() => setStep(2)}
        />
      )}

      {step === 4 && (
        <StepReview
          key={`rev-${hydrateKey}`}
          value={data}
          editingId={editingId ?? undefined} // pass ID so StepReview updates same row
          onBack={() => setStep(3)}
          onFinish={resetWizard}
        />
      )}
    </div>
  );
}
