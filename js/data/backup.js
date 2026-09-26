export function exportBackup() {
  if (typeof window.exportBackup === 'function') return window.exportBackup();
  if (typeof window.backupData === 'function') return window.backupData();
  const raw = localStorage.getItem('xe3agle_state') || JSON.stringify(window.state || {});
  const blob = new Blob([raw], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `xe3agle-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
  window.toast?.('Backup exported.', 'success');
}
