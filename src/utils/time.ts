export function salePhase(nowMs: number, start?: string | null, end?: string | null) {
  const s = start ? Date.parse(start) : NaN;
  const e = end ? Date.parse(end) : NaN;
  if (!Number.isFinite(s) || !Number.isFinite(e)) return 'tba';
  if (nowMs < s) return 'upcoming';
  if (nowMs >= s && nowMs < e) return 'active';
  return 'ended';
}

export function countdown(toIso?: string | null) {
  if (!toIso) return null;
  const ms = Date.parse(toIso) - Date.now();
  if (ms <= 0) return { d:0,h:0,m:0,s:0, ms: 0 };
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return { d, h, m, s: sec, ms };
}
