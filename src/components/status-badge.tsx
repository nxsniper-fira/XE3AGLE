import { getStatusPillClasses } from '@/lib/status';

interface StatusBadgeProps {
  status: string;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${getStatusPillClasses(status)}`}>
      {status}
    </span>
  );
}
