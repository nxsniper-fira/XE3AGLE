import Link from 'next/link';

const footerLinks: Array<{ href: '/' | '/pricing' | '/login' | '/signup'; label: string }> = [
  { href: '/', label: 'Home' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/login', label: 'Login' },
  { href: '/signup', label: 'Signup' },
];

export function Footer() {
  return (
    <footer className="border-t border-slate-800 bg-[#08090b]/80">
      <div className="container-screen flex flex-col gap-6 py-8 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-lg font-display font-bold text-white">XE3AGLE</p>
          <p className="text-sm text-slate-400">Discipline over impulse.</p>
        </div>

        <nav className="flex flex-wrap gap-4 text-sm text-slate-300">
          {footerLinks.map((link) => (
            <Link key={link.href} href={link.href} className="transition hover:text-white">
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
