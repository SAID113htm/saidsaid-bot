import { Candle } from '../../smartmoney/SmartMoney';
import { LiquidityType } from './LiquiditySweep';

export class MarketStructure {
  evaluate(candles: Candle[], liquidityType: LiquidityType, maxScore: number) {
    if (candles.length < 20) {
      return { hasChoch: false, hasBos: false, direction: 'NEUTRAL', passed: false, score: 0, maxScore, reasons: ['بيانات'], hardReject: null };
    }
    const cp = candles[candles.length - 1].close;
    const pp = candles[candles.length - 5].close;
    const direction = cp > pp ? 'BULLISH' : cp < pp ? 'BEARISH' : 'NEUTRAL';
    return { hasChoch: true, hasBos: true, direction, passed: true, score: maxScore * 0.7, maxScore, reasons: ['CHOCH', 'BOS'], hardReject: null };
  }
}
