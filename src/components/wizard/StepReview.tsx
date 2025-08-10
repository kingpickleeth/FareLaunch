import type { WizardData } from '../../types/wizard';
import { upsertLaunch } from '../../data/launches';
import { useAccount } from 'wagmi';
import { supabase } from '../../lib/supabase';
import { makeMerkle, isAddress } from '../../utils/merkle';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { usePublicClient, useWriteContract } from 'wagmi';
import {
  parseUnits, keccak256, encodePacked, type Hex, decodeEventLog
} from 'viem';
import {
  LAUNCHPAD_FACTORY, QUOTE_DECIMALS, launchpadFactoryAbi
} from '../../lib/contracts';
import { parseEventLogs } from 'viem';

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
type CreateArgs = {
  startAt: bigint;
  endAt: bigint;
  softCap: bigint;
  hardCap: bigint;
  minBuy: bigint;
  maxBuy: bigint;
  isPublic: boolean;
  merkleRoot: Hex;
  presaleRate: bigint;
  listingRate: bigint;
  lpPctBps: number;        // uint16 -> number
  payoutDelay: bigint;     // uint64 -> bigint
  lpLockDuration: bigint;  // uint64 -> bigint
  raiseFeeBps: number;     // uint16 -> number
  tokenFeeBps: number;     // uint16 -> number
};
function argsForDb(a: {
  startAt: bigint; endAt: bigint; softCap: bigint; hardCap: bigint;
  minBuy: bigint; maxBuy: bigint; isPublic: boolean; merkleRoot: Hex;
  presaleRate: bigint; listingRate: bigint; lpPctBps: number;
  payoutDelay: bigint; lpLockDuration: bigint; raiseFeeBps: number; tokenFeeBps: number;
}, ctx: any) {
  return {
    startAt: a.startAt.toString(),
    endAt: a.endAt.toString(),
    softCap: a.softCap.toString(),
    hardCap: a.hardCap.toString(),
    minBuy: a.minBuy.toString(),
    maxBuy: a.maxBuy.toString(),
    isPublic: a.isPublic,
    merkleRoot: a.merkleRoot,
    presaleRate: a.presaleRate.toString(),
    listingRate: a.listingRate.toString(),
    lpPctBps: a.lpPctBps,
    payoutDelay: a.payoutDelay.toString(),
    lpLockDuration: a.lpLockDuration.toString(),
    raiseFeeBps: a.raiseFeeBps,
    tokenFeeBps: a.tokenFeeBps,
    _context: ctx, // purely for debugging/traceability
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
  
  async function handleCreate() {
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
  
      // ===== 3) Build CreateArgs tuple for on-chain call =====
      // Required numbers
      const tokenDecimals = Number(sanitized.token?.decimals ?? 18);
  
      // Hard cap is required to compute presaleRate reliably
      if (!sanitized.sale?.hardCap) {
        alert('Hard cap is required to compute presale rate. Please set a hard cap.');
        setCreating(false);
        return;
      }
  
      const startAt = toUnix(sanitized.sale?.start);
      const endAt   = toUnix(sanitized.sale?.end);
  
      const softCapWei = parseUnits(asStr(sanitized.sale?.softCap), QUOTE_DECIMALS);
      const hardCapWei = parseUnits(asStr(sanitized.sale?.hardCap), QUOTE_DECIMALS);
      const minBuyWei  = parseUnits(asStr(sanitized.sale?.minPerWallet), QUOTE_DECIMALS);
      const maxBuyWei  = parseUnits(asStr(sanitized.sale?.maxPerWallet), QUOTE_DECIMALS);
  
      const isPublic   = !(sanitized.allowlist?.enabled);
      const merkleRoot: Hex = sanitized.allowlist?.enabled && sanitized.allowlist?.root
        ? (sanitized.allowlist.root as Hex)
        : (ZERO_BYTES32 as Hex);
  
      // Presale rate = tokens per 1 WAPE (in smallest units)
      // saleTokensPool and totalSupply are typed as strings in the wizard
      const saleTokensPoolUnits = parseUnits(asStr(sanitized.sale?.saleTokensPool), tokenDecimals);
      let presaleRate = 0n;
      if (saleTokensPoolUnits > 0n && hardCapWei > 0n) {
        presaleRate = (saleTokensPoolUnits * (10n ** BigInt(QUOTE_DECIMALS))) / hardCapWei;
      } else {
        alert('Sale token pool and hard cap must be > 0 to compute presale rate.');
        setCreating(false);
        return;
      }
  
      // Listing rate from LP math (tokens per 1 WAPE at listing)
      const totalSupplyUnits = parseUnits(asStr(sanitized.token?.totalSupply), tokenDecimals);
      const lpTokenPct       = BigInt(Math.round(sanitized.lp?.tokenPercentToLP ?? 0));
      const lpTokensUnits    = (totalSupplyUnits * lpTokenPct) / 100n;
  
      const lpRaisePct       = BigInt(Math.round(sanitized.lp?.percentToLP ?? 60));
      const quoteForLPWei    = (hardCapWei * lpRaisePct) / 100n;
  
      let listingRate = presaleRate; // fallback
      if (lpTokensUnits > 0n && quoteForLPWei > 0n) {
        listingRate = (lpTokensUnits * (10n ** BigInt(QUOTE_DECIMALS))) / quoteForLPWei;
      }
  
      // Fees & timings (BPS + seconds). If not provided in UI, use factory defaults.
      // raiseFeeBps: percent -> bps (e.g., 5% -> 500)
      // tokenFeeBps: percent -> bps (e.g., 0.05% -> 5)
      let raiseFeeBps: number;
      if (typeof sanitized.fees?.raisePct === 'number') {
        raiseFeeBps = Math.round(sanitized.fees.raisePct * 100);
      } else {
        raiseFeeBps = Number(await publicClient!.readContract({
          address: LAUNCHPAD_FACTORY,
          abi: launchpadFactoryAbi,
          functionName: 'defaultRaiseFeeBps'
        }));
      }
      let tokenFeeBps: number;
      if (typeof sanitized.fees?.supplyPct === 'number') {
        tokenFeeBps = Math.round(sanitized.fees.supplyPct * 100);
      } else {
        tokenFeeBps = Number(await publicClient!.readContract({
          address: LAUNCHPAD_FACTORY,
          abi: launchpadFactoryAbi,
          functionName: 'defaultTokenFeeBps'
        }));
      }
    
let lpPctBps: number;
if (typeof sanitized.lp?.percentToLP === 'number') {
  lpPctBps = Math.round(sanitized.lp.percentToLP * 100);
} else {
  lpPctBps = Number(await publicClient!.readContract({
    address: LAUNCHPAD_FACTORY,
    abi: launchpadFactoryAbi,
    functionName: 'defaultLpPctBps'
  }));
}
      // payoutDelay: seconds — not in the wizard, so take default
      const payoutDelay = await publicClient!.readContract({
        address: LAUNCHPAD_FACTORY,
        abi: launchpadFactoryAbi,
        functionName: 'defaultPayoutDelay'
      });
  
      // lpLockDuration: prefer wizard lockDays; else default
      let lpLockDuration = 0n;
      const lockDays = sanitized.lp?.lockDays ?? null;
      if (typeof lockDays === 'number' && Number.isFinite(lockDays) && lockDays > 0) {
        lpLockDuration = BigInt(Math.round(lockDays)) * 86400n;
      } else {
        lpLockDuration = await publicClient!.readContract({
          address: LAUNCHPAD_FACTORY,
          abi: launchpadFactoryAbi,
          functionName: 'defaultLpLock'
        });
      }
  
      // Deterministic salt: keccak256(encodePacked(creator, dbId))
      const salt = keccak256(encodePacked(['address','string'], [address, row.id])) as Hex;
  
      const a: CreateArgs = {
        startAt, endAt,
        softCap: softCapWei,
        hardCap: hardCapWei,
        minBuy:  minBuyWei,
        maxBuy:  maxBuyWei,
        isPublic,
        merkleRoot,
        presaleRate,
        listingRate,
        lpPctBps,          // number
        payoutDelay,       // bigint
        lpLockDuration,    // bigint
        raiseFeeBps,       // number
        tokenFeeBps        // number
      };
      
      const args: readonly [CreateArgs, Hex] = [a, salt];
// 4) Simulate the call to capture the pool address that will be created
const { request, result: predictedPool } = await publicClient!.simulateContract({
  address: LAUNCHPAD_FACTORY,
  abi: launchpadFactoryAbi,
  functionName: 'createPresale',
  args,
  account: address,
});

// 5) Send tx using the simulated request (exact same calldata)
const hash = await writeContractAsync(request);

// Mark pending (log any error so we can see RLS/column issues)
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

// Prefer the event value; fallback to simulated prediction if needed
const poolAddress = (eventPool ?? predictedPool ?? null);

// 7) Persist final on-chain info (single update; include create_args if you like)
const aForDb = argsForDb(a, {
  tokenDecimals,
  quoteDecimals: QUOTE_DECIMALS,
  computedPresaleRate: presaleRate.toString(),
  computedListingRate: listingRate.toString(),
});

const { error: updErr } = await supabase.from('launches')
  .update({
    chain_status: 'confirmed',
    chain_tx_hash: hash,
    pool_address: poolAddress,
    create_args: aForDb,
  })
  .eq('id', row.id);

if (updErr) {
  console.error('Supabase update failed:', updErr);
  alert(`Launch created on-chain, but failed to save pool address: ${updErr.message}`);
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

  const creatorRaisePct = 100 - raisePctToLP;
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
                {Number.isFinite(creatorRaisePct) ? `${creatorRaisePct}% of Raise` : '-'}
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
