import { YahooFinanceClient } from '../providers/YahooFinanceClient';
import { SmartMoneyAnalyzer, Candle } from '../smartmoney/SmartMoney';
import { PriceProvider, MarketData } from '../data/PriceProvider';
import { NewsAnalyzer } from '../news/NewsAnalyzer';
import { DecisionEngine, TradingSignal } from '../strategy/DecisionEngine';
import { RiskManager } from '../risk/RiskManager';
import { BarChartAnalyzer } from './BarChartAnalyzer';

export interface AnalysisResult {
  pair: string;
  price: number;
  trend: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  strength: number;
  support: number[];
  resistance: number[];
  rsi: number;
  recommendation: string;
  timestamp: Date;
  smartMoney?: any;
  institutional?: TradingSignal;
}

export class Analyzer {
  private client: YahooFinanceClient;
  private smartMoneyAnalyzer: SmartMoneyAnalyzer;
  private priceProvider: PriceProvider;
  private newsAnalyzer: NewsAnalyzer;
  private decisionEngine: DecisionEngine;
  private riskManager: RiskManager;
  private barChartAnalyzer: BarChartAnalyzer;

  constructor() {
    this.client = new YahooFinanceClient();
    this.smartMoneyAnalyzer = new SmartMoneyAnalyzer();
    this.priceProvider = new PriceProvider('');
    this.newsAnalyzer = new NewsAnalyzer();
    this.decisionEngine = new DecisionEngine();
    this.riskManager = new RiskManager();
    this.barChartAnalyzer = new BarChartAnalyzer();
  }

  async analyze(pair: string): Promise<AnalysisResult> {
    console.log('🔍 Starting analysis for:', pair);
    
    const data = await this.client.getTimeSeries(pair, '1day', 100);
    const quote = await this.client.getQuote(pair);

    const price = parseFloat(quote.close);
    const candles = data.values;

    const formattedCandles: Candle[] = candles.map((c: any) => ({
      time: c.datetime,
      open: parseFloat(c.open),
      high: parseFloat(c.high),
      low: parseFloat(c.low),
      close: parseFloat(c.close),
      volume: parseFloat(c.volume),
    }));

    const rsi = this.calculateRSI(candles);
    const trend = this.determineTrend(candles);
    const support = this.calculateSupport(candles);
    const resistance = this.calculateResistance(candles);
    const smartMoney = this.smartMoneyAnalyzer.analyze(formattedCandles);

    return {
      pair: pair.toUpperCase(),
      price,
      trend,
      strength: this.calculateStrength(rsi),
      support,
      resistance,
      rsi: Math.round(rsi * 100) / 100,
      recommendation: this.getRecommendation(trend, rsi, smartMoney),
      timestamp: new Date(),
      smartMoney,
    };
  }

  async getInstitutionalAnalysis(pair: string): Promise<string> {
    try {
      console.log('️ Starting institutional analysis for:', pair);
      
      const marketData = await this.priceProvider.getFullMarketData(pair);
      const candles = marketData.candles.D1.map((c: any) => ({
        time: c.time, open: c.open, high: c.high, low: c.low, close: c.close, volume: c.volume,
      }));
      
      const smartMoney = this.smartMoneyAnalyzer.analyze(candles);
      const news = await this.newsAnalyzer.getHighImpactNews(pair);
      const signal = this.decisionEngine.analyze(marketData, smartMoney, news);
      const barPatterns = this.barChartAnalyzer.analyze(candles);

      return this.formatInstitutionalReport(signal, marketData, news, barPatterns);
    } catch (error: any) {
      console.error('❌ Institutional analysis error:', error);
      return '❌ خطأ في التحليل المؤسسي: ' + error.message;
    }
  }

