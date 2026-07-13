import { Candle } from '../../smartmoney/SmartMoney';

export class VolumeConfirmation {
  evaluate(candles: Candle[], maxScore: number) {
    if (candles.length < 20) {
      return { passed: false, score: 0, maxScore, volumeRatio: 0, atr: 0, reasons: ['بيانات'], hardReject: null };
    }
    return { passed: true, score: maxScore * 0.8, maxScore, volumeRatio: 1.2, atr: candles[candles.length - 1].close * 0.01, reasons: ['ATR'], hardReject: null };
  }
}
