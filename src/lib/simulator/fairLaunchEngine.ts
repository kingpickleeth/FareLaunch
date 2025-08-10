import type { FairLaunchInput, FairLaunchResult } from './fairLaunchTypes';

function clampPct(n: number) {
  return Math.max(0, Math.min(100, Number.isFinite(n) ? n : 0));
}
function nz(n: number) {
  return Number.isFinite(n) ? n : 0;
}

export function simulateFairLaunch(input: FairLaunchInput): FairLaunchResult {
  const S = Math.max(0, nz(input.token.totalSupply));
  const R = Math.max(0, nz(input.economics.totalRaised));
  const pTokLP = clampPct(input.economics.pctTokensToLP);
  const pRaiseLP = clampPct(input.economics.pctRaiseToLP);
  const pWithhold = clampPct(input.economics.pctWithholdOfRemaining);

  const tokensToLP = S * (pTokLP / 100);
  const remainingAfterLP = Math.max(0, S - tokensToLP);
  const tokensWithheld = remainingAfterLP * (pWithhold / 100);
  const tokensForPresale = Math.max(0, remainingAfterLP - tokensWithheld);

  const baseToLP = R * (pRaiseLP / 100);
  const creatorProceeds = Math.max(0, R - baseToLP);

  const listingPrice = tokensToLP > 0 ? baseToLP / tokensToLP : 0;
  const presalePrice = tokensForPresale > 0 ? R / tokensForPresale : 0;
  const openingFDV = S * listingPrice;

  return {
    tokensToLP,
    tokensWithheld,
    tokensForPresale,
    baseToLP,
    creatorProceeds,
    listingPrice,
    presalePrice,
    openingFDV,
  };
}
