export function chartData(trades){let total=0;return trades.map(t=>{total+=Number(t.resultPL)||0;return {date:t.date,value:total}})}
