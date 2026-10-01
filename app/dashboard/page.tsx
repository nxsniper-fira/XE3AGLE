export default function DashboardPage() {
  return (
    <main className="container-screen py-16">
      <div className="mb-8">
        <p className="text-sm uppercase tracking-[0.2em] text-[#ffb27e]">Dashboard</p>
        <h1 className="mt-3 text-4xl font-display font-bold text-white">Overview</h1>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="soft-card p-6">
          <p className="text-sm text-slate-400">Weekly P&amp;L</p>
          <p className="mt-4 text-3xl font-display font-bold text-white">+$1,245</p>
        </div>
        <div className="soft-card p-6">
          <p className="text-sm text-slate-400">Win rate</p>
          <p className="mt-4 text-3xl font-display font-bold text-white">58%</p>
        </div>
        <div className="soft-card p-6">
          <p className="text-sm text-slate-400">Average R</p>
          <p className="mt-4 text-3xl font-display font-bold text-white">+1.6R</p>
        </div>
      </div>
    </main>
  );
}
