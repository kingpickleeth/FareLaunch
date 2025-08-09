// src/types/wizard.ts

// For MVP we're only supporting fair launch,
// but keep the union so we can add 'presale' later without refactors.
export type SaleKind = 'fair'; // future: 'presale' | 'fair'
export type QuoteAsset = 'WAPE'; // add 'USDC' later

export interface WizardData {
  project: {
    name: string;
    description?: string;
    website?: string;
    twitter?: string;
    logoUrl?: string;
  };
  token: {
    name: string;
    symbol: string;
    decimals: number;
    // Store as string (we'll convert to bigint/wei at deploy time)
    totalSupply?: string;
  };
  sale?: {
    // Keep kind for future-proofing; defaults to 'fair'
    kind?: SaleKind;

    quote: QuoteAsset;

    // Schedule (local ISO like YYYY-MM-DDTHH:mm)
    start?: string;
    end?: string;

    // Caps
    softCap?: string;       // required at submit
    hardCap?: string;       // optional global cap

    // Fair-launch specifics
    keepPct?: number;       // 0..100, default 0 (keep nothing)
    saleTokensPool?: string; // derived: totalSupply * (100 - keepPct) / 100

    // Optional per-wallet limits
    minPerWallet?: string;
    maxPerWallet?: string;

    // future: pauseable?: boolean;
  };
  lp?: {
    percentToLP?: number;       // % of raise → LP (existing)
    lockDays?: 30 | 90 | 180 | 365;
    slippageBps?: number;
    tokenPercentToLP?: number;  // ⬅️ NEW: % of total supply → LP
  };
  fees?: {
    raisePct: number;      // 5 (platform fee on raise, %)
    supplyPct: number;     // 0.05 (platform fee on supply, %)
  };
  allowlist?: {
    enabled?: boolean;
    root?: string;
    count?: number;
    addresses?: string[]; // ⬅️ add this
  };
}

export const defaultWizard: WizardData = {
  project: { name: '', description: '' },
  token: { name: '', symbol: '', decimals: 18 },
  sale: { kind: 'fair', quote: 'WAPE', keepPct: 0 },
  allowlist: { enabled: false },
  lp: { percentToLP: 60, lockDays: 90, slippageBps: 50 },
  fees: { raisePct: 5, supplyPct: 0.05 },
};
