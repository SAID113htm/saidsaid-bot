import { YahooFinanceClient } from '../providers/YahooFinanceClient';
import { SmartMoneyAnalyzer } from '../smartmoney/SmartMoney';
import { DecisionEngine } from '../strategy/DecisionEngine';
import { NewsRSSProvider } from '../data/NewsRSSProvider';

interface Trade {
  date: string;
  symbol: string;
  direction: 'BUY' | 'SELL';
  entry: number;
  stopLoss: number;
  takeProfit: number;
  exit: number;
  profit: number;
  confidence: number;
  result: 'WIN' | 'LOSS' | 'BREAKEVEN';
}

interface BacktestReport {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  totalProfit: number;
  averageProfit: number;
  maxDrawdown: number;
  profitFactor: number;
  sharpeRatio: number;
  trades: Trade[];
}

export class Backtester {
  private client: YahooFinanceClient;
  private smartMoney: SmartMoneyAnalyzer;
  private decisionEngine: DecisionEngine;
  private newsProvider: NewsRSSProvider;

  constructor() {
    this.client = new YahooFinanceClient();
    this.smartMoney = new SmartMoneyAnalyzer();
    this.decisionEngine = new DecisionEngine();
    this.newsProvider = new NewsRSSProvider();
  }

  async runBacktest(
    symbol: string,
    days: number = 90,
    initialBalance: number = 1000,
    riskPerTrade: number = 1
  ): Promise<BacktestReport> {
    console.log(`🔍 Starting backtest for ${symbol} (${days} days)`);
    
    const data = await this.client.getTimeSeries(symbol, '1day', days + 50);
    const candles = data.values;
    
    const trades: Trade[] = [];
    let balance = initialBalance;
    let peakBalance = initialBalance;
    let maxDrawdown = 0;

    // تحليل كل شمعة
    for (let i = 50; i < candles.length - 1; i++) {
      const historicalCandles = candles.slice(0, i);
      const currentCandle = candles[i];
      const nextCandle = candles[i + 1];

      // تحليل SMC
      const smcAnalysis = this.smartMoney.analyze(
        historicalCandles.map((c: any) => ({
          time: c.datetime,
          open: parseFloat(c.open),
          high: parseFloat(c.high),
          low: parseFloat(c.low),
          close: parseFloat(c.close),
          volume: parseFloat(c.volume),
        }))
      );

      // تحليل الاتجاه
      const trend = this.determineTrend(historicalCandles.slice(-20));
      
      // حساب RSI
      const rsi = this.calculateRSI(historicalCandles.slice(-15));

      // قرار التداول
      let score = 0;
      if (trend === 'BULLISH') score += 2;
      if (trend === 'BEARISH') score -= 2;
      if (rsi < 30) score += 1;
      if (rsi > 70) score -= 1;
      if (smcAnalysis.structure === 'BULLISH') score += 2;
      if (smcAnalysis.structure === 'BEARISH') score -= 2;
      if (smcAnalysis.bos?.bullish) score += 1;
      if (smcAnalysis.bos?.bearish) score -= 1;

      // فتح صفقة إذا كانت الإشارة قوية
      if (Math.abs(score) >= 4) {
        const direction = score > 0 ? 'BUY' : 'SELL';
        const entry = parseFloat(currentCandle.close);
        
        // حساب ATR للـ SL و TP
        const atr = this.calculateATR(historicalCandles.slice(-14));
        const stopLoss = direction === 'BUY' 
          ? entry - (atr * 1.5) 
          : entry + (atr * 1.5);
        const takeProfit = direction === 'BUY'
          ? entry + (atr * 3)
          : entry - (atr * 3);

        // محاكاة النتيجة
        const nextOpen = parseFloat(nextCandle.open);
        const nextHigh = parseFloat(nextCandle.high);
        const nextLow = parseFloat(nextCandle.low);

        let exit = nextOpen;
        let result: 'WIN' | 'LOSS' | 'BREAKEVEN' = 'BREAKEVEN';
        let profit = 0;

        if (direction === 'BUY') {
          if (nextLow <= stopLoss) {
            exit = stopLoss;
            result = 'LOSS';
            profit = -(riskPerTrade / 100) * balance;
          } else if (nextHigh >= takeProfit) {
            exit = takeProfit;
            result = 'WIN';
            profit = (riskPerTrade / 100) * balance * 2;
          }
        } else {
          if (nextHigh >= stopLoss) {
            exit = stopLoss;
            result = 'LOSS';
            profit = -(riskPerTrade / 100) * balance;
          } else if (nextLow <= takeProfit) {
            exit = takeProfit;
            result = 'WIN';
            profit = (riskPerTrade / 100) * balance * 2;
          }
        }

        balance += profit;
        if (balance > peakBalance) peakBalance = balance;
        const drawdown = ((peakBalance - balance) / peakBalance) * 100;
        if (drawdown > maxDrawdown) maxDrawdown = drawdown;

        trades.push({
          date: currentCandle.datetime,
          symbol,
          direction,
          entry,
          stopLoss,
          takeProfit,
          exit,
          profit,
          confidence: Math.abs(score) * 10,
          result,
        });
      }
    }

    const winningTrades = trades.filter(t => t.result === 'WIN').length;
    const losingTrades = trades.filter(t => t.result === 'LOSS').length;
    const totalProfit = trades.reduce((sum, t) => sum + t.profit, 0);
    const grossProfit = trades.filter(t => t.profit > 0).reduce((sum, t) => sum + t.profit, 0);
    const grossLoss = Math.abs(trades.filter(t => t.profit < 0).reduce((sum, t) => sum + t.profit, 0));

    return {
      totalTrades: trades.length,
      winningTrades,
      losingTrades,
      winRate: (winningTrades / trades.length) * 100,
      totalProfit,
      averageProfit: totalProfit / trades.length,
      maxDrawdown,
      profitFactor: grossLoss > 0 ? grossProfit / grossLoss : grossProfit,
      sharpeRatio: this.calculateSharpeRatio(trades),
      trades,
    };
  }

