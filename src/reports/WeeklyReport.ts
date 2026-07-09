import { YahooFinanceClient } from '../providers/YahooFinanceClient';
import { SmartMoneyAnalyzer, Candle } from '../smartmoney/SmartMoney';
import { BarChartAnalyzer } from '../analysis/BarChartAnalyzer';
import { NewsAnalyzer } from '../news/NewsAnalyzer';

export interface WeeklyAnalysis {
  symbol: string;
  weekChange: number;
  weekHigh: number;
  weekLow: number;
  trend: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  strength: number;
  keyLevels: { support: number[]; resistance: number[] };
  patterns: string[];
  recommendation: string;
}

export class WeeklyReport {
  private yahoo: YahooFinanceClient;
  private smc: SmartMoneyAnalyzer;
  private barAnalyzer: BarChartAnalyzer;
  private news: NewsAnalyzer;

  constructor() {
    this.yahoo = new YahooFinanceClient();
    this.smc = new SmartMoneyAnalyzer();
    this.barAnalyzer = new BarChartAnalyzer();
    this.news = new NewsAnalyzer();
  }

  async generateReport(symbols: string[]): Promise<string> {
    console.log('Generating weekly report...');
    let report = '📊 **التقرير السبوعي الشامل**\n\n';
    report += '⏰ ' + new Date().toLocaleDateString('ar-SA') + '\n';
    report += '━━━━━━━━━━━━━━━━━━━\n\n';

    const analyses: WeeklyAnalysis[] = [];
    for (const symbol of symbols) {
      try {
        const analysis = await this.analyzeSymbol(symbol);
        analyses.push(analysis);
      } catch (error) {
        console.error('Failed to analyze ' + symbol + ':', error);
      }
    }

    report += '🌍 **ملخص السوق:**\n\n';
    const bullish = analyses.filter(a => a.trend === 'BULLISH').length;
    const bearish = analyses.filter(a => a.trend === 'BEARISH').length;
    const neutral = analyses.filter(a => a.trend === 'NEUTRAL').length;
    report += '🟢 صول صاعدة: ' + bullish + '\n';
    report += '🔴 صول هابطة: ' + bearish + '\n';
    report += '🟡 صول جانبي: ' + neutral + '\n\n';

    report += '🎯 **فضل الفرص هذا السبوع:**\n\n';
    const topOpp = analyses.filter(a => a.trend !== 'NEUTRAL' && a.strength > 60).sort((a, b) => b.strength - a.strength).slice(0, 3);

    if (topOpp.length === 0) {
      report += '⚠️ لا توجد فرص قوية هذا السبوع\n\n';
    } else {
      topOpp.forEach((opp, i) => {
        const emoji = opp.trend === 'BULLISH' ? '🟢' : '🔴';
        const trend = opp.trend === 'BULLISH' ? 'شراء' : 'بيع';
        report += (i + 1) + '. ' + emoji + ' **' + opp.symbol + '** - ' + trend + '\n';
        report += '   💪 القوة: ' + opp.strength + '%\n';
        report += '   📊 التغيير السبوعي: ' + (opp.weekChange > 0 ? '+' : '') + opp.weekChange.toFixed(2) + '%\n\n';
      });
    }

    report += '━━━━━━━━━━━━━━━━━━━\n\n';
    report += '📈 **التحليل المفصل:**\n\n';
    for (const analysis of analyses.slice(0, 5)) {
      report += this.formatSymbolAnalysis(analysis) + '\n';
    }

    report += '━━━━━━━━━━━━━━━━━━━\n\n';
    report += '📰 **الخبار المهمة للسبوع القادم:**\n\n';
    const highNews = await this.news.getHighImpactNews();
    if (highNews.length > 0) {
      highNews.slice(0, 5).forEach(n => {
        report += '🔴 ' + n.title + '\n';
        report += '   💱 ' + n.currency + ' | 🕐 ' + n.time + '\n\n';
      });
    } else {
      report += '✅ لا توجد خبار عالية التثير\n\n';
    }

    report += '⚠️ *هذا التقرير للغراض التعليمية فقط. تداول بمسؤولية.*';
    return report;
  }

