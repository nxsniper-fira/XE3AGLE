export function applyFilters(trades,filters){return trades.filter(t=>Object.entries(filters||{}).every(([k,v])=>!v||String(t[k]??'').toLowerCase().includes(String(v).toLowerCase())))}
