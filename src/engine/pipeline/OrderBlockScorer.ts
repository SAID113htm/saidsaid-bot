import { Candle } from '../../smartmoney/SmartMoney';

export class OrderBlockScorer {
  evaluate(candles: Candle[], maxScore: number) {
    if (candles.length < 20) {
      return { passed: false, score: 0, maxScore, direction: 'NEUTRAL', reasons: ['بيانات'], hardReject: null };
    }
    return { passed: true, score: maxScore * 0.8, maxScore, direction: 'BULLISH', reasons: ['OBs'], hardReject: null };
  }
}