  calculateRisk(params: {
    symbol: string;
    entry: number;
    stopLoss: number;
    takeProfit: number;
    riskPercent: number;
    accountBalance: number;
  }): string {
    const direction: 'BUY' | 'SELL' = params.entry > params.stopLoss ? 'BUY' : 'SELL';

    const calculation = this.riskManager.calculatePosition({
      ...params,
      direction,
    });

    const validation = this.riskManager.validateRisk({
      riskPercent: params.riskPercent,
      riskRewardRatio: calculation.riskRewardRatio,
      confidence: 'MEDIUM',
    });

    let text = '🧮 **حاسبة المخاطرة الاحترافية**\n\n';
    text += '💱 **الزوج:** ' + calculation.symbol + '\n';
    text += '📈 **الاتجاه:** ' + (calculation.direction === 'BUY' ? 'شراء ' : 'بيع 🔴') + '\n\n';
    
    text += '💰 **تفاصيل الصفقة:**\n';
    text += '• الدخول: `' + calculation.entry.toFixed(5) + '`\n';
    text += '• وقف الخسارة: `' + calculation.stopLoss.toFixed(5) + '`\n';
    text += '• جني الربح: `' + calculation.takeProfit.toFixed(5) + '`\n\n';
    
    text += '💵 **إدارة المخاطر:**\n';
    text += '• رصيد الحساب: $' + calculation.accountBalance.toLocaleString() + '\n';
    text += '• نسبة المخاطرة: ' + calculation.riskPercent + '%\n';
    text += '• المبلغ المعرض للخطر: $' + calculation.riskAmount.toFixed(2) + '\n';
    text += '• **حجم الصفقة:** ' + calculation.positionSize + ' لوت\n';
    text += '• الربح المتوقع: $' + calculation.potentialProfit.toFixed(2) + '\n';
    text += '• **نسبة R:R:** 1:' + calculation.riskRewardRatio.toFixed(2) + '\n\n';

    if (calculation.riskRewardRatio < 2.0) {
      text += '⚠️ **تحذير:** نسبة R:R أقل من 1:2 - الصفقة غير مقبولة\n\n';
    }

    if (validation.warnings.length > 0) {
      text += '⚠️ **تحذيرات:**\n';
      validation.warnings.forEach(w => text += '• ' + w + '\n');
    } else {
      text += '✅ الصفقة ضمن معايير المخاطرة المقبولة';
    }

    return text;
  }

  formatAnalysis(result: AnalysisResult): string {
    const trendEmoji: any = {
      'BULLISH': '🟢',
      'BEARISH': '🔴',
      'NEUTRAL': '🟡'
    };

    let text = '';
    text += '📊 **تحليل ' + result.pair + '**\n\n';
    text += '💰 السعر الحالي: `' + result.price.toFixed(5) + '`\n\n';
    text += '📈 الاتجاه: ' + trendEmoji[result.trend] + ' ' + this.getTrendText(result.trend) + '\n';
    text += '💪 القوة: ' + result.strength + '%\n';
    text += ' RSI: ' + result.rsi + '\n\n';
    
    text += ' **مستويات الدعم:**\n';
    result.support.forEach((s: number, i: number) => {
      text += '   ' + (i + 1) + '. `' + s.toFixed(5) + '`\n';
    });
    text += '\n';
    
    text += '📈 **مستويات المقاومة:**\n';
    result.resistance.forEach((r: number, i: number) => {
      text += '   ' + (i + 1) + '. `' + r.toFixed(5) + '`\n';
    });
    text += '\n';
    
    if (result.smartMoney) {
      text += this.smartMoneyAnalyzer.formatSmartMoney(result.smartMoney);
      text += '\n';
    }
    
    text += '💡 **التوصية:** ' + result.recommendation + '\n\n';
    text += '⏰ ' + result.timestamp.toLocaleTimeString('ar-SA');

    return text;
  }

