import { YahooFinanceClient } from '../providers/YahooFinanceClient';
import { SmartMoneyAnalyzer, Candle } from '../smartmoney/SmartMoney';
import { NewsRSSProvider, NewsItem } from '../data/NewsRSSProvider';

export interface TradingSignal {
  symbol: string;
  direction: 'BUY' | 'SELL';
  confidence: number;
  entry: number;
  stopLoss: number;
  takeProfit1: number;
  takeProfit2: number;
  riskRewardRatio: number;
  reasons: string[];
  timeframe: string;
  timestamp: Date;
  status: 'ACTIVE' | 'EXPIRED' | 'TRIGGERED';
}

export class SignalEngine {
  private yahoo: YahooFinanceClient;
  private smc: SmartMoneyAnalyzer;
  private news: NewsRSSProvider;

  private readonly MIN_CONFIDENCE = 75;
  private readonly MIN_RR = 2.0;

  constructor() {
    this.yahoo = new YahooFinanceClient();
    this.smc = new SmartMoneyAnalyzer();
    this.news = new NewsRSSProvider();
  }

  async generateSignals(): Promise<TradingSignal[]> {
    const symbols = [
      'EUR/USD', 'GBP/USD', 'USD/JPY', 'AUD/USD', 'USD/CAD',
      'XAU/USD', 'XAG/USD',
      'BTC/USD', 'ETH/USD',
      'WTI/USD', 'BRENT/USD',
      'INDEX:SPX', 'INDEX:DJI', 'INDEX:NDX'
    ];

    const signals: TradingSignal[] = [];

    for (const symbol of symbols) {
      try {
        console.log(` Analyzing ${symbol}...`);
        const signal = await this.analyzeSymbol(symbol);
        if (signal) {
          signals.push(signal);
          console.log(`✅ Signal found for ${symbol}: ${signal.direction} (${signal.confidence}%)`);
        }
      } catch (error) {
        console.error(`❌ Failed to analyze ${symbol}:`, error);
      }
    }

    return signals.sort((a, b) => b.confidence - a.confidence);
  }

  private async analyzeSymbol(symbol: string): Promise<TradingSignal | null> {
    const d1Data = await this.yahoo.getTimeSeries(symbol, '1day', 50);
    const h4Data = await this.yahoo.getTimeSeries(symbol, '1h', 100);
    const quote = await this.yahoo.getQuote(symbol);

    const d1Candles: Candle[] = d1Data.values.map((c: any) => ({
      time: c.datetime,
      open: parseFloat(c.open),
      high: parseFloat(c.high),
      low: parseFloat(c.low),
      close: parseFloat(c.close),
      volume: parseFloat(c.volume),
    }));

    const h4Candles: Candle[] = h4Data.values.map((c: any) => ({
      time: c.datetime,
      open: parseFloat(c.open),
      high: parseFloat(c.high),
      low: parseFloat(c.low),
      close: parseFloat(c.close),
      volume: parseFloat(c.volume),
    }));

    const currentPrice = parseFloat(quote.close);
    const smcAnalysis = this.smc.analyze(d1Candles);
    const rsi = this.calculateRSI(d1Candles);
    const atr = this.calculateATR(d1Candles);

    const highImpactNews = await this.news.getHighImpactNews();
    const hasNewsConflict = this.checkNewsConflict(symbol, highImpactNews);

    let score = 0;
    const reasons: string[] = [];

    const d1Trend = this.getTrend(d1Candles);
    const h4Trend = this.getTrend(h4Candles);

    if (d1Trend === 'BULLISH' && h4Trend === 'BULLISH') {
      score += 25;
      reasons.push('✅ توافق D1 + H4 صاعد');
    }
    if (d1Trend === 'BEARISH' && h4Trend === 'BEARISH') {
      score -= 25;
      reasons.push('✅ توافق D1 + H4 هابط');
    }
    if (d1Trend !== h4Trend) {
      score -= 10;
      reasons.push('⚠️ تضارب بين الفريمات');
    }

    if (smcAnalysis.structure === 'BULLISH') {
      score += 15;
      reasons.push('🟢 هيكل السوق صاعد (HH + HL)');
    }
    if (smcAnalysis.structure === 'BEARISH') {
      score -= 15;
      reasons.push('🔴 هيكل السوق هابط (LH + LL)');
    }

    if (smcAnalysis.bos?.bullish) {
      score += 10;
      reasons.push('✅ BOS صاعد - كسر هيكل');
    }
    if (smcAnalysis.bos?.bearish) {
      score -= 10;
      reasons.push('📉 BOS هابط - كسر هيكل');
    }

    if (smcAnalysis.choch?.bullish) {
      score += 8;
      reasons.push('🔄 CHOCH صاعد - تغير اتجاه');
    }
    if (smcAnalysis.choch?.bearish) {
      score -= 8;
      reasons.push(' CHOCH هابط - تغير اتجاه');
    }

    if (smcAnalysis.orderBlocks?.bullish?.length > 0) {
      score += 7;
      reasons.push(`📍 ${smcAnalysis.orderBlocks.bullish.length} Order Block صاعد`);
    }
    if (smcAnalysis.orderBlocks?.bearish?.length > 0) {
      score -= 7;
      reasons.push(`📍 ${smcAnalysis.orderBlocks.bearish.length} Order Block هابط`);
    }

    if (rsi < 35) {
      score += 8;
      reasons.push(`📊 RSI ذروة بيع (${rsi.toFixed(1)})`);
    } else if (rsi > 65) {
      score -= 8;
      reasons.push(`📊 RSI ذروة شراء (${rsi.toFixed(1)})`);
    } else {
      reasons.push(`️ RSI متعادل (${rsi.toFixed(1)})`);
    }

    if (hasNewsConflict) {
      reasons.push('🚫 أخبار عالية التأثير قريبة - تم الإلغاء');
      return null;
    }

    const direction = score >= 30 ? 'BUY' : score <= -30 ? 'SELL' : 'NEUTRAL';
    if (direction === 'NEUTRAL') return null;

    const entry = currentPrice;
    const sl = direction === 'BUY'
      ? currentPrice - (atr * 1.5)
      : currentPrice + (atr * 1.5);

    const tp1 = direction === 'BUY'
      ? currentPrice + (atr * 1.5)
      : currentPrice - (atr * 1.5);

    const tp2 = direction === 'BUY'
      ? currentPrice + (atr * 3)
      : currentPrice - (atr * 3);

    const rr = Math.abs(tp2 - entry) / Math.abs(entry - sl);

    const confidence = Math.min(95, Math.max(40, Math.abs(score) * 1.2));

    if (confidence < this.MIN_CONFIDENCE) return null;
    if (rr < this.MIN_RR) return null;

    return {
      symbol,
      direction,
      confidence: Math.round(confidence),
      entry,
      stopLoss: sl,
      takeProfit1: tp1,
      takeProfit2: tp2,
      riskRewardRatio: parseFloat(rr.toFixed(2)),
      reasons,
      timeframe: 'H4/D1',
      timestamp: new Date(),
      status: 'ACTIVE',
    };
  }

