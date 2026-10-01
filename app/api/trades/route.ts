import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    ok: true,
    message: 'Trades API ready',
    trades: [
      {
        id: 'trade_1001',
        accountId: 'acct_001',
        symbol: 'EURUSD',
        direction: 'LONG',
        riskAmount: '0.35',
        grade: 'A',
        status: 'open',
      },
      {
        id: 'trade_1002',
        accountId: 'acct_001',
        symbol: 'XAUUSD',
        direction: 'SHORT',
        riskAmount: '0.4',
        grade: 'B',
        status: 'closed',
      },
    ],
  });
}

export async function POST(request: Request) {
  const body = await request.json();

  return NextResponse.json({
    ok: true,
    message: 'Trade recorded',
    trade: {
      ...body,
      id: `trade_${Date.now()}`,
      status: 'open',
    },
  });
}
