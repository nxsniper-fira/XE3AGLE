import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    ok: true,
    payments: [
      { id: 'p_1', user: 'Marta H.', amount: 49, method: 'Telebirr', status: 'pending' },
      { id: 'p_2', user: 'Jonas K.', amount: 99, method: 'CBE', status: 'pending' },
      { id: 'p_3', user: 'N. Dawit', amount: 49, method: 'Bank', status: 'approved' },
    ],
  });
}

export async function POST(request: Request) {
  const payload = await request.json();

  return NextResponse.json({
    ok: true,
    message: 'Payment review submitted',
    payment: {
      ...payload,
      id: `pay_${Date.now()}`,
      status: 'pending',
    },
  });
}
