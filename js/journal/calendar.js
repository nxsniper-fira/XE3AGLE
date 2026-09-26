export function monthMap(trades){const out={};for(const t of trades){const d=(t.date||'').slice(0,10);if(d)out[d]=(out[d]||0)+(Number(t.resultPL)||0)}return out}