  private async analyzeSymbol(symbol: string): Promise<WeeklyAnalysis> {
    const weekData = await this.yahoo.getTimeSeries(symbol, '1day', 7);
    const monthData = await this.yahoo.getTimeSeries(symbol, '1day', 30);
    const quote = await this.yahoo.getQuote(symbol);

    const candles: Candle[] = weekData.values.map((c: any) => ({
      time: c.datetime, open: parseFloat(c.open), high: parseFloat(c.high),
      low: parseFloat(c.low), close: parseFloat(c.close), volume: parseFloat(c.volume),
    }));

    const currentPrice = parseFloat(quote.close);
    const weekOpen = candles[candles.length - 1]?.open || currentPrice;
    const weekChange = ((currentPrice - weekOpen) / weekOpen) * 100;
    const weekHigh = Math.max(...candles.map(c => c.high));
    const weekLow = Math.min(...candles.map(c => c.low));
    const trend = this.determineTrend(candles);
    const strength = this.calculateStrength(candles);
    const support = this.calculateSupport(monthData.values);
    const resistance = this.calculateResistance(monthData.values);
    const patterns = this.barAnalyzer.analyze(candles);
    const patternNames = patterns.map(p => p.pattern);
    const recommendation = this.getRecommendation(trend, strength);

    return { symbol, weekChange, weekHigh, weekLow, trend, strength, keyLevels: { support, resistance }, patterns: patternNames, recommendation };
  }

  private determineTrend(candles: Candle[]): 'BULLISH' | 'BEARISH' | 'NEUTRAL' {
    if (candles.length < 5) return 'NEUTRAL';
    const first = candles[candles.length - 1].close;
    const last = candles[0].close;
    const change = ((last - first) / first) * 100;
    if (change > 1) return 'BULLISH';
    if (change < -1) return 'BEARISH';
    return 'NEUTRAL';
  }

  private calculateStrength(candles: Candle[]): number {
    if (candles.length < 5) return 50;
    const bullishCandles = candles.filter(c => c.close > c.open).length;
    return Math.round((bullishCandles / candles.length) * 100);
  }

  private calculateSupport(candles: any[]): number[] {
    const lows = candles.slice(0, 20).map((c: any) => parseFloat(c.low));
    const min = Math.min(...lows);
    return [min, min * 0.998, min * 0.996];
  }

  private calculateResistance(candles: any[]): number[] {
    const highs = candles.slice(0, 20).map((c: any) => parseFloat(c.high));
    const max = Math.max(...highs);
    return [max, max * 1.002, max * 1.004];
  }

  private getRecommendation(trend: string, strength: number): string {
    if (trend === 'BULLISH' && strength > 70) return 'شراء قوي 🟢';
    if (trend === 'BULLISH' && strength > 50) return 'شراء 📈';
    if (trend === 'BEARISH' && strength > 70) return 'بيع قوي 🔴';
    if (trend === 'BEARISH' && strength > 50) return 'بيع 📉';
    return 'انتظار ⏳';
  }

  private formatSymbolAnalysis(analysis: WeeklyAnalysis): string {
    const emoji = analysis.trend === 'BULLISH' ? '🟢' : analysis.trend === 'BEARISH' ? '🔴' : '🟡';
    const trendText = analysis.trend === 'BULLISH' ? 'صاعد' : analysis.trend === 'BEARISH' ? 'هابط' : 'جانبي';
    let text = emoji + ' **' + analysis.symbol + '**\n';
    text += '📊 الاتجاه: ' + trendText + ' | 💪 القوة: ' + analysis.strength + '%\n';
    text += '📈 التغيير السبوعي: ' + (analysis.weekChange > 0 ? '+' : '') + analysis.weekChange.toFixed(2) + '%\n';
    text += '📍 على سبوعي: ' + analysis.weekHigh.toFixed(5) + '\n';
    text += '📍 قل سبوعي: ' + analysis.weekLow.toFixed(5) + '\n';
    if (analysis.patterns.length > 0) {
      text += '🕯️ النماط: ' + analysis.patterns.join(', ') + '\n';
    }
    text += '💡 التوصية: ' + analysis.recommendation + '\n';
    return text;
  }
}
