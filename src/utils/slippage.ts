// src/utils/slippage.ts
export function applySlippageDown(amount: bigint, bps: number): bigint {
  return (amount * BigInt(10_000 - bps)) / 10_000n;
}
export function applySlippageUp(amount: bigint, bps: number): bigint {
  return (amount * BigInt(10_000 + bps)) / 10_000n;
}
export function minutesFromNow(minutes: number): bigint {
  const now = Math.floor(Date.now() / 1000);
  return BigInt(now + minutes * 60);
}
