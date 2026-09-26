/** Pure analytics derived only from recorded, closed trades. */
export function statistics(trades = []) {
  const rows = (Array.isArray(trades) ? trades : []).filter(t => t && t.result && String(t.tradeType || '').toLowerCase() !== 'live');
  const rs = rows.map(t => Number(t.resultR ?? t.rMultiple ?? 0)).filter(Number.isFinite);
  const wins = rows.filter((t,i) => String(t.result).toUpperCase()==='WIN' || (rs[i] ?? 0)>0);
  const losses = rows.filter((t,i) => String(t.result).toUpperCase()==='LOSS' || (rs[i] ?? 0)<0);
  const totalR = rs.reduce((a,b)=>a+b,0);
  const avgR = rs.length ? totalR/rs.length : 0;
  const winR = rows.map(t=>Number(t.resultR ?? t.rMultiple ?? 0)).filter(v=>v>0);
  const lossR = rows.map(t=>Number(t.resultR ?? t.rMultiple ?? 0)).filter(v=>v<0);
  const grossWin = winR.reduce((a,b)=>a+b,0);
  const grossLoss = Math.abs(lossR.reduce((a,b)=>a+b,0));
  const pls = rows.map(t=>Number(t.resultPL ?? t.pnl ?? 0)).filter(Number.isFinite);
  return { totalTrades: rows.length, wins: wins.length, losses: losses.length,
    breakeven: Math.max(0, rows.length-wins.length-losses.length),
    winRate: rows.length ? wins.length/rows.length*100 : 0,
    totalR, avgR, averageWinnerR: winR.length?grossWin/winR.length:0,
    averageLoserR: lossR.length?lossR.reduce((a,b)=>a+b,0)/lossR.length:0,
    profitFactor: grossLoss ? grossWin/grossLoss : (grossWin?Infinity:0),
    totalPL: pls.reduce((a,b)=>a+b,0), largestWinR: winR.length?Math.max(...winR):0,
    largestLossR: lossR.length?Math.min(...lossR):0 };
}
