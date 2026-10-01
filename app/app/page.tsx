import { adminPayments } from '@/lib/demo-data';

export default function AdminPage() {
  return (
    <main className="container-screen py-16">
      <div className="mb-8">
        <p className="text-sm uppercase tracking-[0.2em] text-[#ffb27e]">Admin dashboard</p>
        <h1 className="mt-3 text-4xl font-display font-bold text-white">Platform overview</h1>
      </div>

      <div className="grid gap-6 md:grid-cols-4">
        {[
          { label: 'Total users', value: '4,280' },
          { label: 'Active PRO', value: '1,120' },
          { label: 'Active PRO+', value: '390' },
          { label: 'Pending payments', value: '18' },
        ].map((metric) => (
          <div key={metric.label} className="soft-card p-5">
            <p className="text-sm text-slate-400">{metric.label}</p>
            <p className="mt-3 text-3xl font-display font-bold text-white">{metric.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-10 soft-card overflow-hidden">
        <table className="min-w-full text-left text-sm text-slate-200">
          <thead className="bg-slate-950/80 text-slate-400">
            <tr>
              <th className="px-6 py-4">User</th>
              <th className="px-6 py-4">Amount</th>
              <th className="px-6 py-4">Method</th>
              <th className="px-6 py-4">Status</th>
            </tr>
          </thead>
          <tbody>
            {adminPayments.map((payment) => (
              <tr key={payment.id} className="border-t border-slate-800">
                <td className="px-6 py-4">{payment.user}</td>
                <td className="px-6 py-4">{payment.amount}</td>
                <td className="px-6 py-4">{payment.method}</td>
                <td className="px-6 py-4">
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-semibold ${
                      payment.status === 'Approved'
                        ? 'bg-emerald-500/10 text-emerald-300'
                        : 'bg-amber-500/10 text-amber-300'
                    }`}
                  >
                    {payment.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
