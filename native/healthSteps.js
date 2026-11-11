// Explicit local-midnight windows avoid UTC dates and stale/missing period buckets.
export function localDay(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export async function readDailySteps(HC, now = new Date()) {
  const granted = await HC.getGrantedPermissions();
  if (!granted.some(p => p.recordType === 'Steps' && p.accessType === 'read')) return { error: 'denied' };
  const days = {};
  for (let ago = 0; ago <= 7; ago++) {
    const start = new Date(now); start.setHours(0, 0, 0, 0); start.setDate(start.getDate() - ago);
    const end = new Date(start); end.setDate(end.getDate() + 1);
    const stop = ago === 0 ? now : end;
    const total = stop > start ? await HC.aggregateRecord({ recordType: 'Steps', timeRangeFilter: { operator: 'between', startTime: start.toISOString(), endTime: stop.toISOString() } }) : null;
    days[localDay(start)] = Math.max(0, Math.round(Number(total && total.COUNT_TOTAL) || 0));
  }
  return { days, at: now.getTime() };
}
