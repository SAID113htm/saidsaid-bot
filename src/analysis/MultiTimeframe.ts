import { TwelveDataClient } from '../providers/TwelveDataClient';

export interface TimeframeResult {
  timeframe: string;
  trend: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  rsi: number;
  price: number;
  change: number;
}

export interface MultiTimeframeAnalysis {
  pair: string;
  timeframes: TimeframeResult[];
  alignment: number;
  overallTrend: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  recommendation: string;
}

export class MultiTimeframeAnalyzer {
  private client: TwelveDataClient;

  constructor(client: TwelveDataClient) {
    this.client = client;
  }

  async analyze(pair: string): Promise<MultiTimeframeAnalysis> {
    // لا نحذف الشرطة - TwelveData يحتاجها
    const cleanPair = pair;
    
    const timeframes = [
      { interval: '1day', label: 'D1' },
      { interval: '4h', label: 'H4' },
      { interval: '1h', label: 'H1' },
      { interval: '15min', label: 'M15' },
    ];

    const results: TimeframeResult[] = [];

    for (const tf of timeframes) {
      try {
        const data = await this.client.getTimeSeries(cleanPair, tf.interval, 50);
        const quote = await this.client.getQuote(cleanPair);
        
        const price = parseFloat(quote.close);
        const candles = data.values;
        
        const rsi = this.calculateRSI(candles);
        const trend = this.determineTrend(candles);
        const change = this.calculateChange(candles);

        results.push({
          timeframe: tf.label,
          trend,
          rsi: Math.round(rsi * 100) / 100,
          price,
          change: Math.round(change * 100) / 100,
        });
      } catch (error) {
        console.error(`Error analyzing ${tf.label}:`, error);
        results.push({
          timeframe: tf.label,
          trend: 'NEUTRAL',
          rsi: 50,
          price: 0,
          change: 0,
        });
      }
    }

    const alignment = this.calculateAlignment(results);
    const overallTrend = this.determineOverallTrend(results);
    const recommendation = this.getRecommendation(overallTrend, alignment);

    return {
      pair: pair.toUpperCase(),
      timeframes: results,
      alignment,
      overallTrend,
      recommendation,
    };
  }

  formatAnalysis(analysis: MultiTimeframeAnalysis): string {
    const trendEmoji: any = {
      'BULLISH': '',
      'BEARISH': '',
      'NEUTRAL': ''
    };

    let text = '\n📊 Multi-Timeframe Analysis\n\n';
    text += '💱 الزوج: ' + analysis.pair + '\n\n';

    text += '️ تحليل الإطارات الزمنية:\n\n';

    for (const tf of analysis.timeframes) {
      text += ' ' + tf.timeframe + '\n';
      text += '   الاتجاه: ' + trendEmoji[tf.trend] + ' ' + this.getTrendText(tf.trend) + '\n';
      text += '   RSI: ' + tf.rsi + '\n';
      text += '   التغيير: ' + (tf.change > 0 ? '+' : '') + tf.change + '%\n\n';
    }

    text += '━━━━━━━━━━━━━━━━━━━\n\n';
    text += '🎯 النتيجة النهائية:\n\n';
    text += '📈 الاتجاه العام: ' + trendEmoji[analysis.overallTrend] + ' ' + this.getTrendText(analysis.overallTrend) + '\n';
    text += ' توافق الاتجاهات: ' + analysis.alignment + '%\n';
    text += '💡 التوصية: ' + analysis.recommendation + '\n';

    return text;
  }

  private calculateRSI(candles: any[], period: number = 14): number {
    if (candles.length < period + 1) return 50;

    let gains = 0;
    let losses = 0;

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

    const recent = candles.slice(0, 10);
    const older = candles.slice(10, 20);

    const recentAvg = recent.reduce((sum: number, c: any) => sum + parseFloat(c.close), 0) / recent.length;
    const olderAvg = older.reduce((sum: number, c: any) => sum + parseFloat(c.close), 0) / older.length;

    const change = ((recentAvg - olderAvg) / olderAvg) * 100;

    if (change > 1) return 'BULLISH';
    if (change < -1) return 'BEARISH';
    return 'NEUTRAL';
  }

  private calculateChange(candles: any[]): number {
    if (candles.length < 2) return 0;
    const first = parseFloat(candles[candles.length - 1].close);
    const last = parseFloat(candles[0].close);
    return ((last - first) / first) * 100;
  }

  private calculateAlignment(results: TimeframeResult[]): number {
    const bullishCount = results.filter(r => r.trend === 'BULLISH').length;
    const bearishCount = results.filter(r => r.trend === 'BEARISH').length;
    const total = results.length;

    const maxAgreement = Math.max(bullishCount, bearishCount);
    return Math.round((maxAgreement / total) * 100);
  }

  private determineOverallTrend(results: TimeframeResult[]): 'BULLISH' | 'BEARISH' | 'NEUTRAL' {
    const bullishCount = results.filter(r => r.trend === 'BULLISH').length;
    const bearishCount = results.filter(r => r.trend === 'BEARISH').length;

    if (bullishCount > bearishCount && bullishCount >= 2) return 'BULLISH';
    if (bearishCount > bullishCount && bearishCount >= 2) return 'BEARISH';
    return 'NEUTRAL';
  }

  private getRecommendation(trend: string, alignment: number): string {
    if (trend === 'BULLISH' && alignment >= 75) return 'شراء قوي 🟢';
    if (trend === 'BULLISH' && alignment >= 50) return 'شراء ';
    if (trend === 'BEARISH' && alignment >= 75) return 'بيع قوي ';
    if (trend === 'BEARISH' && alignment >= 50) return 'بيع ';
    return 'انتظار ';
  }

  private getTrendText(trend: string): string {
    const texts: any = {
      'BULLISH': 'صاعد',
      'BEARISH': 'هابط',
      'NEUTRAL': 'جانبي'
    };
    return texts[trend];
  }
}