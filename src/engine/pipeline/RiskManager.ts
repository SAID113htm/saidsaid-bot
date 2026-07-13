import { Candle } from '../../smartmoney/SmartMoney';

export class RiskManager {
  evaluate(candles: Candle[], direction: string, liquidityLevel: number, obLevel: number, accountBalance: number = 10000, riskPercent: number = 1.0) {
    const cp = candles[candles.length - 1].close;
    const entry = cp;
    const stopLoss = direction === 'BUY' ? cp * 0.99 : cp * 1.01;
    const takeProfit1 = direction === 'BUY' ? cp * 1.02 : cp * 0.98;
    const riskReward = 2.0;
    const lotSize = 0.1;
    
    if (direction === 'NEUTRAL') {
      return { passed: false, entry, stopLoss, takeProfit1, riskReward, lotSize, reasons: [], hardReject: 'محايد' };
    }
    return { passed: true, entry, stopLoss, takeProfit1, riskReward, lotSize, reasons: ['Entry', 'SL', 'TP1'], hardReject: null };
  }
}
