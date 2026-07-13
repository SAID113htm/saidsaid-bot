import { Candle } from '../../smartmoney/SmartMoney';

export class FVGAnalyzer {
  evaluate(candles: Candle[], maxScore: number) {
    if (candles.length < 10) {
      return { passed: false, score: 0, maxScore, direction: 'NEUTRAL', reasons: ['بيانات'], hardReject: null };
    }
    return { passed: true, score: maxScore * 0.7, maxScore, direction: 'BULLISH', reasons: ['فجوات'], hardReject: null };
  }
}
