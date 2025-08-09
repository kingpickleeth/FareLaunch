import type { WizardData } from '../../types/wizard';
import { upsertLaunch } from '../../data/launches';
import { useAccount } from 'wagmi';
import { supabase } from '../../lib/supabase';
import { makeMerkle, isAddress } from '../../utils/merkle';
import { useNavigate } from 'react-router-dom';

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

export default function StepReview({ value, onBack, onFinish, editingId }: Props) {
  const { address, isConnected } = useAccount();
  const navigate = useNavigate();

  async function handleCreate() {
    try {
      if (!isConnected || !address) { alert('Connect your wallet first.'); return; }
      if (!supabase) { alert('Supabase not configured.'); return; }

      const rawAddrs = ((value.allowlist as any)?.addresses ?? []) as string[];

      // INSERT new or UPDATE existing to "upcoming"
      const sanitized = sanitizeWizardNumbers(value);
      const row = await upsertLaunch(address, sanitized, editingId, 'upcoming');

      // If allowlist enabled: verify & upload
      if (value.allowlist?.enabled) {
        const normalized = Array.from(
          new Set(
            rawAddrs
              .map(a => a?.trim().toLowerCase())
              .filter((a): a is string => !!a && isAddress(a))
          )
        );

        if (normalized.length === 0) { alert('Allowlist is enabled but contains 0 valid addresses.'); return; }

        const { root: recomputed } = makeMerkle(normalized);
        if (!value.allowlist.root || recomputed !== value.allowlist.root) {
          alert('Merkle root mismatch. Please re-upload your list.');
          return;
        }

        await upsertAllowlistBatched(row.id, normalized);

        // Patch launch with root & count if missing/stale
        if (row.allowlist_root !== value.allowlist.root || row.allowlist_count !== normalized.length) {
          const { error: patchErr } = await supabase
            .from('launches')
            .update({ allowlist_root: value.allowlist.root, allowlist_count: normalized.length })
            .eq('id', row.id);
          if (patchErr) throw patchErr;
        }
      } else if (editingId) {
        // If editing and allowlist is now disabled, clear any previous root/count
        const { error: clrErr } = await supabase
          .from('launches')
          .update({ allowlist_root: null, allowlist_count: null, allowlist_enabled: false })
          .eq('id', row.id);
        if (clrErr) throw clrErr;
      }

      alert(`Launch created! ID: ${row.id}`);
      navigate(`/sale/${row.id}`, { replace: true });
      onFinish?.();
    } catch (e: any) {
      console.error(e);
      alert(`Failed to create launch: ${e?.message || e}`);
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
              <button type="button" className="button" onClick={handleSaveDraft}>Save Draft</button>
              <button type="button" className="button button-secondary" onClick={handleCreate}>Create</button>
            </div>
          </div>

        </div>
      </div>
    </form>
  );
}
