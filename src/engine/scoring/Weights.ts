export const DEFAULT_WEIGHTS = {
  timeFilter: 15,
  htfBias: 15,
  liquiditySweep: 20,
  marketStructure: 15,
  elliottWave: 10,
  fvg: 10,
  orderBlock: 10,
  volume: 5,
  riskManagement: 0,
  total: 100
};

export function getDecisionFromScore(score: number) {
  if (score >= 90) return { status: 'STRONG_BUY', text: 'ممتازة' };
  if (score >= 80) return { status: 'BUY', text: 'جيدة' };
  if (score >= 70) return { status: 'WATCHLIST', text: 'راقب' };
  if (score >= 60) return { status: 'WAIT', text: 'انتظر' };
  return { status: 'REJECT', text: 'مرفوضة' };
}
