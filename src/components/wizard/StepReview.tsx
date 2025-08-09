import { saveAs as saveFile } from 'file-saver';
import type { WizardData } from '../../types/wizard';
import { upsertLaunch } from '../../data/launches';
import { useAccount } from 'wagmi';

import { supabase } from '../../lib/supabase';
import { makeMerkle, isAddress } from '../../utils/merkle';
import { useNavigate } from 'react-router-dom';

type Props = {
  value: WizardData;
  onBack: () => void;
  onFinish?: () => void; // optional
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

export default function StepReview({ value, onBack, onFinish }: Props) {
  const { address, isConnected } = useAccount();
  const navigate = useNavigate();

  function download() {
    const blob = new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' });
    saveFile(blob, `farelaunch-config-${Date.now()}.json`);
  }

  async function handleCreate() {
    try {
      if (!isConnected || !address) {
        alert('Connect your wallet first.');
        return;
      }
      if (!supabase) {
        alert('Supabase not configured.');
        return;
      }

      const rawAddrs = ((value.allowlist as any)?.addresses ?? []) as string[];
      console.log('[Review] allowlist snapshot', {
        enabled: value.allowlist?.enabled,
        root: value.allowlist?.root,
        count: value.allowlist?.count,
        addressesLen: rawAddrs.length,
        sample: rawAddrs.slice(0, 3),
      });

      // insert/promote to upcoming
      const row = await upsertLaunch(address, value, undefined, 'upcoming');
      console.log('[Review] launch row returned', { id: row?.id, typeofId: typeof row?.id });

      if (value.allowlist?.enabled) {
        const normalized = Array.from(
          new Set(
            rawAddrs
              .map(a => a?.trim().toLowerCase())
              .filter((a): a is string => !!a && isAddress(a))
          )
        );
        if (normalized.length === 0) {
          alert('Allowlist is enabled but contains 0 valid addresses.');
          return;
        }
        const { root: recomputed } = makeMerkle(normalized);
        if (!value.allowlist.root || recomputed !== value.allowlist.root) {
          console.warn('[Review] Merkle mismatch', { wizard: value.allowlist.root, recomputed });
          alert('Merkle root mismatch. Please re-upload your list.');
          return;
        }

        await upsertAllowlistBatched(row.id, normalized);

        if (row.allowlist_root !== value.allowlist.root || row.allowlist_count !== normalized.length) {
          const { error: patchErr } = await supabase
            .from('launches')
            .update({
              allowlist_root: value.allowlist.root,
              allowlist_count: normalized.length,
            })
            .eq('id', row.id);
          if (patchErr) throw patchErr;
        }
      }

      alert(`Launch created! ID: ${row.id}`);
      // 👉 go to the sale you just created
      navigate(`/sale/${row.id}`, { replace: true });
      onFinish?.();
    } catch (e: any) {
      console.error(e);
      alert(`Failed to create launch: ${e?.message || e}`);
    }
  }

  async function handleSaveDraft() {
    try {
      if (!isConnected || !address) {
        alert('Connect your wallet first.');
        return;
      }
      const row = await upsertLaunch(address, value);
      alert(`Saved draft! ID: ${row.id}`);
      // drafts → My Launches
      navigate('/me', { replace: true });
    } catch (e: any) {
      console.error(e);
      alert(`Failed to save draft: ${e?.message || e}`);
    }
  }

  const totalSupply = value.token.totalSupply ?? '-';
  const salePool = value.sale?.saleTokensPool ?? '-';

  return (
    <form onSubmit={(e) => e.preventDefault()}>
      <div className="card" style={{ padding: 16, display: 'grid', gap: 16 }}>
        <div className="h2">Review</div>

        <div className="card" style={{ background: '#141720', padding: 12, borderRadius: 12 }}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Project</div>
          <div>Name: <b>{value.project.name || '-'}</b></div>
          <div>Website: <b>{value.project.website || '-'}</b></div>
          <div>Twitter: <b>{value.project.twitter || '-'}</b></div>
        </div>

        <div className="card" style={{ background: '#141720', padding: 12, borderRadius: 12 }}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Token</div>
          <div>Symbol: <b>{value.token.symbol}</b></div>
          <div>Decimals: <b>{value.token.decimals}</b></div>
          <div>Total Supply: <b>{totalSupply}</b></div>
        </div>

        <div className="card" style={{ background: '#141720', padding: 12, borderRadius: 12 }}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Fair Launch</div>
          <div>Quote: <b>{value.sale?.quote}</b></div>
          <div>Start: <b>{value.sale?.start || '-'}</b></div>
          <div>End: <b>{value.sale?.end || '-'}</b></div>
          <div>Soft Cap: <b>{value.sale?.softCap || '-'}</b></div>
          <div>Hard Cap: <b>{value.sale?.hardCap || '(none)'}</b></div>
          <div>Keep %: <b>{value.sale?.keepPct ?? 0}%</b></div>
          <div>Tokens for Sale: <b>{salePool}</b></div>
          <div>Per-wallet min/max: <b>{value.sale?.minPerWallet || '-'}</b> / <b>{value.sale?.maxPerWallet || '-'}</b></div>
        </div>

        <div className="card" style={{ background: '#141720', padding: 12, borderRadius: 12 }}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Allowlist</div>
          <div>Status: <b>{value.allowlist?.enabled ? 'Enabled' : 'Disabled'}</b></div>
          {value.allowlist?.enabled && (
            <>
              <div>Addresses: <b>{value.allowlist?.count ?? 0}</b></div>
              <div>Root: <code style={{ opacity: .8 }}>{value.allowlist?.root || '-'}</code></div>
            </>
          )}
        </div>

        <div className="card" style={{ background: '#141720', padding: 12, borderRadius: 12 }}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>LP & Fees</div>
          <div>% to LP: <b>{value.lp?.percentToLP ?? 60}%</b></div>
          <div>Lock: <b>{value.lp?.lockDays} days</b></div>
          <div>Slippage: <b>{(value.lp?.slippageBps ?? 50) / 100}%</b></div>
          <div>Platform fee (raise): <b>{(value.fees?.raisePct ?? 5)}%</b></div>
          <div>Platform fee (supply): <b>{(value.fees?.supplyPct ?? 0.05)}%</b></div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
          <button type="button" className="button" onClick={onBack}>← Back</button>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="button" onClick={download}>Download JSON</button>
            <button type="button" className="button" onClick={handleSaveDraft}>Save Draft</button>
            <button type="button" className="button button-secondary" onClick={handleCreate}>Create</button>
          </div>
        </div>
      </div>
    </form>
  );
}
