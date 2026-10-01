export default function PricingPage() {
  const plans = [
    { name: 'Free', price: '$0', description: 'For traders starting to build structure.', perks: ['1 account', 'Basic daily review', 'Risk engine active'] },
    { name: 'PRO', price: '$49', description: 'For serious execution and accountability.', perks: ['3 accounts', 'Analytics', 'Weekly Telegram summary'] },
    { name: 'PRO+', price: '$99', description: 'For advanced journaling and account management.', perks: ['15 accounts', 'Custom risk per account', 'CSV import/export', 'Playbook library'] },
  ];

  return (
    <main className="container-screen py-20">
      <div className="mx-auto max-w-3xl text-center">
        <p className="text-sm uppercase tracking-[0.2em] text-[#ffb27e]">Pricing</p>
        <h1 className="mt-4 section-title">Transparent plans for disciplined traders.</h1>
      </div>

      <div className="mt-12 grid gap-6 md:grid-cols-3">
        {plans.map((plan) => (
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
    </main>
  );
}
