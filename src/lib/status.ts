export function getStatusPillClasses(status: string): string {
  const statusLower = status.toLowerCase();
  
  const statusMap: { [key: string]: string } = {
    active: 'bg-green-100 text-green-800',
    inactive: 'bg-gray-100 text-gray-800',
    pending: 'bg-yellow-100 text-yellow-800',
    completed: 'bg-blue-100 text-blue-800',
    failed: 'bg-red-100 text-red-800',
    success: 'bg-green-100 text-green-800',
    warning: 'bg-yellow-100 text-yellow-800',
    error: 'bg-red-100 text-red-800',
  };
  
  return statusMap[statusLower] || 'bg-slate-100 text-slate-800';
}
