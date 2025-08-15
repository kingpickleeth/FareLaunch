// src/components/wizard/StepReview.tsx
import type { WizardData } from '../../types/wizard';
import { upsertLaunch } from '../../data/launches';
import { useAccount, usePublicClient, useWriteContract } from 'wagmi';
import { supabase } from '../../lib/supabase';
import { makeMerkle, isAddress } from '../../utils/merkle';
import { useNavigate } from 'react-router-dom';
import { useState, useMemo, useEffect } from 'react';
import {
  parseUnits, keccak256, encodePacked, type Hex, parseEventLogs, type PublicClient
} from 'viem';
import {
  LAUNCHPAD_FACTORY, QUOTE_DECIMALS, launchpadFactoryAbi
} from '../../lib/contracts';

/* ──────────────────────────────────────────────────────────────
   Local CSS (theme-aware)
   ────────────────────────────────────────────────────────────── */
function injectReviewCSSOnce() {
  const id = 'review-styles';
  if (typeof document === 'undefined' || document.getElementById(id)) return;
  const s = document.createElement('style');
  s.id = id;
  s.textContent = `
    .review-wrap{display:grid;grid-template-columns:minmax(0,1fr) 360px;gap:16px}
    .review-card{background:var(--card-bg);border:1px solid var(--card-border);padding:12px;border-radius:12px}
    .section-title{display:flex;align-items:center;gap:8px;font-weight:800;margin-bottom:8px}
    .pill{display:inline-flex;align-items:center;gap:8px;border:1px solid var(--card-border);background:var(--input-bg);color:var(--muted);border-radius:999px;padding:4px 10px;font-size:12px}
    .kv{display:grid;grid-template-columns:auto 1fr;gap:8px 12px}
    .kv dt{color:var(--muted)}
    .kv dd{margin:0;text-align:right;font-weight:700}
    .legend{display:flex;flex-wrap:wrap;gap:10px}
    .swatch{width:10px;height:10px;border-radius:2px;display:inline-block}
    .right-rail{position:sticky;top:16px;align-self:start;display:grid;gap:12px}
    .badge{display:inline-flex;align-items:center;gap:6px;border-radius:999px;padding:4px 10px;border:1px solid var(--card-border);background:var(--input-bg);font-size:12px}
    .badge.ok{color:var(--fl-aqua)}
    .badge.warn{color:var(--fl-danger, #c62828)}
    .num{font-family:var(--font-data)}
    .break-anywhere{word-break:break-word;overflow-wrap:anywhere}
    .actions{display:flex;justify-content:space-between;gap:12px}
    .actions-right{display:flex;gap:8px;flex-wrap:wrap}
    .donut{width:100%;max-width:320px;margin:auto}
    .donut svg{display:block;width:100%;height:auto}
    .donut-label{font-weight:800;fill:var(--text)}
    .donut-sub{fill:var(--muted);font-size:10px}
    .donut-center text { dominant-baseline: middle; }
    .callout{background:var(--fl-surface, var(--card-bg));border:1px dashed var(--card-border);padding:10px;border-radius:10px;color:var(--muted);font-size:12px}
    @media (max-width:980px){ .review-wrap{grid-template-columns:1fr} .right-rail{position:static} }
  `;
  document.head.appendChild(s);
}

/* ──────────────────────────────────────────────────────────────
   Helpers
   ────────────────────────────────────────────────────────────── */
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

  totalSupply: bigint;
  saleTokensPool: bigint;
  tokenPctToLPBps: number;

  lpPctBps: number;
  payoutDelay: bigint;
  lpLockDuration: bigint;
  raiseFeeBps: number;
  tokenFeeBps: number;

  tokenName: string;
  tokenSymbol: string;
  tokenDecimals: number;
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
const ZERO_BYTES32 =
  '0x0000000000000000000000000000000000000000000000000000000000000000' as const;

