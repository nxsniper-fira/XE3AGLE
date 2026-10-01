import { adminPayments } from '@/lib/demo-data';

export default function PaymentsAdminPage() {
  return (
    <main className="container-screen py-16">
      <div className="mb-8">
        <p className="text-sm uppercase tracking-[0.2em] text-[#ffb27e]">Admin</p>
        <h1 className="mt-3 text-4xl font-display font-bold text-white">Payment approval queue</h1>
      </div>

      <div className="soft-card overflow-hidden">
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
            {adminPayments.map((entry) => (
              <tr key={entry.id} className="border-t border-slate-800">
                <td className="px-6 py-4">{entry.user}</td>
                <td className="px-6 py-4">{entry.amount}</td>
                <td className="px-6 py-4">{entry.method}</td>
                <td className="px-6 py-4">
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-semibold ${
                      entry.status === 'Approved'
                        ? 'bg-emerald-500/10 text-emerald-300'
                        : 'bg-amber-500/10 text-amber-300'
                    }`}
                  >
                    {entry.status}
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
