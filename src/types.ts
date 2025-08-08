export type SalePhase = 'upcoming' | 'active' | 'ended' | 'failed';

export type SaleKind = 'presale' | 'fair';

export interface Sale {
  id: string;
  kind: SaleKind;
  name: string;
  creator: string;
  softCap: number;   // in ETH (or APE) for now
  hardCap?: number;  // optional for fair
  raised: number;
  price?: number;    // presale fixed price
  start: number;     // epoch
  end: number;       // epoch
  phase: SalePhase;
  allowlist?: boolean;
  lpLockDays?: number;
}
