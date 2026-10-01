'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { SessionUser } from '@/lib/auth';

export default function AdminPage() {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSession = async () => {
      const response = await fetch('/api/auth/session');
      const data = await response.json();

      if (!data.ok) {
        router.push('/login');
        return;
      }

      if (data.user.role !== 'admin') {
        router.push('/dashboard');
        return;
      }

      setUser(data.user);
      setLoading(false);
    };

    fetchSession();
  }, [router]);

  useEffect(() => {
    const fetchPayments = async () => {
      const response = await fetch('/api/admin/payments');
      const data = await response.json();
      if (data.ok) {
        setPayments(data.payments);
      }
    };

    if (user) {
      fetchPayments();
    }
  }, [user]);

  if (loading) return <div className="container-screen py-20">Loading...</div>;

  if (!user) return null;

  return (
    <main className="container-screen py-20">
      <div className="mb-8">
        <h1 className="section-title">Admin Dashboard</h1>
        <p className="mt-2 text-slate-400">Welcome, {user.name}</p>
      </div>

      <div className="space-y-8">
        <section className="soft-card p-6">
          <h2 className="text-2xl font-display font-bold">Payments</h2>
          <div className="mt-4 space-y-4">
            {payments.length === 0 ? (
              <p className="text-slate-400">No payments yet</p>
            ) : (
              payments.map((payment: any) => (
                <div key={payment.id} className="border-l-4 border-[#ff7a1a] pl-4 py-2">
                  <p className="font-semibold">{payment.amount}</p>
                  <p className="text-sm text-slate-400">{payment.status}</p>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
