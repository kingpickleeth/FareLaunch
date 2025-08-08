import { saveAs as saveFile } from 'file-saver';
import type { WizardData } from '../../types/wizard';

type Props = {
  value: WizardData;
  onBack: () => void;
  onFinish?: () => void; // later: deploy
};

export default function StepReview({ value, onBack, onFinish }: Props) {
    function download() {
        const blob = new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' });
        saveFile(blob, `farelaunch-config-${Date.now()}.json`);
      }
  const totalSupply = value.token.totalSupply ?? '-';
  const salePool = value.sale?.saleTokensPool ?? '-';

  return (
    <div className="card" style={{ padding: 16, display:'grid', gap:16 }}>
      <div className="h2">Review</div>

      <div className="card" style={{ background:'#141720', padding:12, borderRadius:12 }}>
        <div style={{ fontWeight:700, marginBottom:6 }}>Project</div>
        <div>Name: <b>{value.project.name || '-'}</b></div>
        <div>Website: <b>{value.project.website || '-'}</b></div>
        <div>Twitter: <b>{value.project.twitter || '-'}</b></div>
      </div>

      <div className="card" style={{ background:'#141720', padding:12, borderRadius:12 }}>
        <div style={{ fontWeight:700, marginBottom:6 }}>Token</div>
        <div>Symbol: <b>{value.token.symbol}</b></div>
        <div>Decimals: <b>{value.token.decimals}</b></div>
        <div>Total Supply: <b>{totalSupply}</b></div>
      </div>

      <div className="card" style={{ background:'#141720', padding:12, borderRadius:12 }}>
        <div style={{ fontWeight:700, marginBottom:6 }}>Fair Launch</div>
        <div>Quote: <b>{value.sale?.quote}</b></div>
        <div>Start: <b>{value.sale?.start || '-'}</b></div>
        <div>End: <b>{value.sale?.end || '-'}</b></div>
        <div>Soft Cap: <b>{value.sale?.softCap || '-'}</b></div>
        <div>Hard Cap: <b>{value.sale?.hardCap || '(none)'}</b></div>
        <div>Keep %: <b>{value.sale?.keepPct ?? 0}%</b></div>
        <div>Tokens for Sale: <b>{salePool}</b></div>
        <div>Per-wallet min/max: <b>{value.sale?.minPerWallet || '-'}</b> / <b>{value.sale?.maxPerWallet || '-'}</b></div>
      </div>

      <div className="card" style={{ background:'#141720', padding:12, borderRadius:12 }}>
        <div style={{ fontWeight:700, marginBottom:6 }}>Allowlist</div>
        <div>Status: <b>{value.allowlist?.enabled ? 'Enabled' : 'Disabled'}</b></div>
        {value.allowlist?.enabled && (
          <>
            <div>Addresses: <b>{value.allowlist?.count ?? 0}</b></div>
            <div>Root: <code style={{ opacity:.8 }}>{value.allowlist?.root || '-'}</code></div>
          </>
        )}
      </div>

      <div className="card" style={{ background:'#141720', padding:12, borderRadius:12 }}>
        <div style={{ fontWeight:700, marginBottom:6 }}>LP & Fees</div>
        <div>% to LP: <b>{value.lp?.percentToLP ?? 60}%</b></div>
        <div>Lock: <b>{value.lp?.lockDays} days</b></div>
        <div>Slippage: <b>{(value.lp?.slippageBps ?? 50) / 100}%</b></div>
        <div>Platform fee (raise): <b>{(value.fees?.raisePct ?? 5)}%</b></div>
        <div>Platform fee (supply): <b>{(value.fees?.supplyPct ?? 0.05)}%</b></div>
      </div>

      <div style={{ display:'flex', justifyContent:'space-between', gap:12 }}>
        <button className="button" onClick={onBack}>← Back</button>
        <div style={{ display:'flex', gap:8 }}>
          <button className="button" onClick={download}>Download JSON</button>
          <button className="button button-secondary" onClick={onFinish}>Finish</button>
        </div>
      </div>
    </div>
  );
}

// very small helper (avoid adding a lib just for this)
export function saveAs(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
