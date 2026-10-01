import { ReactNode } from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost';
  children: ReactNode;
}

export function Button({ variant = 'primary', className = '', ...props }: ButtonProps) {
  const baseClasses = 'px-4 py-2 rounded-lg font-semibold text-sm transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed';
  const variants: Record<string, string> = {
    primary: 'bg-[#ff7a1a] text-[#08090b] hover:bg-[#ff9044]',
    secondary: 'bg-slate-700 text-white hover:bg-slate-600',
    ghost: 'bg-transparent text-white hover:bg-slate-800',
  };

  return (
    <button className={`${baseClasses} ${variants[variant]} ${className}`} {...props} />
  );
}