  formatSignal(signal: TradingSignal): string {
    const dirText = signal.direction === 'BUY' ? 'شراء 📈' : 'بيع 📉';
    const dirEmoji = signal.direction === 'BUY' ? '🟢' : '🔴';

    let text = '🎯 **إشارة تداول عالية الثقة**\n\n';
    text += '━━━━━━━━━━━━━━━━━━━\n';
    text += '💱 **الزوج:** ' + signal.symbol + '\n';
    text += '📊 **الاتجاه:** ' + dirEmoji + ' ' + dirText + '\n';
    text += '🎯 **الثقة:** ' + signal.confidence + '%\n';
    text += '️ **الفريم:** ' + signal.timeframe + '\n';
    text += '━━━━━━━━━━━━━━━━━━━\n\n';

    text += '📍 **نقاط التنفيذ:**\n';
    text += '• الدخول: `' + signal.entry.toFixed(5) + '`\n';
    text += '• وقف الخسارة: `' + signal.stopLoss.toFixed(5) + '`\n';
    text += '• جني الربح 1: `' + signal.takeProfit1.toFixed(5) + '`\n';
    text += '• جني الربح 2: `' + signal.takeProfit2.toFixed(5) + '`\n';
    text += '• نسبة العائد/المخاطرة: `1:' + signal.riskRewardRatio.toFixed(2) + '`\n\n';

    text += '📝 **أسباب الإشارة:**\n';
    signal.reasons.forEach((reason) => {
      text += '  ' + reason + '\n';
    });

    text += '\n⏰ الوقت: ' + signal.timestamp.toLocaleString('ar-SA') + '\n';
    text += '\n⚠️ *التداول ينطوي على مخاطر. استخدم إدارة رأس مال صارمة.*';

    return text;
  }

  private getTrend(candles: Candle[]): 'BULLISH' | 'BEARISH' | 'NEUTRAL' {
    if (candles.length < 20) return 'NEUTRAL';
    const recent = candles.slice(0, 10);
    const older = candles.slice(10, 20);
    const recentAvg = recent.reduce((s, c) => s + c.close, 0) / recent.length;
    const olderAvg = older.reduce((s, c) => s + c.close, 0) / older.length;
    const change = ((recentAvg - olderAvg) / olderAvg) * 100;
    if (change > 1.5) return 'BULLISH';
    if (change < -1.5) return 'BEARISH';
    return 'NEUTRAL';
  }

  private calculateRSI(candles: Candle[], period = 14): number {
    if (candles.length < period + 1) return 50;
    let gains = 0, losses = 0;
    for (let i = 1; i <= period; i++) {
      const ch = candles[i - 1].close - candles[i].close;
      if (ch > 0) gains += ch;
      else losses += Math.abs(ch);
    }
    const ag = gains / period, al = losses / period;
    if (al === 0) return 100;
    return 100 - (100 / (1 + ag / al));
  }

  private calculateATR(candles: Candle[], period = 14): number {
    if (candles.length < period) return candles[0].high - candles[0].low;
    const trs = [];
    for (let i = 1; i <= period; i++) {
      const c = candles[i - 1], p = candles[i];
      trs.push(Math.max(
        c.high - c.low,
        Math.abs(c.high - p.close),
        Math.abs(c.low - p.close)
      ));
    }
    return trs.reduce((a, b) => a + b, 0) / period;
  }

  private checkNewsConflict(symbol: string, news: NewsItem[]): boolean {
    const currency = symbol.includes('USD') ? 'USD' : symbol.includes('EUR') ? 'EUR' : '';
    if (!currency) return false;
    return news.some((n) => n.currency === currency && n.impact === 'HIGH');
  }
}