  private formatInstitutionalReport(signal: TradingSignal, marketData: MarketData, news: any[], barPatterns: any[]): string {
    const directionEmoji: any = {
      'STRONG_BUY': '🟢🟢 شراء قوي جداً',
      'BUY': '🟢 شراء',
      'NEUTRAL': ' محايد - انتظار',
      'SELL': '🔴 بيع',
      'STRONG_SELL': '🔴🔴 بيع قوي جداً',
    };

    let text = '️ **التحليل المؤسسي - ' + signal.symbol + '**\n\n';
    
    text += '━━━━━━━━━━━━━━━━━━━\n';
    text += '📊 **القرار:** ' + directionEmoji[signal.direction] + '\n';
    text += '💪 **القوة:** ' + (signal.score > 0 ? '+' : '') + signal.score + '/100\n';
    text += '🎯 **الثقة:** ' + signal.confidence + '%\n';
    text += '━━━━━━━━━━━━━━━━━━━\n\n';
    
    text += '📈 **تحليل الفريمات:**\n';
    text += '  ' + (signal.timeframeBreakdown.MN === 'BULLISH' ? '' : signal.timeframeBreakdown.MN === 'BEARISH' ? '🔴' : '🟡') + ' MN (شهري): ' + signal.timeframeBreakdown.MN + ' - الوزن 40%\n';
    text += '  ' + (signal.timeframeBreakdown.W1 === 'BULLISH' ? '🟢' : signal.timeframeBreakdown.W1 === 'BEARISH' ? '🔴' : '') + ' W1 (أسبوعي): ' + signal.timeframeBreakdown.W1 + ' - الوزن 30%\n';
    text += '  ' + (signal.timeframeBreakdown.D1 === 'BULLISH' ? '🟢' : signal.timeframeBreakdown.D1 === 'BEARISH' ? '🔴' : '') + ' D1 (يومي): ' + signal.timeframeBreakdown.D1 + ' - الوزن 20%\n';
    text += '  ' + (signal.timeframeBreakdown.H4 === 'BULLISH' ? '🟢' : signal.timeframeBreakdown.H4 === 'BEARISH' ? '🔴' : '') + ' H4: ' + signal.timeframeBreakdown.H4 + ' - الوزن 10%\n';
    text += '  ' + (signal.timeframeBreakdown.H1 === 'BULLISH' ? '🟢' : signal.timeframeBreakdown.H1 === 'BEARISH' ? '🔴' : '🟡') + ' H1: ' + signal.timeframeBreakdown.H1 + '\n\n';

    text += '🔍 **Smart Money Concepts:**\n';
    signal.smcDetails.forEach((detail: string) => {
      text += '  ' + detail + '\n';
    });
    text += '\n';

    if (barPatterns.length > 0) {
      text += this.barChartAnalyzer.formatPatterns(barPatterns);
      text += '\n';
    }

    if (signal.direction !== 'NEUTRAL') {
      text += ' **نقاط الدخول:**\n';
      text += '• الدخول: `' + signal.entry.toFixed(5) + '`\n';
      text += '• وقف الخسارة: `' + signal.stopLoss.toFixed(5) + '`\n';
      text += '• جني الربح 1: `' + signal.takeProfit1.toFixed(5) + '`\n';
      text += '• جني الربح 2: `' + signal.takeProfit2.toFixed(5) + '`\n';
      text += '• جني الربح 3: `' + signal.takeProfit3.toFixed(5) + '`\n\n';
      
      text += '📊 **نسبة R:R:** 1:' + signal.riskRewardRatio.toFixed(2) + '\n';
      if (signal.riskRewardRatio < 2.0) {
        text += '❌ **تحذير:** R:R أقل من 1:2 - الصفقة غير مقبولة\n\n';
      }
    }

    if (signal.warnings.length > 0) {
      text += '⚠️ **تحذيرات:**\n';
      signal.warnings.forEach((w: string) => text += '  ' + w + '\n');
      text += '\n';
    }

    if (news.length > 0) {
      text += this.newsAnalyzer.formatNewsForSymbol(signal.symbol, news);
    }
    
    text += '\n⏰ ' + signal.timestamp.toLocaleString('ar-SA');

    return text;
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

  private determineTrend(candles: any[]): 'BULLISH' | 'BEARISH' | 'NEUTRAL' {
    if (candles.length < 20) return 'NEUTRAL';
    const recent = candles.slice(0, 20);
    const older = candles.slice(20, 40);
    const recentAvg = recent.reduce((sum: number, c: any) => sum + parseFloat(c.close), 0) / recent.length;
    const olderAvg = older.reduce((sum: number, c: any) => sum + parseFloat(c.close), 0) / older.length;
    const change = ((recentAvg - olderAvg) / olderAvg) * 100;
    if (change > 2) return 'BULLISH';
    if (change < -2) return 'BEARISH';
    return 'NEUTRAL';
  }

  private calculateSupport(candles: any[]): number[] {
    const lows = candles.slice(0, 30).map((c: any) => parseFloat(c.low));
    const min = Math.min(...lows);
    return [min, min * 0.998, min * 0.996];
  }

  private calculateResistance(candles: any[]): number[] {
    const highs = candles.slice(0, 30).map((c: any) => parseFloat(c.high));
    const max = Math.max(...highs);
    return [max, max * 1.002, max * 1.004];
  }

  private calculateStrength(rsi: number): number {
    return Math.round(Math.abs(50 - rsi) * 2);
  }

  private getRecommendation(trend: string, rsi: number, smartMoney: any): string {
    let score = 0;
    if (trend === 'BULLISH') score += 2;
    if (trend === 'BEARISH') score -= 2;
    if (rsi < 30) score += 1;
    if (rsi > 70) score -= 1;
    if (smartMoney) {
      if (smartMoney.structure === 'BULLISH') score += 2;
      if (smartMoney.structure === 'BEARISH') score -= 2;
      if (smartMoney.bos?.bullish) score += 1;
      if (smartMoney.bos?.bearish) score -= 1;
    }
    if (score >= 5) return 'شراء قوي ';
    if (score >= 3) return 'شراء 📈';
    if (score <= -5) return 'بيع قوي 🔴';
    if (score <= -3) return 'بيع 📉';
    return 'انتظار ';
  }

  private getTrendText(trend: string): string {
    const texts: any = { 'BULLISH': 'صاعد', 'BEARISH': 'هابط', 'NEUTRAL': 'جانبي' };
    return texts[trend];
  }
}