  private determineTrend(candles: any[]): 'BULLISH' | 'BEARISH' | 'NEUTRAL' {
    if (candles.length < 20) return 'NEUTRAL';
    const recent = candles.slice(0, 10);
    const older = candles.slice(10, 20);
    const recentAvg = recent.reduce((sum: number, c: any) => sum + parseFloat(c.close), 0) / recent.length;
    const olderAvg = older.reduce((sum: number, c: any) => sum + parseFloat(c.close), 0) / older.length;
    const change = ((recentAvg - olderAvg) / olderAvg) * 100;
    if (change > 2) return 'BULLISH';
    if (change < -2) return 'BEARISH';
    return 'NEUTRAL';
  }

  private calculateRSI(candles: any[], period: number = 14): number {
    if (candles.length < period + 1) return 50;
    let gains = 0, losses = 0;
    for (let i = 1; i <= period; i++) {
      const change = parseFloat(candles[i - 1].close) - parseFloat(candles[i].close);
      if (change > 0) gains += change;
      else losses += Math.abs(change);
    }
    const avgGain = gains / period;
    const avgLoss = losses / period;
    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  }

  private calculateATR(candles: any[], period: number = 14): number {
    if (candles.length < period) return 0.001;
    const trs = [];
    for (let i = 1; i <= period; i++) {
      const c = candles[i - 1];
      const prev = candles[i];
      const tr = Math.max(
        parseFloat(c.high) - parseFloat(c.low),
        Math.abs(parseFloat(c.high) - parseFloat(prev.close)),
        Math.abs(parseFloat(c.low) - parseFloat(prev.close))
      );
      trs.push(tr);
    }
    return trs.reduce((s, t) => s + t, 0) / period;
  }

  private calculateSharpeRatio(trades: Trade[]): number {
    if (trades.length < 2) return 0;
    const returns = trades.map(t => t.profit);
    const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
    const stdDev = Math.sqrt(variance);
    return stdDev > 0 ? avgReturn / stdDev : 0;
  }
}

// تشغيل الاختبار
async function main() {
  const backtester = new Backtester();
  
  console.log('🧪 Running Backtest on EUR/USD (90 days)...');
  const report = await backtester.runBacktest('EUR/USD', 90, 1000, 1);
  
  console.log('\n📊 Backtest Report:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Total Trades: ${report.totalTrades}`);
  console.log(`Winning Trades: ${report.winningTrades}`);
  console.log(`Losing Trades: ${report.losingTrades}`);
  console.log(`Win Rate: ${report.winRate.toFixed(2)}%`);
  console.log(`Total Profit: $${report.totalProfit.toFixed(2)}`);
  console.log(`Average Profit: $${report.averageProfit.toFixed(2)}`);
  console.log(`Max Drawdown: ${report.maxDrawdown.toFixed(2)}%`);
  console.log(`Profit Factor: ${report.profitFactor.toFixed(2)}`);
  console.log(`Sharpe Ratio: ${report.sharpeRatio.toFixed(2)}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  console.log('\n📝 Last 10 Trades:');
  report.trades.slice(-10).forEach((trade, i) => {
    const emoji = trade.result === 'WIN' ? '✅' : trade.result === 'LOSS' ? '❌' : '⚪';
    console.log(`${emoji} ${trade.date} | ${trade.direction} | Entry: ${trade.entry.toFixed(5)} | Profit: $${trade.profit.toFixed(2)}`);
  });
}

main().catch(console.error);