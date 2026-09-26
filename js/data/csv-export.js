export function exportCSV() {
  if (typeof window.exportCSV === 'function') return window.exportCSV();
  const trades = Array.isArray(window.state?.trades) ? window.state.trades : [];
  const headers = ['id','date','time','direction','entry','sl','tp','result','resultR','resultPL','setup','session','emotion','notes'];
  const esc = (v) => {
    const s = String(v ?? '');
    return /["\n,]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.join(',')];
  for (const t of trades) lines.push(headers.map((h) => esc(t[h])).join(','));
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `xe3agle-trades-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
  window.toast?.('CSV exported.', 'success');
}
