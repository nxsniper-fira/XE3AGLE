import Link from 'next/link';

const metrics = [
  { label: 'Risk rules enforced', value: '100%' },
  { label: 'Discipline score', value: '86' },
  { label: 'Trade review completion', value: '98%' },
];

export default function HomePage() {
  return (
    <main className="min-h-screen">
      <section className="container-screen py-16 md:py-24">
        <div className="grid items-center gap-12 lg:grid-cols-[1.2fr_0.8fr]">
          <div>
            <span className="inline-flex items-center rounded-full border border-[#ff7a1a]/40 bg-[#ff7a1a]/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-[#ffb27e]">
              Discipline over impulse
            </span>
            <h1 className="mt-6 text-5xl md:text-7xl font-display font-black tracking-tight text-white leading-[0.92]">
              You cannot trade until the system says you may.
            </h1>
            <p className="mt-6 max-w-xl text-lg text-slate-300">
              XE3AGLE blocks impulsive execution, enforces trade discipline, and gives traders the visibility to improve every day.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <Link href="/signup" className="inline-flex items-center justify-center rounded-xl bg-[#ff7a1a] px-6 py-3 font-semibold text-[#08090b] transition hover:bg-[#ff8f43]">
                Start free trial
              </Link>
              <Link href="/pricing" className="inline-flex items-center justify-center rounded-xl border border-slate-700 bg-slate-900 px-6 py-3 font-semibold text-white transition hover:border-slate-500">
                View pricing
              </Link>
            </div>
          </div>

          <div className="soft-card p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <p className="text-sm text-slate-400">Live status</p>
                <p className="text-2xl font-bold text-white">WAIT</p>
              </div>
              <span className="rounded-full bg-slate-800 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-300">
                Risk active
              </span>
            </div>

            <div className="space-y-4">
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                <div className="flex justify-between text-sm text-slate-400">
                  <span>Daily P&L</span>
                  <span className="text-emerald-400">+$420</span>
                </div>
                <div className="mt-2 flex justify-between text-sm">
                  <span>Risk budget left</span>
                  <span>0.7%</span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                  <div className="text-xl font-bold text-white">86</div>
                  <div className="text-xs text-slate-400">Score</div>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                  <div className="text-xl font-bold text-white">9</div>
                  <div className="text-xs text-slate-400">Streak</div>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                  <div className="text-xl font-bold text-white">2</div>
                  <div className="text-xs text-slate-400">Left</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="container-screen py-12">
        <div className="grid gap-6 md:grid-cols-3">
          {metrics.map((item) => (
            <div key={item.label} className="soft-card p-6">
              <p className="text-sm text-slate-400">{item.label}</p>
              <p className="mt-3 text-4xl font-display font-bold text-white">{item.value}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="container-screen py-20">
        <div className="text-center mb-12">
          <p className="text-sm uppercase tracking-[0.2em] text-[#ffb27e]">Why traders use XE3AGLE</p>
          <h2 className="section-title mt-3">Built for traders who need structure.</h2>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {[
            'Mandatory sequence: Prepare → Analysis → Pre-Trade → Trade → Review',
            'Server-side risk limits that cannot be bypassed',
            'Visible progress through discipline score, streaks, and weekly outcomes',
          ].map((feature) => (
            <div key={feature} className="soft-card p-6 text-slate-200">
              {feature}
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
