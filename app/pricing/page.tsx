import { dashboardStats, disciplineSteps, prices } from '@/lib/demo-data';
import { evaluateRisk, getTradeApprovalStatus } from '@/lib/risk';

export default function PricingPage() {
  const riskState = evaluateRisk({
    dailyLoss: 0.72,
    riskPerTrade: 0.35,
    maxDailyLoss: 1,
    maxTradesPerDay: 3,
    tradesToday: 2,
  });

  return (
    <main className="container-screen py-20">
      <div className="mx-auto max-w-3xl text-center">
        <p className="text-sm uppercase tracking-[0.2em] text-[#ffb27e]">Pricing</p>
        <h1 className="mt-4 section-title">Transparent plans for disciplined traders.</h1>
      </div>

      <div className="mt-12 grid gap-6 md:grid-cols-3">
        {prices.map((plan) => (
          <div key={plan.name} className="soft-card p-6">
            <p className="text-sm uppercase tracking-[0.2em] text-slate-400">{plan.name}</p>
            <div className="mt-5 flex items-end gap-2">
              <span className="text-4xl font-display font-bold text-white">{plan.price}</span>
              <span className="text-slate-400">/ month</span>
            </div>
            <p className="mt-4 text-slate-300">{plan.description}</p>
            <ul className="mt-6 space-y-3 text-sm text-slate-200">
              {plan.perks.map((perk) => (
                <li key={perk}>• {perk}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="mt-16 soft-card p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-[#ffb27e]">Risk status</p>
            <h2 className="mt-2 text-2xl font-display font-bold text-white">Current trade gate</h2>
          </div>
          <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-sm font-semibold text-emerald-300">
            {getTradeApprovalStatus(riskState)}
          </span>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {riskState.map((check) => (
            <div key={check.label} className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
              <p className="text-sm text-slate-400">{check.label}</p>
              <p className="mt-2 text-xl font-bold text-white">{check.value}</p>
              <p className="mt-2 text-xs uppercase tracking-[0.2em] text-emerald-300">{check.status}</p>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
