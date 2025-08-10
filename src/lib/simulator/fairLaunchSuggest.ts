// src/lib/simulator/fairLaunchSuggest.ts
import type { FairLaunchInput, FairLaunchResult } from './fairLaunchTypes';

export type Suggestion = {
  severity: 'error' | 'warn' | 'info';
  code: string;
  message: string;
  fix?: string;
};

const pct = (n: number, d: number) => (d > 0 ? (n / d) * 100 : 0);

export function evaluateFairLaunch(input: FairLaunchInput, res: FairLaunchResult): Suggestion[] {
  const s: Suggestion[] = [];
  const S = input.token.totalSupply;
  const R = input.economics.totalRaised;

  const pTokLP = input.economics.pctTokensToLP;
  const pRaiseLP = input.economics.pctRaiseToLP;
  const pWithhold = input.economics.pctWithholdOfRemaining;

  const initialFloatPct = pct(res.tokensForPresale, S);
  const lpOfRaisePct = pct(res.baseToLP, R);
  const fdvToLP = res.baseToLP > 0 ? res.openingFDV / res.baseToLP : Infinity;

  // ----- sanity
  if (pTokLP < 0 || pTokLP > 100) s.push({ severity: 'error', code: 'toklp-range', message: '% of tokens to LP must be 0–100.' });
  if (pRaiseLP < 0 || pRaiseLP > 100) s.push({ severity: 'error', code: 'raiselp-range', message: '% of raise to LP must be 0–100.' });
  if (pWithhold < 0 || pWithhold > 100) s.push({ severity: 'error', code: 'withhold-range', message: '% of tokens to withhold must be 0–100.' });

  if (res.tokensToLP <= 0 && pTokLP > 0) s.push({ severity: 'error', code: 'lp-token-zero', message: 'Tokens to LP computed as 0; check supply and % tokens to LP.' });
  if (res.baseToLP <= 0 && pRaiseLP > 0) s.push({ severity: 'error', code: 'lp-base-zero', message: 'Base to LP is 0; check total raised and % raise to LP.' });

  if (res.tokensForPresale <= 0) {
    s.push({ severity: 'error', code: 'no-presale-tokens', message: 'No tokens left for presale.', fix: 'Lower % tokens to LP or lower % withhold.' });
  }

  // ----- pricing relationships
  if (res.listingPrice > 0 && res.presalePrice > 0) {
    const ratio = res.presalePrice / res.listingPrice;
    if (ratio > 1.0) {
      s.push({
        severity: 'error',
        code: 'underwater',
        message: 'Presale price is above listing price — buyers would be underwater at T0.',
        fix: 'Increase % of raise to LP, increase % tokens to LP, or reduce withhold to increase presale allocation.',
      });
    } else if (ratio < 0.7) {
      s.push({
        severity: 'warn',
        code: 'deep-discount',
        message: 'Presale price is >30% below listing price — strong flip incentive.',
        fix: 'Reduce % raise to LP or increase % tokens to LP to bring listing closer to presale.',
      });
    } else if (ratio >= 0.95 && ratio <= 1.0) {
      s.push({ severity: 'info', code: 'near-par', message: 'Presale price is close to listing price — minimal arb window.' });
    } else {
      s.push({ severity: 'info', code: 'healthy-discount', message: 'Presale discount looks healthy (5–30%).' });
    }
  }

  // ----- liquidity depth
  if (R > 0) {
    if (lpOfRaisePct < 20) {
      s.push({ severity: 'error', code: 'lp-too-thin', message: 'Less than 20% of raise to LP — very thin liquidity.', fix: 'Consider ≥40% of raise to LP.' });
    } else if (lpOfRaisePct < 40) {
      s.push({ severity: 'warn', code: 'lp-light', message: 'Less than 40% of raise to LP — could be slippy.', fix: 'Aim for 40–70% depending on goals.' });
    } else if (lpOfRaisePct > 90) {
      s.push({ severity: 'warn', code: 'lp-heavy', message: 'More than 90% of raise to LP — creator proceeds may be too low.', fix: 'Lower % raise to LP if you need runway.' });
    }
  } else if (pRaiseLP > 0) {
    s.push({ severity: 'error', code: 'lp-no-raise', message: '% raise to LP > 0 but total raised is 0.' });
  }

  // token side of LP
  if (pTokLP > 0 && pTokLP < 5) {
    s.push({ severity: 'warn', code: 'token-lp-thin', message: 'Token side of LP <5% of supply — listing price may be very high.' });
  } else if (pTokLP > 25) {
    s.push({ severity: 'warn', code: 'token-lp-heavy', message: 'Token side of LP >25% of supply — over-allocating to LP.' });
  }

  // initial float / withhold
  if (initialFloatPct < 5) {
    s.push({ severity: 'warn', code: 'float-ultra-low', message: 'Initial float <5% of supply — extreme volatility likely.', fix: 'Lower withhold or lower % tokens to LP.' });
  } else if (initialFloatPct < 10) {
    s.push({ severity: 'info', code: 'float-low', message: 'Initial float <10% — thin float can be volatile; communicate clearly.' });
  }

  if (pWithhold > 60) {
    s.push({ severity: 'warn', code: 'withhold-high', message: 'Withhold >60% of post-LP tokens — may be perceived negatively.', fix: 'Reduce withhold or disclose lockup plan.' });
  }

  // FDV vs LP
  if (isFinite(fdvToLP)) {
    if (fdvToLP > 40) {
      s.push({ severity: 'error', code: 'fdv-to-lp-extreme', message: 'FDV vs LP ratio >40 — price likely fragile.', fix: 'Increase LP or reduce listing price (adjust % tokens/base to LP).' });
    } else if (fdvToLP > 20) {
      s.push({ severity: 'warn', code: 'fdv-to-lp-high', message: 'FDV vs LP ratio >20 — consider deeper liquidity.' });
    }
  }

  // pairing consistency
  if (input.economics.pctRaiseToLP > 0 && input.economics.pctTokensToLP === 0) {
    s.push({ severity: 'error', code: 'lp-missing-token', message: 'LP has base but no token side.' });
  }
  if (input.economics.pctTokensToLP > 0 && input.economics.pctRaiseToLP === 0) {
    s.push({ severity: 'error', code: 'lp-missing-base', message: 'LP has tokens but no base side.' });
  }

  return s;
}

