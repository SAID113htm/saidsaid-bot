import { Candle } from '../../smartmoney/SmartMoney';

export enum MarketBias {
  BULLISH = 'BULLISH',
  BEARISH = 'BEARISH',
  RANGE = 'RANGE'
}

export class HTFBias {
  evaluate(candles: Candle[], maxScore: number) {
    const tfs = {
      MN: this.analyze(candles, 30),
      W1: this.analyze(candles, 13),
      D1: this.analyze(candles, 30),
      H4: this.analyze(candles, 20),
      H1: this.analyze(candles, 14)
    };
    const values = Object.values(tfs);
    const bullish = values.filter(v => v === MarketBias.BULLISH).length;
    const bearish = values.filter(v => v === MarketBias.BEARISH).length;
    const range = values.filter(v => v === MarketBias.RANGE).length;
    
    if (range >= 3) {
      return { bias: MarketBias.RANGE, passed: false, score: 0, maxScore, reasons: ['عرضي'], hardReject: 'عرضي' };
    }
    if (bullish > bearish) {
      return { bias: MarketBias.BULLISH, passed: true, score: (bullish / values.length) * maxScore, maxScore, reasons: ['صاعد'], hardReject: null };
    }
    if (bearish > bullish) {
      return { bias: MarketBias.BEARISH, passed: true, score: (bearish / values.length) * maxScore, maxScore, reasons: ['هابط'], hardReject: null };
    }
    return { bias: MarketBias.RANGE, passed: false, score: maxScore * 0.3, maxScore, reasons: ['غير واضح'], hardReject: null };
  }

  private analyze(candles: Candle[], period: number) {
    if (candles.length < period) return MarketBias.RANGE;
    const recent = candles.slice(-period);
    const first = recent[0].close;
    const last = recent[recent.length - 1].close;
    const change = ((last - first) / first) * 100;
    if (change > 2) return MarketBias.BULLISH;
    if (change < -2) return MarketBias.BEARISH;
    return MarketBias.RANGE;
  }
}
