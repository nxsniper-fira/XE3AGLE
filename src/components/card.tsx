import { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
  variant?: 'default' | 'elevated' | 'outlined';
}

export function Card({ children, className = '', variant = 'elevated' }: CardProps) {
  const variants: Record<string, string> = {
    default: 'bg-[#12151d]',
    elevated: 'bg-[#12151d] border border-slate-800 shadow-lg shadow-black/50',
    outlined: 'bg-transparent border border-slate-700',
  };

  return (
    <div className={`rounded-lg p-6 ${variants[variant]} ${className}`}>
      {children}
    </div>
  );
}
