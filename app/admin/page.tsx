export default function AdminOverviewPage() {
  const metrics = [
    { label: 'Total users', value: '4,280' },
    { label: 'Active PRO', value: '1,120' },
    { label: 'Active PRO+', value: '390' },
    { label: 'Pending payments', value: '18' },
  ];

  return (
    <main className="container-screen py-12">
      <div className="mb-8">
        <p className="text-sm uppercase tracking-[0.2em] text-[#ffb27e]">Admin panel</p>
        <h1 className="mt-3 section-title text-3xl md:text-4xl">Platform overview</h1>
      </div>

      <div className="grid gap-6 md:grid-cols-4">
        {metrics.map((metric) => (
          <div key={metric.label} className="soft-card p-5">
            <p className="text-sm text-slate-400">{metric.label}</p>
            <p className="mt-3 text-3xl font-display font-bold text-white">{metric.value}</p>
          </div>
        ))}
      </div>
    </main>
  );
}
