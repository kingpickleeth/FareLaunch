import { useState } from 'react';
import { makeMerkle, isAddress } from '../utils/merkle';

type Props = {
  onResult?: (res: { root: string; count: number; invalid: number }) => void;
};

export default function AllowlistUploader({ onResult }: Props) {
  const [addresses, setAddresses] = useState<string[]>([]);
  const [invalid, setInvalid] = useState<string[]>([]);
  const [root, setRoot] = useState<string>('');
  const [loading, setLoading] = useState(false);

  async function handleFile(file: File) {
    try {
      setLoading(true);
      setAddresses([]);
      setInvalid([]);
      setRoot('');

      const text = await file.text();

      // Split by newlines, trim, and take the first CSV column if present
      const lines = text
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);

      const firstCol = lines.map((l) => l.split(',')[0]?.trim()).filter(Boolean);

      // Validate and collect bad rows
      const bad: string[] = [];
      const good = firstCol.filter((a) => {
        const ok = isAddress(a);
        if (!ok) bad.push(a);
        return ok;
      });

      // Dedupe case-insensitively
      const dedup = Array.from(new Set(good.map((x) => x.toLowerCase())));

      if (dedup.length === 0) {
        setAddresses([]);
        setInvalid(bad);
        setRoot('');
        onResult?.({ root: '', count: 0, invalid: bad.length });
        return;
      }

      const { root } = makeMerkle(dedup);
      setAddresses(dedup);
      setInvalid(bad);
      setRoot(root);
      console.log('Merkle:', { root, good: dedup.length, bad: bad.length });
      onResult?.({ root, count: dedup.length, invalid: bad.length });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card" style={{ padding: 16, display: 'grid', gap: 12 }}>
      <div className="h2">Allowlist (CSV → Merkle)</div>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <input
          type="file"
          accept=".csv,.txt"
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
        />
        <a
          href={`data:text/csv;charset=utf-8,${encodeURIComponent(
            '0x1111111111111111111111111111111111111111\n0x2222222222222222222222222222222222222222\n0x3333333333333333333333333333333333333333\n'
          )}`}
          download="allowlist_template.csv"
          className="badge"
          style={{ background: '#2a2d36' }}
        >
          Download template
        </a>
        {loading && <span style={{ opacity: 0.7 }}>Parsing…</span>}
      </div>

      <div style={{ display: 'grid', gap: 8, fontFamily: 'var(--font-data)' }}>
        <div>
          Valid addresses:{' '}
          <b style={{ color: 'var(--fl-aqua)' }}>{addresses.length}</b>
        </div>
        {invalid.length > 0 && (
          <div style={{ color: 'var(--fl-danger)' }}>
            Invalid rows: {invalid.length}{' '}
            {invalid.length > 0 && (
              <span style={{ opacity: 0.8 }}>
                (e.g. {invalid.slice(0, 3).join(', ')})
              </span>
            )}
          </div>
        )}
        {root && (
          <>
            <div>Merkle Root:</div>
            <code
              style={{
                background: '#101216',
                padding: 8,
                borderRadius: 8,
                wordBreak: 'break-all',
              }}
            >
              {root}
            </code>
          </>
        )}
      </div>
    </div>
  );
}
