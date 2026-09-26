/** Expectancy is average R per trade (win rate × avg win R + loss rate × avg loss R). */
export function expectancy(stats) {
  if (!stats || !Number.isFinite(Number(stats.avgR))) return 0;
  return Number(stats.avgR);
}
