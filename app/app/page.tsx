export default function AppDashboardPage() {
  const stats = [
    { label: 'Daily P&L', value: '+$420' },
    { label: 'Discipline Score', value: '86' },
    { label: 'Current Streak', value: '9 days' },
    { label: 'Trades Left', value: '2' },
  ];

  return (
    <main className="container-screen py-12">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.2em] text-[#ffb27e]">Dashboard</p>
          <h1 className="mt-3 section-title text-3xl md:text-4xl">Today’s discipline status</h1>
        </div>
        <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-sm font-semibold text-emerald-300">TRADE_APPROVED</span>
      </div>

      <div className="grid gap-6 md:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="soft-card p-5">
            <p className="text-sm text-slate-400">{stat.label}</p>
            <p className="mt-3 text-3xl font-display font-bold text-white">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.5fr_0.8fr]">
        <div className="soft-card p-6">
          <h2 className="text-xl font-bold text-white">Discipline flow</h2>
          <div className="mt-6 space-y-3">
            {['Prepare', 'Analysis', 'Pre-Trade', 'Trade', 'Review'].map((item) => (
              <div key={item} className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/60 px-4 py-3">
                <span className="text-slate-200">{item}</span>
                <span className="text-emerald-400">Complete</span>
              </div>
            ))}
          </div>
        </div>

        <div className="soft-card p-6">
          <h2 className="text-xl font-bold text-white">Risk checks</h2>
          <ul className="mt-6 space-y-3 text-sm text-slate-200">
            <li>• Max risk per trade: 0.5%</li>
            <li>• Daily loss cap: 1%</li>
            <li>• Max 3 trades/day</li>
            <li>• +2R stop rule active</li>
            <li>• Kill switch available</li>
          </ul>
        </div>
      </div>
    </main>
  );
}
