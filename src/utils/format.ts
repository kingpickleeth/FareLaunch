export function formatNumber(num: number | string) {
  if (num === null || num === undefined || num === '') return '—';
  const n = typeof num === 'string' ? Number(num) : num;
  if (!Number.isFinite(n)) return String(num);
  return n.toLocaleString(); // adds commas automatically
}
