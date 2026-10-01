export type RiskGuard = {
  label: string;
  status: 'pass' | 'warn' | 'block';
  value: string;
};

export function evaluateRisk({
  dailyLoss,
  riskPerTrade,
  maxDailyLoss,
  maxTradesPerDay,
  tradesToday,
}: {
  dailyLoss: number;
  riskPerTrade: number;
  maxDailyLoss: number;
  maxTradesPerDay: number;
  tradesToday: number;
}): RiskGuard[] {
  const risks: RiskGuard[] = [
    {
      label: 'Risk per trade',
      status: riskPerTrade <= 0.5 ? 'pass' : 'block',
      value: `${riskPerTrade.toFixed(2)}%`,
    },
    {
      label: 'Daily loss cap',
      status: dailyLoss <= maxDailyLoss ? 'pass' : 'block',
      value: `${dailyLoss.toFixed(2)}% / ${maxDailyLoss.toFixed(2)}%`,
    },
    {
      label: 'Trades today',
      status: tradesToday < maxTradesPerDay ? 'pass' : 'warn',
      value: `${tradesToday} / ${maxTradesPerDay}`,
    },
  ];

  return risks;
}

export function getTradeApprovalStatus(risk: ReturnType<typeof evaluateRisk>) {
  return risk.every((check) => check.status !== 'block') ? 'APPROVED' : 'WAIT';
}
