'use client';

import Link from 'next/link';
import { Logo } from '@/components/logo';

export function Header() {
  return (
    <header className="border-b border-slate-800 bg-[#08090b]/80 backdrop-blur supports-[backdrop-filter]:bg-[#08090b]/60 sticky top-0 z-40">
      <nav className="flex items-center justify-between px-6 py-4 max-w-7xl mx-auto">
        <Link href="/" className="flex items-center gap-2 group">
          <div className="w-8 h-8">
            <Logo />
          </div>
          <span className="font-display font-bold text-lg text-white group-hover:text-[#ff7a1a] transition-colors">XE3AGLE</span>
        </Link>
        <div className="flex items-center gap-6">
          <Link href="/pricing" className="text-sm text-slate-300 hover:text-white transition-colors">
            Pricing
          </Link>
          <Link href="/login" className="text-sm text-slate-300 hover:text-white transition-colors">
            Sign in
          </Link>
          <Link
            href="/signup"
            className="inline-flex items-center justify-center px-4 py-2 bg-[#ff7a1a] text-[#08090b] rounded-lg font-semibold text-sm hover:bg-[#ff9044] transition-colors"
          >
            Start free
          </Link>
        </div>
      </nav>
    </header>
  );
}
