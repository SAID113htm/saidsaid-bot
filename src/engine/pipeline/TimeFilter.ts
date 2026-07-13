import { Candle } from '../../smartmoney/SmartMoney';

export class TimeFilter {
  evaluate(candles: Candle[], maxScore: number) {
    const now = new Date();
    const hour = now.getUTCHours();
    const day = now.getUTCDay();
    
    if (day === 0 || day === 6) {
      return { passed: false, score: 0, maxScore, killZone: null, reasons: ['مغلق'], hardReject: 'مغلق' };
    }
    
    if (hour >= 7 && hour < 10) {
      return { passed: true, score: maxScore, maxScore, killZone: 'London', reasons: ['London'], hardReject: null };
    }
    if (hour >= 12 && hour < 15) {
      return { passed: true, score: maxScore, maxScore, killZone: 'NY', reasons: ['NY'], hardReject: null };
    }
    
    return { passed: true, score: maxScore * 0.5, maxScore, killZone: null, reasons: ['خارج'], hardReject: null };
  }
}