function toUnix(s?: string): bigint {
  if (!s) return 0n;
  const t = new Date(s).getTime();
  return t > 0 ? BigInt(Math.floor(t / 1000)) : 0n;
}
function asStr(v?: unknown): string {
  if (v === null || v === undefined) return '0';
  return String(v).replace(/,/g, '').trim() || '0';
}
function toNum(v: unknown): number {
  if (v === null || v === undefined) return NaN;
  const n = Number(String(v).replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : NaN;
}
function formatAmtWithQuote(v: unknown, quote?: string): string {
  const n = toNum(v);
  if (!Number.isFinite(n)) return '-';
  return `${n.toLocaleString()} $${quote ?? ''}`.trim();
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
function humanRange(a?: string, b?: string) {
  if (!a || !b) return '—';
  const A = new Date(a).getTime();
  const B = new Date(b).getTime();
  if (!Number.isFinite(A) || !Number.isFinite(B) || B <= A) return '—';
  const mins = Math.floor((B - A) / 60000);
  const d = Math.floor(mins / (60 * 24));
  const h = Math.floor((mins % (60 * 24)) / 60);
  const m = mins % 60;
  const parts: string[] = [];
  if (d) parts.push(`${d}d`);
  if (h) parts.push(`${h}h`);
  if (m || (!d && !h)) parts.push(`${m}m`);
  return parts.join(' ');
}

/* ──────────────────────────────────────────────────────────────
   Component
   ────────────────────────────────────────────────────────────── */
export default function StepReview({ value, onBack, onFinish, editingId }: Props) {
  useEffect(() => { injectReviewCSSOnce(); }, []);

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
    try {
      if (!isConnected || !address) { alert('Connect your wallet first.'); return; }
      if (!supabase) { alert('Supabase not configured.'); return; }
      setCreating(true);

      const rawAddrs = ((value.allowlist as any)?.addresses ?? []) as string[];

      // 1) Save/Upsert to Supabase as "upcoming"
      const sanitized = sanitizeWizardNumbers(value);
      const row = await upsertLaunch(address, sanitized, editingId, 'upcoming');

      // 2) Allowlist upload / validation
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

      // 3) Build CreateArgs tuple
      const tokenDecimals = Number(sanitized.token?.decimals ?? 18);
      const tokenName =
        (value as any)?.token?.name?.trim()
        || value.project?.name?.trim()
        || (sanitized.token?.symbol ? `${sanitized.token.symbol} Token` : 'Token');
      const tokenSymbol = String(sanitized.token?.symbol || '').trim() || 'TKN';

      const startAt = toUnix(sanitized.sale?.start);
      const endAt   = toUnix(sanitized.sale?.end);
      const softCapWei = parseUnits(asStr(sanitized.sale?.softCap), QUOTE_DECIMALS);
      const hardCapWei = parseUnits(asStr(sanitized.sale?.hardCap), QUOTE_DECIMALS);
      const minBuyWei  = parseUnits(asStr(sanitized.sale?.minPerWallet), QUOTE_DECIMALS);
      const maxBuyWei  = parseUnits(asStr(sanitized.sale?.maxPerWallet), QUOTE_DECIMALS);

      const totalSupplyUnits    = parseUnits(asStr(sanitized.token?.totalSupply), tokenDecimals);
      const saleTokensPoolUnits = parseUnits(asStr(sanitized.sale?.saleTokensPool), tokenDecimals);

      if (saleTokensPoolUnits <= 0n) { alert('Sale token pool must be > 0.'); setCreating(false); return; }
      if (totalSupplyUnits < saleTokensPoolUnits) { alert('Total supply must be >= Sale token pool.'); setCreating(false); return; }

      const isPublic   = !(sanitized.allowlist?.enabled);
      const merkleRoot: Hex = sanitized.allowlist?.enabled && sanitized.allowlist?.root
        ? (sanitized.allowlist.root as Hex)
        : (ZERO_BYTES32 as Hex);

      if (endAt <= startAt) { alert('End time must be after start time.'); setCreating(false); return; }
      if (hardCapWei < softCapWei) { alert('Hard cap must be >= soft cap.'); setCreating(false); return; }
      if (maxBuyWei > 0n && minBuyWei > maxBuyWei) { alert('Max per wallet must be >= min per wallet.'); setCreating(false); return; }
      if (!isPublic && (!value.allowlist?.root || merkleRoot === ZERO_BYTES32)) {
        alert('Allowlist is enabled but the Merkle root is missing.'); setCreating(false); return;
      }

      const clampBps = (n: number) => Math.max(0, Math.min(10_000, Math.floor(n || 0)));

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
      );
      const fallback = (x: bigint, min: bigint) => x > 0n ? x : min;
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
        payoutDelay,
        lpLockDuration,
        raiseFeeBps: raiseFeeBpsNum,
        tokenFeeBps: tokenFeeBpsNum,
        tokenName,
        tokenSymbol,
        tokenDecimals: tokenDecimalsClamped,
      };

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
        for (const k of ['startAt','endAt','softCap','hardCap','minBuy','maxBuy','totalSupply','saleTokensPool','payoutDelay','lpLockDuration'] as const) {
          if (typeof (aChecked as any)[k] !== 'bigint') {
            throw new Error(`${k} must be bigint, got ${typeof (aChecked as any)[k]}`);
          }
        }
      })(a);

      const salt = keccak256(
        encodePacked(['address','string'], [address as `0x${string}`, row.id])
      ) as Hex;

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

      // 4) Simulate + send
      const { request, result } = await publicClient!.simulateContract({
        address: LAUNCHPAD_FACTORY,
        abi: launchpadFactoryAbi,
        functionName: 'createPresale',
        args,
        account: address,
      });
      const predictedPool = result as `0x${string}`;
      const hash = await writeContractAsync(request);

      // mark pending
      {
        const { error } = await supabase.from('launches')
          .update({ chain_tx_hash: hash, chain_status: 'tx_submitted' })
          .eq('id', row.id);
        if (error) console.error('Supabase pre-update failed:', error);
      }

      // 6) Wait+parse
      const receipt = await publicClient!.waitForTransactionReceipt({ hash });
      const events = parseEventLogs({
        abi: launchpadFactoryAbi,
        logs: receipt.logs,
        eventName: 'PoolCreated',
      });
      const eventPool = events[0]?.args?.pool as `0x${string}` | undefined;
      const poolAddress = (eventPool ?? predictedPool ?? null);

      // 7) Persist
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
        const aForDb = argsForDb(a, { tokenDecimals, quoteDecimals: QUOTE_DECIMALS });
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

  /* ── Derived data for visuals ─────────────────────────────── */
  const ticker = value.token.symbol ? `$${value.token.symbol}` : 'tokens';
  const totalSupplyStr = value.token.totalSupply ?? '-';
  const totalSupplyNum = toNum(value.token.totalSupply);

  const tokenPctToLP = typeof value.lp?.tokenPercentToLP === 'number' ? value.lp.tokenPercentToLP : 0;
  const raisePctToLP = typeof value.lp?.percentToLP === 'number' ? value.lp.percentToLP : 60;
  const keepPctRem   = typeof value.sale?.keepPct === 'number' ? value.sale.keepPct : 0;

  const lpTokens = Number.isFinite(totalSupplyNum) ? Math.floor((totalSupplyNum * tokenPctToLP) / 100) : 0;
  const remainingAfterLP = Number.isFinite(totalSupplyNum) ? Math.max(0, totalSupplyNum - lpTokens) : 0;
  const keptTokens = Math.floor((remainingAfterLP * (Number.isFinite(keepPctRem) ? keepPctRem : 0)) / 100);
  const saleTokens = Math.max(0, remainingAfterLP - keptTokens);

  const keptPctOfTotal = totalSupplyNum > 0 ? (keptTokens / totalSupplyNum) * 100 : 0;
  const salePctOfTotal = totalSupplyNum > 0 ? (saleTokens / totalSupplyNum) * 100 : 0;
  const lpPctOfTotal   = totalSupplyNum > 0 ? (lpTokens / totalSupplyNum) * 100 : 0;

  const raiseFeePct   = typeof value.fees?.raisePct === 'number' ? value.fees.raisePct : undefined;
  const supplyFeePct  = typeof value.fees?.supplyPct === 'number' ? value.fees.supplyPct : undefined;
  const platformSupplyFeeTokens = Number.isFinite(totalSupplyNum) && typeof supplyFeePct === 'number'
    ? Math.floor(totalSupplyNum * (supplyFeePct / 100))
    : undefined;

  const saleDuration = humanRange(value.sale?.start, value.sale?.end);

  /* Donut geometry */
  const donut = useMemo(() => {
    const values = [
      { key: 'LP',    value: Math.max(0, lpTokens),   color: 'var(--fl-purple)' },
      { key: 'Sale',  value: Math.max(0, saleTokens), color: 'var(--fl-aqua)' },
      { key: 'Kept',  value: Math.max(0, keptTokens), color: 'var(--fl-gold)' },
    ];
    const total = values.reduce((s, v) => s + v.value, 0);
    const pct = total > 0 ? values.map(v => ({ ...v, pct: v.value / total })) : values.map(v => ({ ...v, pct: 0 }));
    let accum = 0;
    const radius = 46; const stroke = 16; const C = 2 * Math.PI * radius;
    const segments = pct.map(v => {
      const len = C * v.pct;
      const seg = { key: v.key, color: v.color, dash: `${len} ${C - len}`, offset: C * (1 - accum) + 0.0001 };
      accum += v.pct;
      return seg;
    });
    return { C, radius, stroke, segments };
  }, [lpTokens, saleTokens, keptTokens]);

  return (
    <form onSubmit={(e) => e.preventDefault()}>
      <div style={{ maxWidth: 1080, margin: '0 auto', width: '100%' }}>
        <div className="card" style={{ padding: 16, display: 'grid', gap: 16, minWidth: 0 }}>
          <div className="h2">Review</div>

          <div className="review-wrap">
            {/* Left column */}
            <div style={{ display: 'grid', gap: 12, minWidth: 0 }}>
              {/* Project + Token combined */}
              <section className="review-card">
                <div className="section-title">
                  Project: {value.project.name || '-'}
                </div>
                <dl className="kv">
                  <dt>Token Name</dt>
                  <dd className="break-anywhere">
                    {(value as any)?.token?.name || value.project.name || '-'}
                  </dd>
                  <dt>Symbol/Ticker</dt>
                  <dd>{value.token.symbol || '-'}</dd>
                  <dt>Decimals</dt>
                  <dd>{value.token.decimals}</dd>
                  <dt>Total Supply</dt>
                  <dd className="num">{totalSupplyStr}</dd>
                </dl>
              </section>

              {/* Sale */}
              <section className="review-card">
                <div className="section-title">Sale</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                <span className="pill">
  Pair: ${value.sale?.quote} / ${value.token.symbol || 'TKN'}
</span>
                  <span className="pill">Duration: {saleDuration}</span>
                </div>
                <dl className="kv">
                  <dt>Presale Start</dt><dd className="break-anywhere">{formatDateTimeMMDDYYYY(value.sale?.start)}</dd>
                  <dt>Presale End</dt><dd className="break-anywhere">{formatDateTimeMMDDYYYY(value.sale?.end)}</dd>
                  <dt>Soft Cap</dt><dd className="num">{formatAmtWithQuote(value.sale?.softCap, value.sale?.quote)}</dd>
                  <dt>Hard Cap</dt><dd className="num">{value.sale?.hardCap ? formatAmtWithQuote(value.sale?.hardCap, value.sale?.quote) : '(none)'}</dd>
                  {(value.sale?.minPerWallet || value.sale?.maxPerWallet) && (
                    <>
                      {value.sale?.minPerWallet && (<><dt>Min / wallet</dt><dd className="num">{formatAmtWithQuote(value.sale?.minPerWallet, value.sale?.quote)}</dd></>)}
                      {value.sale?.maxPerWallet && (<><dt>Max / wallet</dt><dd className="num">{formatAmtWithQuote(value.sale?.maxPerWallet, value.sale?.quote)}</dd></>)}
                    </>
                  )}
                </dl>
              </section>

              {/* Liquidity */}
              <section className="review-card">
                <div className="section-title">Liquidity</div>
                <dl className="kv">
                  <dt>Tokens → LP</dt><dd className="num">{Number.isFinite(tokenPctToLP) ? `${tokenPctToLP}%` : '-' } {Number.isFinite(lpTokens) && `· ${lpTokens.toLocaleString()} ${ticker}`}</dd>
                  <dt>Raise → LP</dt><dd className="num">{Number.isFinite(raisePctToLP) ? `${raisePctToLP}%` : '-'}</dd>
                  <dt>LP Lock</dt><dd>{value.lp?.lockDays ? `${value.lp.lockDays} days` : '-'}</dd>
                </dl>
                <div className="callout" style={{ marginTop: 8 }}>
                  Remaining tokens after LP are split by your “keep %”, with the rest routed to the sale pool.
                </div>
              </section>

              {/* Fees */}
              <section className="review-card">
                <div className="section-title">Fees</div>
                <dl className="kv">
                  <dt>Platform (raise)</dt><dd>{typeof raiseFeePct === 'number' ? `${raiseFeePct}%` : '—'}</dd>
                  <dt>Platform (supply)</dt>
                  <dd>
                    {typeof platformSupplyFeeTokens === 'number'
                      ? <span className="num">{platformSupplyFeeTokens.toLocaleString()} {ticker} <span style={{ color: 'var(--muted)' }}>({supplyFeePct}%)</span></span>
                      : '—'}
                  </dd>
                </dl>
              </section>

              {/* Allowlist */}
              <section className="review-card">
                <div className="section-title">Allowlist</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                  <span className={`badge ${value.allowlist?.enabled ? 'ok' : 'warn'}`}>
                    {value.allowlist?.enabled ? 'Enabled' : 'Disabled'}
                  </span>
                  {value.allowlist?.enabled && (
                    <span className="badge">Addresses: {value.allowlist?.count ?? 0}</span>
                  )}
                </div>
                {value.allowlist?.enabled && value.allowlist?.root && (
                  <div className="callout">
                    Merkle Root:&nbsp;
                    <code className="break-anywhere">
                      {`${value.allowlist.root.slice(0, 10)}…${value.allowlist.root.slice(-6)}`}
                    </code>
                  </div>
                )}
              </section>
            </div>

            {/* Right column (visuals) */}
            <aside className="right-rail">
              {/* Token distribution donut */}
              <section className="review-card">
                <div className="section-title">Token Distribution</div>
                <div className="donut">
                  <svg viewBox="0 0 120 120">
                    {/* base ring */}
                    <circle cx="60" cy="60" r={donut.radius} fill="none" stroke="var(--card-border)" strokeWidth={donut.stroke} opacity="0.35"/>
                    {/* segments */}
                    {donut.segments.map((s, i) => (
                      <circle
                        key={i}
                        cx="60" cy="60" r={donut.radius}
                        fill="none"
                        stroke={s.color}
                        strokeWidth={donut.stroke}
                        strokeDasharray={s.dash}
                        strokeDashoffset={s.offset}
                        transform="rotate(-90 60 60)"
                        strokeLinecap="butt"
                      />
                    ))}
                    {/* center label: Total Supply */}
            {/* use the same center you use for your arcs — 60/60 here */}
<g className="donut-center" transform="translate(60,60)" pointerEvents="none">
  <text y="-12" textAnchor="middle" style={{ fontSize: 8.5, fontWeight: 700 }}>Total Supply</text>
  <text y="2"   textAnchor="middle" style={{ fontSize: 10,  fontWeight: 900 }}>{totalSupplyStr}</text>
  <text y="14"  textAnchor="middle" style={{ fontSize: 7.5, opacity: .85 }}>{ticker}</text>
</g>

                  </svg>
                </div>
                <div className="legend" style={{ marginTop: 8 }}>
                  <span><i className="swatch" style={{ background: 'var(--fl-purple)' }} /> LP&nbsp;({lpPctOfTotal.toFixed(1)}%)</span>
                  <span><i className="swatch" style={{ background: 'var(--fl-aqua)' }} /> Tokens for Sale&nbsp;({salePctOfTotal.toFixed(1)}%)</span>
                  <span><i className="swatch" style={{ background: 'var(--fl-gold)' }} /> Kept&nbsp;({keptPctOfTotal.toFixed(1)}%)</span>
                </div>
                <dl className="kv" style={{ marginTop: 8 }}>
                  <dt>LP Tokens</dt><dd className="num">{lpTokens.toLocaleString()} {ticker}</dd>
                  <dt>Tokens for Sale</dt><dd className="num">{saleTokens.toLocaleString()} {ticker}</dd>
                  <dt>Kept</dt><dd className="num">{keptTokens.toLocaleString()} {ticker}</dd>
                </dl>
              </section>

              {/* Schedule quick view */}
              <section className="review-card">
                <div className="section-title">Schedule</div>
                <div className="pill" style={{ marginBottom: 8 }}>
                  {formatDateTimeMMDDYYYY(value.sale?.start)} → {formatDateTimeMMDDYYYY(value.sale?.end)}
                </div>
                <div className="callout">Your presale runs for <b>{saleDuration}</b>.</div>
              </section>
            </aside>
          </div>

          {/* Actions */}
          <div className="actions">
            <button type="button" className="button button-secondary" onClick={onBack}>← Back</button>
            <div className="actions-right">
              <button type="button" className="button" onClick={handleSaveDraft} disabled={creating}>Save Draft</button>
              <button type="button" className="button button-primary" onClick={handleCreate} disabled={creating}>
                {creating ? 'Creating…' : 'Create'}
              </button>
            </div>
          </div>

        </div>
      </div>
    </form>
  );
}
