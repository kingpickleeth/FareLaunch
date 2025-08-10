// src/components/wizard/StepReview.tsx
import type { WizardData } from '../../types/wizard';
import { upsertLaunch } from '../../data/launches';
import { useAccount, usePublicClient, useWriteContract } from 'wagmi';
import { supabase } from '../../lib/supabase';
import { makeMerkle, isAddress } from '../../utils/merkle';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import {
  parseUnits, keccak256, encodePacked, type Hex, parseEventLogs, type PublicClient
} from 'viem';
import {
  LAUNCHPAD_FACTORY, QUOTE_DECIMALS, launchpadFactoryAbi
} from '../../lib/contracts';
import { getAbiItem } from 'viem';


// Always return a string (or undefined) so it matches the WizardData fields
function stripCommasStr(v: unknown): string | undefined {
  if (v === null || v === undefined) return undefined;
  const s = String(v).replace(/,/g, '').trim();
  return s === '' ? undefined : s;
}

function sanitizeWizardNumbers(w: WizardData): WizardData {
  return {
    ...w,
    token: { ...w.token, totalSupply: stripCommasStr(w.token.totalSupply) },
    sale: {
      kind: w.sale?.kind ?? 'fair',
      quote: (w.sale?.quote ?? 'WAPE') as 'WAPE',
      start: w.sale?.start,
      end: w.sale?.end,
      keepPct: w.sale?.keepPct,
      softCap:        stripCommasStr(w.sale?.softCap),
      hardCap:        stripCommasStr(w.sale?.hardCap),
      saleTokensPool: stripCommasStr(w.sale?.saleTokensPool),
      minPerWallet:   stripCommasStr(w.sale?.minPerWallet),
      maxPerWallet:   stripCommasStr(w.sale?.maxPerWallet),
    },
  };
}

type Props = {
  value: WizardData;
  onBack: () => void;
  onFinish?: () => void;
  editingId?: string;
};

// NEW CreateArgs (matches updated factory ABI)
// ✨ NEW CreateArgs shape (matches updated factory + pool)
type CreateArgs = {
  startAt: bigint;
  endAt: bigint;
  softCap: bigint;
  hardCap: bigint;
  minBuy: bigint;
  maxBuy: bigint;
  isPublic: boolean;
  merkleRoot: Hex;

  // static tokenomics (on-chain storage)
  totalSupply: bigint;
  saleTokensPool: bigint;
  tokenPctToLPBps: number; // 0..10000

  // raise/flow
  lpPctBps: number;        // 0..10000
  payoutDelay: bigint;     // seconds
  lpLockDuration: bigint;  // seconds
  raiseFeeBps: number;     // 0..10000
  tokenFeeBps: number;     // 0..10000

  // token metadata (stored for deterministic mint)
  tokenName: string;
  tokenSymbol: string;
  tokenDecimals: number;   // uint8
};

function argsForDb(a: CreateArgs, ctx: any) {
  return {
    startAt: a.startAt.toString(),
    endAt: a.endAt.toString(),
    softCap: a.softCap.toString(),
    hardCap: a.hardCap.toString(),
    minBuy: a.minBuy.toString(),
    maxBuy: a.maxBuy.toString(),
    isPublic: a.isPublic,
    merkleRoot: a.merkleRoot,

    totalSupply: a.totalSupply.toString(),
    saleTokensPool: a.saleTokensPool.toString(),
    tokenPctToLPBps: a.tokenPctToLPBps,

    lpPctBps: a.lpPctBps,
    payoutDelay: a.payoutDelay.toString(),
    lpLockDuration: a.lpLockDuration.toString(),
    raiseFeeBps: a.raiseFeeBps,
    tokenFeeBps: a.tokenFeeBps,

    tokenName: a.tokenName,
    tokenSymbol: a.tokenSymbol,
    tokenDecimals: a.tokenDecimals,

    _context: ctx,
  };
}

async function upsertAllowlistBatched(saleId: string, addrs: string[]) {
  if (!supabase) throw new Error('Supabase not configured');
  const CHUNK = 1000;
  for (let i = 0; i < addrs.length; i += CHUNK) {
    const rows = addrs.slice(i, i + CHUNK).map(a => ({ sale_id: saleId, address: a }));
    const { error } = await supabase
      .from('allowlists')
      .upsert(rows, { onConflict: 'sale_id,address', ignoreDuplicates: true });
    if (error) throw error;
  }
}
const ZERO_BYTES32 = '0x0000000000000000000000000000000000000000000000000000000000000000' as const;

