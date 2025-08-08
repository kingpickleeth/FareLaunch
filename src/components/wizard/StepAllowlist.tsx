import { useEffect, useState } from 'react';
import type { WizardData } from '../../types/wizard';
import AllowlistUploader from '../AllowlistUploader';

type Props = {
  value: WizardData;
  onChange: (next: WizardData) => void;
  onNext: () => void;
  onBack: () => void;
};

export default function StepAllowlist({ value, onChange, onNext, onBack }: Props) {
  const [enabled, setEnabled] = useState<boolean>(!!value.allowlist?.enabled);
  const [root, setRoot] = useState<string>(value.allowlist?.root ?? '');
  const [count, setCount] = useState<number>(value.allowlist?.count ?? 0);

  useEffect(() => {
    if (!enabled) {
      setRoot('');
      setCount(0);
    }
  }, [enabled]);

  const canContinue = enabled ? (root.startsWith('0x') && root.length === 66 && count > 0) : true;

  function commitAndNext() {
    onChange({
      ...value,
      allowlist: enabled ? { enabled: true, root, count } : { enabled: false },
    });
    onNext();
  }

  return (
    <div className="card" style={{ padding: 16, display: 'grid', gap: 16 }}>
      <div className="h2">Allowlist</div>

      <label className="button" style={{ background:'#2a2d36', color:'#fff', width:'fit-content' }}>
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          style={{ marginRight: 8 }}
        />
        Enable allowlist (private sale)
      </label>

      {enabled ? (
        <AllowlistUploader
          onResult={({ root, count }) => {
            console.log('AllowlistUploader -> onResult', { root, count });
            setRoot(root);
            setCount(count);
          }}
        />
      ) : (
        <div style={{ opacity: .8 }}>
          Leave disabled for an open sale. You can turn it on later before launch if needed.
        </div>
      )}

      <div className="card" style={{ background: '#141720', padding: 12, borderRadius: 12 }}>
        <div style={{ fontWeight: 700, marginBottom: 6 }}>Summary</div>
        <div style={{ display:'flex', gap:18, flexWrap:'wrap', fontFamily:'var(--font-data)' }}>
          <div>Allowlist: <b>{enabled ? 'Enabled' : 'Disabled'}</b></div>
          {enabled && (
            <>
              <div>Addresses: <b>{count}</b></div>
              <div>Root: <code style={{ opacity:.8 }}>
                {root ? `${root.slice(0,10)}…${root.slice(-6)}` : '-'}
              </code></div>
            </>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
        <button className="button" onClick={onBack}>← Back</button>
        <button
          className="button button-primary"
          onClick={commitAndNext}
          disabled={!canContinue}
          style={{ opacity: canContinue ? 1 : 0.5 }}
        >
          Save & Continue
        </button>
      </div>
    </div>
  );
}
