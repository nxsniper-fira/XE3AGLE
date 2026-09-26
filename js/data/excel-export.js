import { exportCSV } from './csv-export.js';
export function exportExcel() {
  if (typeof window.exportExcel === 'function') return window.exportExcel();
  exportCSV();
  window.toast?.('Excel-compatible CSV exported.', 'info');
}
