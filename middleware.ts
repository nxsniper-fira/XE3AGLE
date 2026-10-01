import { NextResponse } from 'next/server';
import { adminPayments } from '@/lib/demo-data';

export async function GET() {
  return NextResponse.json({ ok: true, payments: adminPayments });
}

export async function POST(request: Request) {
  const body = await request.json();

  return NextResponse.json({
    ok: true,
    message: 'Payment submitted',
    payment: {
      id: `pay_${Date.now()}`,
      ...body,
      status: 'Pending',
    },
  });
}