/* ----------------- Grouping + Success Score ----------------- */

export type SuggestionGroups = {
  error: Suggestion[];
  warn: Suggestion[];
  info: Suggestion[];
};

export function groupSuggestions(list: Suggestion[]): SuggestionGroups {
  return {
    error: list.filter(s => s.severity === 'error'),
    warn:  list.filter(s => s.severity === 'warn'),
    info:  list.filter(s => s.severity === 'info'),
  };
}

/**
 * Success Score (0–100):
 * - start at 100
 * - subtract 15 for each error, 7 for each warning (capped)
 * - extra penalties for critical cases
 */
export function successScore(list: Suggestion[]): number {
  const errors = list.filter(s => s.severity === 'error').length;
  const warns  = list.filter(s => s.severity === 'warn').length;

  const basePenalty = errors * 15 + warns * 7;

  // extra penalties for particularly risky situations
  const extra = list.reduce((sum, s) => {
    if (s.code === 'underwater') return sum + 15;        // presale > listing
    if (s.code === 'lp-too-thin') return sum + 10;       // <20% raise to LP
    if (s.code === 'fdv-to-lp-extreme') return sum + 10; // FDV/LP > 40
    return sum;
  }, 0);

  const score = Math.max(0, 100 - Math.min(100, basePenalty + extra));
  return Math.round(score);
}

export function scoreTone(score: number): 'bad' | 'ok' | 'good' {
  if (score >= 80) return 'good';
  if (score >= 60) return 'ok';
  return 'bad';
}
