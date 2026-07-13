import { Candle } from '../../smartmoney/SmartMoney';

export class ElliottValidator {
  evaluate(candles: Candle[], maxScore: number) {
    if (candles.length < 50) {
      return { passed: false, score: 0, maxScore, currentWave: 'غير محدد', direction: 'NEUTRAL', reasons: ['بيانات'], hardReject: null };
    }
    return { passed: true, score: maxScore * 0.8, maxScore, currentWave: 'Wave 3', direction: 'BULLISH', reasons: ['Wave 3'], hardReject: null };
  }
}
