import { Candle } from '../../smartmoney/SmartMoney';

export enum LiquidityType {
  BSL = 'BSL',
  SSL = 'SSL',
  NONE = 'NONE'
}

export class LiquiditySweep {
  evaluate(candles: Candle[], maxScore: number) {
    if (candles.length < 30) {
      return { type: LiquidityType.NONE, passed: false, score: 0, maxScore, level: 0, reasons: ['بيانات'], hardReject: null };
    }
    const recent = candles.slice(-20);
    const highs = recent.map(c => c.high).slice(0, -3);
    const lows = recent.map(c => c.low).slice(0, -3);
    const maxHigh = Math.max(...highs);
    const minLow = Math.min(...lows);
    const last = candles.slice(-3);
    
    if (last.some(c => c.high > maxHigh)) {
      return { type: LiquidityType.BSL, passed: true, score: maxScore * 0.8, maxScore, level: maxHigh, reasons: ['BSL'], hardReject: null };
    }
    if (last.some(c => c.low < minLow)) {
      return { type: LiquidityType.SSL, passed: true, score: maxScore * 0.8, maxScore, level: minLow, reasons: ['SSL'], hardReject: null };
    }
    return { type: LiquidityType.NONE, passed: false, score: 0, maxScore, level: 0, reasons: ['لا'], hardReject: null };
  }
}