function toUnix(s?: string): bigint {
  if (!s) return 0n;
  const t = new Date(s).getTime();
  return t > 0 ? BigInt(Math.floor(t / 1000)) : 0n;
}
function asStr(v?: unknown): string {
  if (v === null || v === undefined) return '0';
  return String(v).replace(/,/g, '').trim() || '0';
}

export default function StepReview({ value, onBack, onFinish, editingId }: Props) {
  const { address, isConnected } = useAccount();
  const navigate = useNavigate();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const [creating, setCreating] = useState(false);
  async function safeReadBigInt(
    client: PublicClient | undefined,
    fn: 'defaultRaiseFeeBps' | 'defaultTokenFeeBps' | 'defaultLpPctBps' | 'defaultPayoutDelay' | 'defaultLpLock'
  ): Promise<bigint> {
    if (!client) return 0n;
    try {
      const v: unknown = await client.readContract({
        address: LAUNCHPAD_FACTORY,
        abi: launchpadFactoryAbi,
        functionName: fn,
      });
  
      if (typeof v === 'bigint') return v;
      if (typeof v === 'number') return BigInt(v);
      if (typeof v === 'string' && v.trim()) return BigInt(v);
  
      return 0n;
    } catch {
      return 0n;
    }
  }
  
  async function handleCreate() {
    // handy helpers
  

  
    try {
      if (!isConnected || !address) { alert('Connect your wallet first.'); return; }
      if (!supabase) { alert('Supabase not configured.'); return; }
      setCreating(true);
  
      const rawAddrs = ((value.allowlist as any)?.addresses ?? []) as string[];
  
      // 1) Save/Upsert to Supabase as "upcoming"
      const sanitized = sanitizeWizardNumbers(value);
      const row = await upsertLaunch(address, sanitized, editingId, 'upcoming');
  
      // 2) Allowlist upload / validation (unchanged)
      if (value.allowlist?.enabled) {
        const normalized = Array.from(
          new Set(
            rawAddrs
              .map(a => a?.trim().toLowerCase())
              .filter((a): a is string => !!a && isAddress(a))
          )
        );
        if (normalized.length === 0) { alert('Allowlist is enabled but contains 0 valid addresses.'); setCreating(false); return; }
  
        const { root: recomputed } = makeMerkle(normalized);
        if (!value.allowlist.root || recomputed !== value.allowlist.root) {
          alert('Merkle root mismatch. Please re-upload your list.');
          setCreating(false);
          return;
        }
        await upsertAllowlistBatched(row.id, normalized);
  
        if (row.allowlist_root !== value.allowlist.root || row.allowlist_count !== normalized.length) {
          const { error: patchErr } = await supabase
            .from('launches')
            .update({ allowlist_root: value.allowlist.root, allowlist_count: normalized.length })
            .eq('id', row.id);
          if (patchErr) throw patchErr;
        }
      } else if (editingId) {
        const { error: clrErr } = await supabase
          .from('launches')
          .update({ allowlist_root: null, allowlist_count: null, allowlist_enabled: false })
          .eq('id', row.id);
        if (clrErr) throw clrErr;
      }
  
      // ===== 3) Build CreateArgs tuple for on-chain call (new static model) =====
      const tokenDecimals = Number(sanitized.token?.decimals ?? 18);
      const tokenName =
        (value as any)?.token?.name?.trim()
        || value.project?.name?.trim()
        || (sanitized.token?.symbol ? `${sanitized.token.symbol} Token` : 'Token');
      const tokenSymbol = String(sanitized.token?.symbol || '').trim() || 'TKN';
  
      // Required numbers
      const startAt = toUnix(sanitized.sale?.start);
      const endAt   = toUnix(sanitized.sale?.end);
      const softCapWei = parseUnits(asStr(sanitized.sale?.softCap), QUOTE_DECIMALS);
      const hardCapWei = parseUnits(asStr(sanitized.sale?.hardCap), QUOTE_DECIMALS);
      const minBuyWei  = parseUnits(asStr(sanitized.sale?.minPerWallet), QUOTE_DECIMALS);
      const maxBuyWei  = parseUnits(asStr(sanitized.sale?.maxPerWallet), QUOTE_DECIMALS);
  
      const totalSupplyUnits   = parseUnits(asStr(sanitized.token?.totalSupply), tokenDecimals);
      const saleTokensPoolUnits= parseUnits(asStr(sanitized.sale?.saleTokensPool), tokenDecimals);
  
      // Basic validation that matches the pool’s `initialize` requirements
      if (saleTokensPoolUnits <= 0n) {
        alert('Sale token pool must be > 0.');
        setCreating(false); return;
      }
      if (totalSupplyUnits < saleTokensPoolUnits) {
        alert('Total supply must be >= Sale token pool.');
        setCreating(false); return;
      }
  
      const isPublic   = !(sanitized.allowlist?.enabled);
      const merkleRoot: Hex = sanitized.allowlist?.enabled && sanitized.allowlist?.root
        ? (sanitized.allowlist.root as Hex)
        : (ZERO_BYTES32 as Hex);
        // quick guards to avoid obvious contract reverts
        if (endAt <= startAt) { alert('End time must be after start time.'); setCreating(false); return; }
        if (hardCapWei < softCapWei) { alert('Hard cap must be >= soft cap.'); setCreating(false); return; }
        if (maxBuyWei > 0n && minBuyWei > maxBuyWei) { alert('Max per wallet must be >= min per wallet.'); setCreating(false); return; }
        if (!isPublic && (!value.allowlist?.root || merkleRoot === ZERO_BYTES32)) {
          alert('Allowlist is enabled but the Merkle root is missing.'); setCreating(false); return;
        }
  
     // ----- Fees & timings (compute & clamp FIRST) -----
const toBps = (pct?: number | null): number => {
  if (typeof pct !== 'number' || !Number.isFinite(pct)) return 0;
  return Math.max(0, Math.min(10_000, Math.round(pct * 100)));
};
const clampBps = (n: number) => Math.max(0, Math.min(10_000, Math.floor(n || 0)));
const toUint8   = (n: number) => Math.max(0, Math.min(255, Math.floor(n || 0)));

const raiseFeeBpsNum = clampBps(
  typeof sanitized.fees?.raisePct === 'number'
    ? Math.round(sanitized.fees.raisePct * 100)
    : Number(await safeReadBigInt(publicClient, 'defaultRaiseFeeBps'))
);

const tokenFeeBpsNum = clampBps(
  typeof sanitized.fees?.supplyPct === 'number'
    ? Math.round(sanitized.fees.supplyPct * 100)
    : Number(await safeReadBigInt(publicClient, 'defaultTokenFeeBps'))
);

const lpPctBpsNum = clampBps(
  typeof sanitized.lp?.percentToLP === 'number'
    ? Math.round(sanitized.lp.percentToLP * 100)
    : Number(await safeReadBigInt(publicClient, 'defaultLpPctBps'))
);

const tokenPctToLPBpsNum = clampBps(
  typeof sanitized.lp?.tokenPercentToLP === 'number'
    ? Math.round(sanitized.lp.tokenPercentToLP * 100)
    : 0
);const fallback = (x: bigint, min: bigint) => x > 0n ? x : min;
const payoutDelay = fallback(
  typeof (sanitized as any)?.lp?.payoutDelay === 'number'
    ? BigInt(Math.max(0, Math.trunc((sanitized as any).lp.payoutDelay)))
    : await safeReadBigInt(publicClient, 'defaultPayoutDelay'),
  3600n
);
const lpLockDuration = fallback(
  typeof sanitized.lp?.lockDays === 'number' && sanitized.lp.lockDays > 0
    ? BigInt(Math.trunc(sanitized.lp.lockDays)) * 86400n
    : await safeReadBigInt(publicClient, 'defaultLpLock'),
  30n * 86400n
);


const tokenDecimalsClamped = Math.max(0, Math.min(255, Number(sanitized.token?.decimals ?? 18)));

// ----- Build the tuple object EXACTLY once -----
const a: CreateArgs = {
  startAt, endAt,
  softCap: softCapWei,
  hardCap: hardCapWei,
  minBuy:  minBuyWei,
  maxBuy:  maxBuyWei,
  isPublic,
  merkleRoot,

  totalSupply: totalSupplyUnits,
  saleTokensPool: saleTokensPoolUnits,
  tokenPctToLPBps: tokenPctToLPBpsNum,

  lpPctBps: lpPctBpsNum,
  payoutDelay,            // already bigint
  lpLockDuration,         // already bigint
  raiseFeeBps: raiseFeeBpsNum,
  tokenFeeBps: tokenFeeBpsNum,

  tokenName,
  tokenSymbol,
  tokenDecimals: tokenDecimalsClamped,
};

// quick sanity before encoding (will name the first bad field)
(function assertCreateArgs(aChecked: CreateArgs) {
  const checks: Array<[string, unknown]> = [
    ['startAt', aChecked.startAt], ['endAt', aChecked.endAt],
    ['softCap', aChecked.softCap], ['hardCap', aChecked.hardCap],
    ['minBuy', aChecked.minBuy],   ['maxBuy', aChecked.maxBuy],
    ['isPublic', aChecked.isPublic], ['merkleRoot', aChecked.merkleRoot],
    ['totalSupply', aChecked.totalSupply], ['saleTokensPool', aChecked.saleTokensPool],
    ['tokenPctToLPBps', aChecked.tokenPctToLPBps], ['lpPctBps', aChecked.lpPctBps],
    ['payoutDelay', aChecked.payoutDelay], ['lpLockDuration', aChecked.lpLockDuration],
    ['raiseFeeBps', aChecked.raiseFeeBps], ['tokenFeeBps', aChecked.tokenFeeBps],
    ['tokenName', aChecked.tokenName], ['tokenSymbol', aChecked.tokenSymbol],
    ['tokenDecimals', aChecked.tokenDecimals],
  ];
  for (const [k, v] of checks) {
    if (v === undefined || (typeof v === 'number' && Number.isNaN(v))) {
      console.error('Missing/invalid field in CreateArgs:', k, v);
      throw new Error(`Internal error: "${k}" is missing or invalid`);
    }
  }
  // additionally ensure bigint-typed fields are actually bigint
  for (const k of ['startAt','endAt','softCap','hardCap','minBuy','maxBuy','totalSupply','saleTokensPool','payoutDelay','lpLockDuration'] as const) {
    if (typeof (aChecked as any)[k] !== 'bigint') {
      throw new Error(`${k} must be bigint, got ${typeof (aChecked as any)[k]}`);
    }
  }
})(a);
// 3.7 Salt for deterministic address (creator + DB id)
const salt = keccak256(
  encodePacked(['address','string'], [address as `0x${string}`, row.id])
) as Hex;
const bigintFields = [
  'startAt','endAt','softCap','hardCap','minBuy','maxBuy',
  'totalSupply','saleTokensPool','payoutDelay','lpLockDuration'
] as const;

for (const key of bigintFields) {
  const val = (a as any)[key];
  console.log(`DEBUG bigint field: ${key}`, val, typeof val);
  if (val === undefined) {
    throw new Error(`❌ ${key} is undefined before passing to createPresale`);
  }
}


// final args (positional tuple + salt)
// Build positional CreateArgs tuple to avoid any name/ABI drift
const aTuple = [
  // schedule & caps
  a.startAt,            // uint64
  a.endAt,              // uint64
  a.softCap,            // uint256
  a.hardCap,            // uint256
  a.minBuy,             // uint256
  a.maxBuy,             // uint256

  // access
  a.isPublic,                               // bool
  a.merkleRoot as `0x${string}`,            // bytes32

  // static tokenomics
  a.totalSupply,                            // uint256
  a.saleTokensPool,                         // uint256
  Number(a.tokenPctToLPBps),                // uint16
  Number(a.lpPctBps),                       // uint16

  // timings & fees
  a.payoutDelay,                            // uint64
  a.lpLockDuration,                         // uint64
  Number(a.raiseFeeBps),                    // uint16
  Number(a.tokenFeeBps),                    // uint16

  // token metadata
  a.tokenName,                              // string
  a.tokenSymbol,                            // string
  Number(a.tokenDecimals),                  // uint8
] as const;

// If your ABI is (CreateArgs a, address quoteToken, bytes32 salt):
const aNamed = {
  startAt: a.startAt,
  endAt: a.endAt,
  softCap: a.softCap,
  hardCap: a.hardCap,
  minBuy: a.minBuy,
  maxBuy: a.maxBuy,
  isPublic: a.isPublic,
  merkleRoot: a.merkleRoot as `0x${string}`,
  totalSupply: a.totalSupply,
  saleTokensPool: a.saleTokensPool,
  tokenPctToLPBps: Number(a.tokenPctToLPBps),
  lpPctBps:        Number(a.lpPctBps),
  payoutDelay: a.payoutDelay,
  lpLockDuration: a.lpLockDuration,
  raiseFeeBps: Number(a.raiseFeeBps),
  tokenFeeBps: Number(a.tokenFeeBps),
  tokenName: a.tokenName,
  tokenSymbol: a.tokenSymbol,
  tokenDecimals: Number(a.tokenDecimals),
} as const;

const args = [
  {
    startAt: a.startAt,
    endAt: a.endAt,
    softCap: a.softCap,
    hardCap: a.hardCap,
    minBuy: a.minBuy,
    maxBuy: a.maxBuy,
    isPublic: a.isPublic,
    merkleRoot: a.merkleRoot as `0x${string}`,
    totalSupply: a.totalSupply,
    saleTokensPool: a.saleTokensPool,
    tokenPctToLPBps: Number(a.tokenPctToLPBps),
    lpPctBps: Number(a.lpPctBps),
    payoutDelay: a.payoutDelay,
    lpLockDuration: a.lpLockDuration,
    raiseFeeBps: Number(a.raiseFeeBps),
    tokenFeeBps: Number(a.tokenFeeBps),
    tokenName: a.tokenName,
    tokenSymbol: a.tokenSymbol,
    tokenDecimals: Number(a.tokenDecimals),
    presaleRate: 0n,
    listingRate: 0n,
  },
  salt
] as const;

// If (rarer) your ABI is only (CreateArgs a, bytes32 salt), then use:
// const args = [aTuple, salt] as const;
console.log('=== aNamed full check ===');
const abiOrder = [
  'startAt','endAt','softCap','hardCap','minBuy','maxBuy',
  'isPublic','merkleRoot','totalSupply','saleTokensPool',
  'tokenPctToLPBps','lpPctBps','payoutDelay','lpLockDuration',
  'raiseFeeBps','tokenFeeBps','tokenName','tokenSymbol','tokenDecimals'
] as const;

for (const key of abiOrder) {
  const val = (aNamed as any)[key];
  console.log(key, val, typeof val);
  if (val === undefined) {
    throw new Error(`❌ MISSING FIELD: ${key}`);
  }
}
console.log('DEBUG salt', salt, typeof salt);
if (!salt || typeof salt !== 'string' || !salt.startsWith('0x') || salt.length !== 66) {
  throw new Error('❌ Invalid salt: ' + salt);
}
console.log(
  JSON.stringify(
    getAbiItem({ abi: launchpadFactoryAbi, name: 'createPresale' }),
    null,
    2
  )
);

      // 4) Simulate to get the predicted pool (and a prebuilt request)
      const { request, result } = await publicClient!.simulateContract({
        address: LAUNCHPAD_FACTORY,
        abi: launchpadFactoryAbi,
        functionName: 'createPresale',
        args,
        account: address,
      });
      
      const predictedPool = result as `0x${string}`;
  
      // 5) Send tx using the simulated request (same calldata)
      const hash = await writeContractAsync(request);
  
      // mark pending
      {
        const { error } = await supabase.from('launches')
          .update({ chain_tx_hash: hash, chain_status: 'tx_submitted' })
          .eq('id', row.id);
        if (error) console.error('Supabase pre-update failed:', error);
      }
  
      // 6) Wait for confirmation and parse the event
      const receipt = await publicClient!.waitForTransactionReceipt({ hash });
      const events = parseEventLogs({
        abi: launchpadFactoryAbi,
        logs: receipt.logs,
        eventName: 'PoolCreated',
      });
      const eventPool = events[0]?.args?.pool as `0x${string}` | undefined;
      const poolAddress = (eventPool ?? predictedPool ?? null);
  
      // 7) Persist on-chain info
      const baseUpdate = {
        chain_status: 'confirmed',
        chain_tx_hash: hash,
        pool_address: poolAddress,
      };
      const { error: baseErr } = await supabase
        .from('launches')
        .update(baseUpdate)
        .eq('id', row.id);
  
      if (baseErr) {
        console.error('Supabase base update failed:', baseErr);
        alert(`Launch created on-chain, but failed to save pool address: ${baseErr.message}`);
      } else {
        // Optional: store args for debugging/analytics (ignore if column missing)
        const aForDb = argsForDb(a, {
          tokenDecimals,
          quoteDecimals: QUOTE_DECIMALS,
        });
        const { error: metaErr } = await supabase
          .from('launches')
          .update({ create_args: aForDb as any })
          .eq('id', row.id);
        if (metaErr && !/create_args/i.test(metaErr.message)) {
          console.warn('Optional create_args update failed:', metaErr);
        }
      }
  
      alert(`Launch created! ID: ${row.id}`);
      navigate(`/sale/${row.id}`, { replace: true });
      onFinish?.();
    } catch (e: any) {
      console.error(e);
      alert(`Failed to create launch: ${e?.message || e}`);
    } finally {
      setCreating(false);
    }
  }
  
  async function handleSaveDraft() {
    try {
      if (!isConnected || !address) { alert('Connect your wallet first.'); return; }
      const sanitized = sanitizeWizardNumbers(value);
      const row = await upsertLaunch(address, sanitized, editingId);
      alert(`Saved draft! ID: ${row.id}`);
      navigate('/me', { replace: true });
      onFinish?.();
    } catch (e: any) {
      console.error(e);
      alert(`Failed to save draft: ${e?.message || e}`);
    }
  }

  const totalSupply = value.token.totalSupply ?? '-';
  function toNum(v: unknown): number {
    if (v === null || v === undefined) return NaN;
    const n = Number(String(v).replace(/,/g, '').trim());
    return Number.isFinite(n) ? n : NaN;
  }

  function formatDateTimeMMDDYYYY(s?: string): string {
    if (!s) return '-';
    const d = new Date(s);
    if (!Number.isFinite(d.getTime())) return s;
    const pad = (n: number) => String(n).padStart(2, '0');
    const mm = pad(d.getMonth() + 1);
    const dd = pad(d.getDate());
    const yyyy = d.getFullYear();
    let h = d.getHours();
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12; if (h === 0) h = 12;
    const mins = pad(d.getMinutes());
    return `${mm}/${dd}/${yyyy} at ${h}:${mins} ${ampm}`;
  }

  function formatAmtWithQuote(v: unknown, quote?: string): string {
    const n = toNum(v);
    if (!Number.isFinite(n)) return '-';
    return `${n.toLocaleString()} ${quote ?? ''}`.trim();
  }

  // --- Derived (mirror Tokenomics math) ---
  const totalSupplyNum = toNum(value.token.totalSupply);
  const tokenPctToLP   = typeof value.lp?.tokenPercentToLP === 'number' ? value.lp.tokenPercentToLP : 0;
  const raisePctToLP   = typeof value.lp?.percentToLP === 'number' ? value.lp.percentToLP : 60;
  const keepPctRem     = typeof value.sale?.keepPct === 'number' ? value.sale.keepPct : 0;

  const lpTokens = Number.isFinite(totalSupplyNum) ? Math.floor((totalSupplyNum * tokenPctToLP) / 100) : NaN;
  const remainingAfterLP = Number.isFinite(totalSupplyNum) ? Math.max(0, totalSupplyNum - lpTokens) : NaN;
  const keptTokens = Number.isFinite(remainingAfterLP) ? Math.floor((remainingAfterLP * keepPctRem) / 100) : NaN;

  const keptPctOfTotal = Number.isFinite(totalSupplyNum) && totalSupplyNum > 0 && Number.isFinite(keptTokens)
    ? (keptTokens / totalSupplyNum) * 100
    : NaN;

  const raiseFeePct = typeof value.fees?.raisePct === 'number' ? value.fees.raisePct : 5;

  // Supply fee is expressed as a % value like 0.05 (i.e., 0.05%)
  const supplyFeePct = typeof value.fees?.supplyPct === 'number' ? value.fees.supplyPct : 0.05;
  const platformSupplyFeeTokens = Number.isFinite(totalSupplyNum)
    ? Math.floor(totalSupplyNum * (supplyFeePct / 100))
    : NaN;

  const ticker = value.token.symbol ? `$${value.token.symbol}` : 'tokens';

  const panelStyle: React.CSSProperties = {
    background: 'var(--card-bg)',
    border: '1px solid var(--card-border)',
    padding: 12,
    borderRadius: 12,
    minWidth: 0
  };

  const note: React.CSSProperties = { color: 'var(--muted)' };

  return (
    <form onSubmit={(e) => e.preventDefault()}>
      <div style={{ maxWidth: 960, margin: '0 auto', width: '100%' }}>
        <div className="card" style={{ padding: 16, display: 'grid', gap: 16, minWidth: 0 }}>
          <div className="h2">Review</div>

          <div className="card" style={panelStyle}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>Project</div>
            <div>Name: <b className="break-anywhere">{value.project.name || '-'}</b></div>
            <div>Website: <b className="break-anywhere">{value.project.website || '-'}</b></div>
            <div>Twitter: <b className="break-anywhere">{value.project.twitter || '-'}</b></div>
          </div>

          <div className="card" style={panelStyle}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>Token</div>
            <div>Symbol: <b className="break-anywhere">{value.token.symbol}</b></div>
            <div>Decimals: <b>{value.token.decimals}</b></div>
            <div>Total Supply: <b className="break-anywhere">{totalSupply}</b></div>
          </div>

          {/* Sale summary */}
          <div className="card" style={panelStyle}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>Sale</div>

            <div>Currency Pair: <b>{value.sale?.quote}</b></div>

            <div>Presale Start: <b className="break-anywhere">
              {formatDateTimeMMDDYYYY(value.sale?.start)}
            </b></div>

            <div>Presale End: <b className="break-anywhere">
              {formatDateTimeMMDDYYYY(value.sale?.end)}
            </b></div>

            <div>Soft Cap: <b className="break-anywhere">
              {formatAmtWithQuote(value.sale?.softCap, value.sale?.quote)}
            </b></div>

            <div>Hard Cap: <b className="break-anywhere">
              {value.sale?.hardCap ? formatAmtWithQuote(value.sale?.hardCap, value.sale?.quote) : '(none)'}
            </b></div>

            <div>Per-wallet min/max: <b className="break-anywhere">
              {formatAmtWithQuote(value.sale?.minPerWallet, value.sale?.quote)}
            </b> / <b className="break-anywhere">
              {formatAmtWithQuote(value.sale?.maxPerWallet, value.sale?.quote)}
            </b></div>
          </div>

          <div className="card" style={panelStyle}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>Allowlist</div>
            <div>Status: <b>{value.allowlist?.enabled ? 'Enabled' : 'Disabled'}</b></div>
            {value.allowlist?.enabled && (
              <>
                <div>Addresses: <b>{value.allowlist?.count ?? 0}</b></div>
                <div>
                  Root:{' '}
                  <code className="break-anywhere" style={{ opacity: .9 }}>
                    {value.allowlist?.root || '-'}
                  </code>
                </div>
              </>
            )}
          </div>

          {/* LP & Fees */}
          <div className="card" style={panelStyle}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>LP & Fees</div>

            <div>
              To LP Funding: <b>
                {Number.isFinite(raisePctToLP) ? `${raisePctToLP}% of Raise` : '-'}
              </b> / <b>
                {Number.isFinite(lpTokens) ? lpTokens.toLocaleString() : '-'}
              </b> {ticker}
            </div>

            <div>
              Creator Profits: <b>
                {Number.isFinite(100 - raisePctToLP) ? `${100 - raisePctToLP}% of Raise` : '-'}
              </b>{' '}
              <span style={note}>(minus platform fee {raiseFeePct}%)</span>
              {' '} & <b>{Number.isFinite(keptTokens) ? keptTokens.toLocaleString() : '-'}</b> {ticker}
              <span style={note}>
                {' '}({Number.isFinite(keptPctOfTotal) ? keptPctOfTotal.toFixed(2) : '-'}% of total supply)
              </span>
            </div>

            <div>Lock: <b>{value.lp?.lockDays ? `${value.lp.lockDays} days` : '-'}</b></div>
            <div>Platform fee (raise): <b>{typeof value.fees?.raisePct === 'number' ? `${value.fees.raisePct}%` : '-'}</b></div>
            <div>
              Platform fee (supply): <b>
                {Number.isFinite(platformSupplyFeeTokens) ? platformSupplyFeeTokens.toLocaleString() : '-'} {ticker}
              </b>
              <span style={note}> {' '}({supplyFeePct}%)</span>
            </div>
          </div>

          {/* Actions */}
          <div className="review-actions">
            <button type="button" className="button button-back" onClick={onBack}>← Back</button>
            <div className="review-actions-right">
              <button type="button" className="button" onClick={handleSaveDraft} disabled={creating}>Save Draft</button>
              <button type="button" className="button button-secondary" onClick={handleCreate} disabled={creating}>
                {creating ? 'Creating…' : 'Create'}
              </button>
            </div>
          </div>

        </div>
      </div>
    </form>
  );
}
