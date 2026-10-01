import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    ok: true,
    message: 'Accounts API ready',
    accounts: [
      {
        id: 'acct_001',
        userId: 'user_001',
        name: 'Primary Prop',
        balance: '12500.00',
        accountType: 'Live',
        status: 'active',
      },
    ],
  });
}

export async function POST(request: Request) {
  const body = await request.json();

  return NextResponse.json({
    ok: true,
    message: 'Account created',
    account: {
      ...body,
      id: `acct_${Date.now()}`,
      status: 'active',
      createdAt: new Date().toISOString(),
    },
  });
}
