import Link from 'next/link';

export default function AuthShellPage() {
  return (
    <main className="container-screen py-20">
      <div className="mx-auto max-w-2xl soft-card p-8 text-center">
        <p className="text-sm uppercase tracking-[0.2em] text-[#ffb27e]">Auth</p>
        <h1 className="mt-4 text-4xl font-display font-bold text-white">Protected access</h1>
        <p className="mt-4 text-slate-300">This project is ready to wire into an auth provider such as Auth.js, Clerk, or Supabase Auth.</p>
        <div className="mt-8 flex justify-center gap-4">
          <Link href="/login" className="rounded-xl bg-[#ff7a1a] px-5 py-3 font-semibold text-[#08090b] transition hover:bg-[#ff8f43]">
            Login
          </Link>
          <Link href="/signup" className="rounded-xl border border-slate-700 bg-slate-900 px-5 py-3 font-semibold text-white transition hover:border-slate-500">
            Signup
          </Link>
        </div>
      </div>
    </main>
  );
}
