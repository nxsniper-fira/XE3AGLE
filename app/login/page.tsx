export default function LoginPage() {
  return (
    <main className="container-screen py-20">
      <div className="mx-auto max-w-md soft-card p-8">
        <h1 className="section-title text-3xl">Welcome back</h1>
        <form className="mt-8 space-y-5">
          <div>
            <label className="mb-2 block text-sm text-slate-300">Email</label>
            <input className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-[#ff7a1a]" type="email" placeholder="you@example.com" />
          </div>
          <div>
            <label className="mb-2 block text-sm text-slate-300">Password</label>
            <input className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-[#ff7a1a]" type="password" placeholder="••••••••" />
          </div>
          <button className="w-full rounded-xl bg-[#ff7a1a] px-4 py-3 font-semibold text-[#08090b] transition hover:bg-[#ff8f43]">Log in</button>
        </form>
      </div>
    </main>
  );
}
