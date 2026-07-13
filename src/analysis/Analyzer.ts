import { config } from '../config/env';
import { TwelveDataClient } from '../providers/TwelveDataClient';
import { YahooFinanceClient } from '../providers/YahooFinanceClient';
import { SmartMoneyAnalyzer, Candle } from '../smartmoney/SmartMoney';
import { NewsAnalyzer } from '../news/NewsAnalyzer';

export interface AnalysisResult {
  symbol: string;
  decision: 'BUY' | 'SELL' | 'NEUTRAL';
  strength: number;
  confidence: number;
  timeframes: {
    MN: string;
    W1: string;
    D1: string;
    H4: string;
    H1: string;
  };
  smartMoney: {
    trend: string;
    bullishBOS: boolean;
    bearishBOS: boolean;
    bullishCHOCH: boolean;
    bearishCHOCH: boolean;
    bullishOrderBlocks: number;
    bearishOrderBlocks: number;
    bullishFVG: number;
    bearishFVG: number;
    liquiditySweeps: number;
  };
  entry: number;
  stopLoss: number;
  takeProfit1: number;
  takeProfit2: number;
  takeProfit3: number;
  riskReward: number;
  warnings: string[];
}

export class Analyzer {
  private twelveData: TwelveDataClient;
  private yahoo: YahooFinanceClient;
  private smc: SmartMoneyAnalyzer;
  private news: NewsAnalyzer;

  constructor() {
    this.twelveData = new TwelveDataClient(config.twelveData.apiKey);
    this.yahoo = new YahooFinanceClient();
    this.smc = new SmartMoneyAnalyzer();
    this.news = new NewsAnalyzer();
  }

  async analyze(symbol: string): Promise<AnalysisResult> {
    try {
      const candles = await this.getCandles(symbol);
      const smcAnalysis: any = this.smc.analyze(candles);
      const currentPrice = candles[candles.length - 1].close;

      const timeframes = this.analyzeTimeframes(candles);
      const signals = this.generateSignals(smcAnalysis, timeframes);
      const entryPoints = this.calculateEntryPoints(currentPrice, signals.direction);
      const riskReward = this.calculateRiskReward(entryPoints);

      const strength = this.calculateStrength(signals, timeframes);
      const confidence = this.calculateConfidence(strength, riskReward);

      const warnings: string[] = [];
      if (riskReward < 2) {
        warnings.push(`نسبة R:R (${riskReward.toFixed(2)}) أقل من الحد الأدنى (2)`);
      }

      // استخراج بيانات Smart Money بشكل مرن
      const smartMoneyData = this.extractSmartMoneyData(smcAnalysis);

      return {
        symbol,
        decision: signals.direction,
        strength,
        confidence,
        timeframes,
        smartMoney: smartMoneyData,
        entry: entryPoints.entry,
        stopLoss: entryPoints.stopLoss,
        takeProfit1: entryPoints.takeProfit1,
        takeProfit2: entryPoints.takeProfit2,
        takeProfit3: entryPoints.takeProfit3,
        riskReward,
        warnings,
      };
    } catch (error) {
      throw new Error('Analysis failed: ' + (error as Error).message);
    }
  }

  // دالة مرنة لاستخراج بيانات Smart Money
  private extractSmartMoneyData(smc: any) {
    const trend = smc.trend || smc.marketStructure || smc.direction || 'NEUTRAL';
    
    // BOS - قد يكون object أو boolean
    const bos = smc.bos || {};
    const bullishBOS = bos.bullish === true || bos === true || (typeof bos === 'object' && bos.bullish);
    const bearishBOS = bos.bearish === true || (typeof bos === 'object' && bos.bearish);
    
    // CHOCH
    const choch = smc.choch || {};
    const bullishCHOCH = choch.bullish === true || choch === true || (typeof choch === 'object' && choch.bullish);
    const bearishCHOCH = choch.bearish === true || (typeof choch === 'object' && choch.bearish);
    
    // Order Blocks
    const orderBlocks = smc.orderBlocks || {};
    const bullishOrderBlocks = Array.isArray(orderBlocks.bullish) ? orderBlocks.bullish.length : 0;
    const bearishOrderBlocks = Array.isArray(orderBlocks.bearish) ? orderBlocks.bearish.length : 0;
    
    // FVG
    const fvg = smc.fvg || {};
    const bullishFVG = Array.isArray(fvg.bullish) ? fvg.bullish.length : 0;
    const bearishFVG = Array.isArray(fvg.bearish) ? fvg.bearish.length : 0;
    
    // Liquidity Sweeps
    const liquiditySweeps = Array.isArray(smc.liquiditySweeps) ? smc.liquiditySweeps.length : 0;

    return {
      trend: String(trend).toUpperCase(),
      bullishBOS: !!bullishBOS,
      bearishBOS: !!bearishBOS,
      bullishCHOCH: !!bullishCHOCH,
      bearishCHOCH: !!bearishCHOCH,
      bullishOrderBlocks,
      bearishOrderBlocks,
      bullishFVG,
      bearishFVG,
      liquiditySweeps,
    };
  }

  async getInstitutionalAnalysis(symbol: string): Promise<string> {
    try {
      const analysis = await this.analyze(symbol);
      const highImpactNews = await this.news.getHighImpactNews(symbol);
      const newsAlert = this.news.formatNewsAlert(symbol, highImpactNews);

      if (highImpactNews.length > 0) {
        analysis.warnings.push(`${highImpactNews.length} أخبار عالية التأثير قريبة`);
      }

      const { overallScore, finalVerdict, reasons } = this.calculateOverallScore(analysis);
      const overallEvaluation = this.formatOverallEvaluation(overallScore, finalVerdict, reasons);

      return this.formatInstitutionalAnalysis(analysis, newsAlert, overallEvaluation);
    } catch (error) {
      throw new Error('Institutional analysis failed: ' + (error as Error).message);
    }
  }

  private calculateOverallScore(analysis: AnalysisResult): {
    overallScore: number;
    finalVerdict: string;
    reasons: string[];
  } {
    const reasons: string[] = [];
    let score = 0;

    // 1. وضوح الاتجاه (30 نقطة)
    const tfValues = Object.values(analysis.timeframes);
    const bullishCount = tfValues.filter(v => v === 'BULLISH').length;
    const bearishCount = tfValues.filter(v => v === 'BEARISH').length;
    const neutralCount = tfValues.filter(v => v === 'NEUTRAL').length;
    
    if (bullishCount >= 3 || bearishCount >= 3) {
      score += 30;
      reasons.push(`✅ وضوح الاتجاه: ${bullishCount >= 3 ? 'صاعد' : 'هابط'} (${bullishCount >= 3 ? bullishCount : bearishCount}/5 فريمات)`);
    } else if (bullishCount >= 2 || bearishCount >= 2) {
      score += 15;
      reasons.push(`️ وضوح الاتجاه: متوسط (${bullishCount >= 2 ? bullishCount : bearishCount}/5 فريمات)`);
    } else {
      reasons.push(`❌ وضوح الاتجاه: ضعيف (${neutralCount}/5 فريمات محايدة)`);
    }

    // 2. Smart Money (25 نقطة)
    const smcScore = this.calculateSmartMoneyScore(analysis.smartMoney);
    score += smcScore;
    if (smcScore >= 20) {
      reasons.push(`✅ Smart Money: قوي`);
    } else if (smcScore >= 10) {
      reasons.push(`⚠️ Smart Money: متوسط`);
    } else {
      reasons.push(`❌ Smart Money: ضعيف أو متناقض`);
    }

    // 3. نسبة R:R (25 نقطة)
    if (analysis.riskReward >= 3) {
      score += 25;
      reasons.push(`✅ R:R ممتاز (1:${analysis.riskReward.toFixed(2)})`);
    } else if (analysis.riskReward >= 2) {
      score += 20;
      reasons.push(`✅ R:R جيد (1:${analysis.riskReward.toFixed(2)})`);
    } else if (analysis.riskReward >= 1.5) {
      score += 10;
      reasons.push(`⚠️ R:R مقبول (1:${analysis.riskReward.toFixed(2)})`);
    } else {
      reasons.push(`❌ R:R ضعيف (1:${analysis.riskReward.toFixed(2)})`);
    }

    // 4. الثقة (20 نقطة)
    if (analysis.confidence >= 75) {
      score += 20;
      reasons.push(`✅ الثقة عالية (${analysis.confidence}%)`);
    } else if (analysis.confidence >= 60) {
      score += 15;
      reasons.push(`✅ الثقة جيدة (${analysis.confidence}%)`);
    } else if (analysis.confidence >= 50) {
      score += 10;
      reasons.push(`⚠️ الثقة متوسطة (${analysis.confidence}%)`);
    } else {
      reasons.push(`❌ الثقة منخفضة (${analysis.confidence}%)`);
    }

    // 5. خصم الأخبار
    const newsWarning = analysis.warnings.find(w => w.includes('أخبار'));
    if (newsWarning) {
      score -= 15;
      reasons.push(`️ خصم بسبب الأخبار عالية التأثير`);
    }

    let finalVerdict: string;
    if (score >= 80) {
      finalVerdict = '🟢 فرصة ممتازة - تداول بثقة';
    } else if (score >= 65) {
      finalVerdict = '🟢 فرصة جيدة - يمكنك التداول';
    } else if (score >= 50) {
      finalVerdict = '🟡 فرصة متوسطة - تداول بحذر';
    } else if (score >= 35) {
      finalVerdict = '🟠 فرصة ضعيفة - يُنصح بالانتظار';
    } else {
      finalVerdict = '🔴 لا تتداول - ظروف السوق غير مناسبة';
    }

    return {
      overallScore: Math.max(0, Math.min(100, score)),
      finalVerdict,
      reasons,
    };
  }

  private calculateSmartMoneyScore(smartMoney: AnalysisResult['smartMoney']): number {
    let score = 0;
    
    if (smartMoney.trend === 'BULLISH' || smartMoney.trend === 'BEARISH') {
      score += 8;
    }
    
    if (smartMoney.bullishBOS || smartMoney.bearishBOS) {
      score += 5;
    }
    
    if (smartMoney.bullishCHOCH || smartMoney.bearishCHOCH) {
      score += 5;
    }
    
    const totalOB = smartMoney.bullishOrderBlocks + smartMoney.bearishOrderBlocks;
    if (totalOB >= 2 && totalOB <= 5) {
      score += 4;
    } else if (totalOB > 5) {
      score += 2;
    }
    
    const totalFVG = smartMoney.bullishFVG + smartMoney.bearishFVG;
    if (totalFVG >= 1 && totalFVG <= 4) {
      score += 3;
    }
    
    return Math.min(25, score);
  }

  private formatOverallEvaluation(
    score: number,
    verdict: string,
    reasons: string[]
  ): string {
    let text = '\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
    text += '📊 **التقييم الشامل للفرصة**\n';
    text += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n';

    const progressBar = this.createProgressBar(score);
    text += `${progressBar}\n\n`;

    text += `🎯 **الدرجة النهائية: ${score}/100**\n\n`;

    text += '**📋 تفاصيل التقييم:**\n';
    reasons.forEach(reason => {
      text += `• ${reason}\n`;
    });
    text += '\n';

    text += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    text += `${verdict}\n`;
    text += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

    if (score < 50) {
      text += '💡 **نصائح:**\n';
      text += '• انتظر وضوح الاتجاه\n';
      text += '• ابحث عن أزواج أخرى بفرص أفضل\n';
      text += '• راجع التحليل لاحقاً\n';
    } else if (score < 70) {
      text += '💡 **نصائح:**\n';
      text += '• استخدم حجم صفقة أصغر\n';
      text += '• التزم بوقف الخسارة بدقة\n';
      text += '• راقب الأخبار القريبة\n';
    } else {
      text += '💡 **نصائح:**\n';
      text += '• الفرصة جيدة - تداول بثقة\n';
      text += '• التزم بخطة التداول\n';
      text += '• راقب إدارة المخاطر\n';
    }

    return text;
  }

  private createProgressBar(score: number): string {
    const totalBlocks = 20;
    const filledBlocks = Math.round((score / 100) * totalBlocks);
    const emptyBlocks = totalBlocks - filledBlocks;
    
    let bar = '🟢'.repeat(Math.min(filledBlocks, 10));
    if (filledBlocks > 10) {
      bar += '🟡'.repeat(filledBlocks - 10);
    }
    bar += '⚪'.repeat(emptyBlocks);
    
    return `**[${bar}]** ${score}%`;
  }

  private async getCandles(symbol: string): Promise<Candle[]> {
    try {
      const data = await this.yahoo.getTimeSeries(symbol, '1day', 100);
      return data.values.map((c: any) => ({
        time: c.datetime,
        open: parseFloat(c.open),
        high: parseFloat(c.high),
        low: parseFloat(c.low),
        close: parseFloat(c.close),
        volume: parseFloat(c.volume),
      }));
    } catch (error) {
      throw new Error('Failed to fetch candles: ' + (error as Error).message);
    }
  }

  private analyzeTimeframes(candles: Candle[]): {
    MN: string;
    W1: string;
    D1: string;
    H4: string;
    H1: string;
  } {
    return {
      MN: this.analyzeTimeframe(candles, 30),
      W1: this.analyzeTimeframe(candles, 13),
      D1: this.analyzeTimeframe(candles, 30),
      H4: this.analyzeTimeframe(candles, 20),
      H1: this.analyzeTimeframe(candles, 14),
    };
  }

  private analyzeTimeframe(candles: Candle[], period: number): string {
    if (candles.length < period) return 'NEUTRAL';
    
    const recent = candles.slice(-period);
    const first = recent[0].close;
    const last = recent[recent.length - 1].close;
    const change = ((last - first) / first) * 100;
    
    if (change > 2) return 'BULLISH';
    if (change < -2) return 'BEARISH';
    return 'NEUTRAL';
  }

  private generateSignals(smc: any, timeframes: any): {
    direction: 'BUY' | 'SELL' | 'NEUTRAL';
    reasons: string[];
  } {
    const reasons: string[] = [];
    let bullishSignals = 0;
    let bearishSignals = 0;

    const trend = smc.trend || smc.marketStructure || smc.direction || 'NEUTRAL';
    if (String(trend).toUpperCase().includes('BULL')) bullishSignals++;
    if (String(trend).toUpperCase().includes('BEAR')) bearishSignals++;
    
    const bos = smc.bos || {};
    if (bos.bullish) bullishSignals++;
    if (bos.bearish) bearishSignals++;
    
    const choch = smc.choch || {};
    if (choch.bullish) bullishSignals++;
    if (choch.bearish) bearishSignals++;

    const tfValues = Object.values(timeframes);
    tfValues.forEach(tf => {
      if (tf === 'BULLISH') bullishSignals++;
      if (tf === 'BEARISH') bearishSignals++;
    });

    if (bullishSignals > bearishSignals + 2) {
      return { direction: 'BUY', reasons };
    }
    if (bearishSignals > bullishSignals + 2) {
      return { direction: 'SELL', reasons };
    }
    return { direction: 'NEUTRAL', reasons };
  }

  private calculateEntryPoints(currentPrice: number, direction: 'BUY' | 'SELL' | 'NEUTRAL') {
    const atr = currentPrice * 0.01;
    
    if (direction === 'BUY') {
      return {
        entry: currentPrice,
        stopLoss: currentPrice - atr * 1.5,
        takeProfit1: currentPrice + atr * 2,
        takeProfit2: currentPrice + atr * 3,
        takeProfit3: currentPrice + atr * 4,
      };
    } else if (direction === 'SELL') {
      return {
        entry: currentPrice,
        stopLoss: currentPrice + atr * 1.5,
        takeProfit1: currentPrice - atr * 2,
        takeProfit2: currentPrice - atr * 3,
        takeProfit3: currentPrice - atr * 4,
      };
    }
    
    return {
      entry: currentPrice,
      stopLoss: currentPrice - atr,
      takeProfit1: currentPrice + atr,
      takeProfit2: currentPrice + atr * 1.5,
      takeProfit3: currentPrice + atr * 2,
    };
  }

  private calculateRiskReward(entryPoints: {
    entry: number;
    stopLoss: number;
    takeProfit1: number;
  }): number {
    const risk = Math.abs(entryPoints.entry - entryPoints.stopLoss);
    const reward = Math.abs(entryPoints.takeProfit1 - entryPoints.entry);
    return risk > 0 ? reward / risk : 0;
  }

  private calculateStrength(signals: any, timeframes: any): number {
    let strength = 0;
    
    if (signals.direction !== 'NEUTRAL') strength += 30;
    
    const tfValues = Object.values(timeframes);
    const alignedCount = tfValues.filter(tf => 
      (signals.direction === 'BUY' && tf === 'BULLISH') ||
      (signals.direction === 'SELL' && tf === 'BEARISH')
    ).length;
    
    strength += (alignedCount / tfValues.length) * 40;
    
    return Math.min(100, Math.max(-100, strength));
  }

  private calculateConfidence(strength: number, riskReward: number): number {
    let confidence = 50;
    
    if (strength > 50) confidence += 20;
    if (strength > 70) confidence += 10;
    
    if (riskReward >= 2) confidence += 15;
    if (riskReward >= 3) confidence += 5;
    
    return Math.min(100, Math.max(0, confidence));
  }

  formatAnalysis(analysis: AnalysisResult): string {
    let text = `📊 **تحليل ${analysis.symbol}**\n\n`;
    text += '━━━━━━━━━━━━━━━━━━━\n';
    text += `📈 **القرار:** ${this.getDecisionEmoji(analysis.decision)} ${analysis.decision}\n`;
    text += `💪 **القوة:** ${analysis.strength.toFixed(0)}/100\n`;
    text += ` **الثقة:** ${analysis.confidence.toFixed(0)}%\n`;
    text += '━━━━━━━━━━━━━━━━━━━\n\n';

    text += ' **تحليل الفريمات:**\n';
    Object.entries(analysis.timeframes).forEach(([tf, trend]) => {
      text += `  ${this.getTrendEmoji(trend)} ${tf}: ${trend}\n`;
    });
    text += '\n';

    text += '🔍 **Smart Money Concepts:**\n';
    text += `  📍 الاتجاه: ${analysis.smartMoney.trend}\n`;
    text += `  🔄 BOS: ${analysis.smartMoney.bullishBOS ? 'صاعد ✅' : analysis.smartMoney.bearishBOS ? 'هابط 🔴' : 'لا يوجد'}\n`;
    text += `   CHOCH: ${analysis.smartMoney.bullishCHOCH ? 'صاعد ✅' : analysis.smartMoney.bearishCHOCH ? 'هابط 🔴' : 'لا يوجد'}\n`;
    text += `  📦 Order Blocks: ${analysis.smartMoney.bullishOrderBlocks + analysis.smartMoney.bearishOrderBlocks} (صاعد: ${analysis.smartMoney.bullishOrderBlocks}, هابط: ${analysis.smartMoney.bearishOrderBlocks})\n`;
    text += `  ⚡ FVG: ${analysis.smartMoney.bullishFVG + analysis.smartMoney.bearishFVG} (صاعد: ${analysis.smartMoney.bullishFVG}, هابط: ${analysis.smartMoney.bearishFVG})\n`;
    text += `  💧 Liquidity Sweeps: ${analysis.smartMoney.liquiditySweeps}\n\n`;

    text += '🎯 **نقاط الدخول:**\n';
    text += `• الدخول: ${analysis.entry.toFixed(5)}\n`;
    text += `• وقف الخسارة: ${analysis.stopLoss.toFixed(5)}\n`;
    text += `• جني الربح 1: ${analysis.takeProfit1.toFixed(5)}\n`;
    text += `• جني الربح 2: ${analysis.takeProfit2.toFixed(5)}\n`;
    text += `• جني الربح 3: ${analysis.takeProfit3.toFixed(5)}\n\n`;

    text += `📊 **نسبة R:R:** 1:${analysis.riskReward.toFixed(2)}\n`;
    if (analysis.riskReward < 2) {
      text += '❌ **تحذير:** R:R أقل من 1:2 - الصفقة غير مقبولة\n\n';
    }

    if (analysis.warnings.length > 0) {
      text += '⚠️ **تحذيرات:**\n';
      analysis.warnings.forEach(warning => {
        text += `  ⚠️ ${warning}\n`;
      });
      text += '\n';
    }

    return text;
  }

  private formatInstitutionalAnalysis(
    analysis: AnalysisResult,
    newsAlert: string,
    overallEvaluation: string
  ): string {
    let text = `🏛️ **التحليل المؤسسي - ${analysis.symbol}**\n\n`;
    text += '━━━━━━━━━━━━━━━━━━━\n';
    text += `📊 **القرار:** ${this.getDecisionEmoji(analysis.decision)} ${analysis.decision}\n`;
    text += ` **القوة:** ${analysis.strength.toFixed(0)}/100\n`;
    text += `🎯 **الثقة:** ${analysis.confidence.toFixed(0)}%\n`;
    text += '━━━━━━━━━━━━━━━━━━━\n\n';

    text += '📈 **تحليل الفريمات:**\n';
    const tfWeights: Record<string, number> = { MN: 40, W1: 30, D1: 20, H4: 10, H1: 5 };
    Object.entries(analysis.timeframes).forEach(([tf, trend]) => {
      const weight = tfWeights[tf] || 10;
      text += `  ${this.getTrendEmoji(trend)} ${tf}: ${trend} - الوزن ${weight}%\n`;
    });
    text += '\n';

    text += '🔍 **Smart Money Concepts:**\n';
    const trendEmoji = analysis.smartMoney.trend === 'BULLISH' ? '🟢' : analysis.smartMoney.trend === 'BEARISH' ? '🔴' : '🟡';
    text += `  ${trendEmoji} الاتجاه: ${analysis.smartMoney.trend}\n`;
    text += `  🔄 BOS: ${analysis.smartMoney.bullishBOS ? 'صاعد ✅' : analysis.smartMoney.bearishBOS ? 'هابط 🔴' : 'لا يوجد'}\n`;
    text += `  ⚡ CHOCH: ${analysis.smartMoney.bullishCHOCH ? 'صاعد ✅' : analysis.smartMoney.bearishCHOCH ? 'هابط 🔴' : 'لا يوجد'}\n`;
    text += `  📍 Order Blocks صاعد: ${analysis.smartMoney.bullishOrderBlocks}\n`;
    text += `   Order Blocks هابط: ${analysis.smartMoney.bearishOrderBlocks}\n`;
    text += `  ⚡️ FVG صاعد: ${analysis.smartMoney.bullishFVG}\n`;
    text += `  ⚡️ FVG هابط: ${analysis.smartMoney.bearishFVG}\n`;
    text += `  💧 Liquidity Sweeps: ${analysis.smartMoney.liquiditySweeps}\n\n`;

    text += '🎯 **نقاط الدخول:**\n';
    text += `• الدخول: ${analysis.entry.toFixed(5)}\n`;
    text += `• وقف الخسارة: ${analysis.stopLoss.toFixed(5)}\n`;
    text += `• جني الربح 1: ${analysis.takeProfit1.toFixed(5)}\n`;
    text += `• جني الربح 2: ${analysis.takeProfit2.toFixed(5)}\n`;
    text += `• جني الربح 3: ${analysis.takeProfit3.toFixed(5)}\n\n`;

    text += `📊 **نسبة R:R:** 1:${analysis.riskReward.toFixed(2)}\n`;
    if (analysis.riskReward < 2) {
      text += '❌ **تحذير:** R:R أقل من 1:2 - الصفقة غير مقبولة\n\n';
    } else {
      text += '✅ **ممتاز:** R:R مقبول للتداول\n\n';
    }

    if (analysis.warnings.length > 0) {
      text += '⚠️ **تحذيرات:**\n';
      analysis.warnings.forEach(warning => {
        text += `  ️ ${warning}\n`;
      });
      text += '\n';
    }

    text += overallEvaluation;

    if (newsAlert && !newsAlert.includes('لا توجد أخبار')) {
      text += '\n' + newsAlert;
    }

    return text;
  }

  private getDecisionEmoji(decision: string): string {
    switch (decision) {
      case 'BUY': return '';
      case 'SELL': return '';
      default: return '🟡';
    }
  }

  private getTrendEmoji(trend: string): string {
    if (trend === 'BULLISH') return '';
    if (trend === 'BEARISH') return '🔴';
    return '';
  }

  calculateRisk(params: {
    symbol: string;
    entry: number;
    stopLoss: number;
    takeProfit: number;
    riskPercent: number;
    accountBalance: number;
  }): string {
    const riskAmount = (params.accountBalance * params.riskPercent) / 100;
    const riskPerUnit = Math.abs(params.entry - params.stopLoss);
    const positionSize = riskAmount / riskPerUnit;
    const reward = Math.abs(params.takeProfit - params.entry);
    const riskReward = reward / riskPerUnit;
    const potentialProfit = positionSize * reward;

    let text = '🧮 **حاسبة المخاطرة**\n\n';
    text += '━━━━━━━━━━━━━━━━━━━\n';
    text += `💱 **الزوج:** ${params.symbol}\n`;
    text += `💰 **الرصيد:** $${params.accountBalance.toLocaleString()}\n`;
    text += `⚠️ **المخاطرة:** ${params.riskPercent}% ($${riskAmount.toFixed(2)})\n`;
    text += '━━━━━━━━━━━━━━━━━━━\n\n';

    text += '📊 **نتائج الحساب:**\n';
    text += `• حجم الصفقة: ${positionSize.toFixed(4)} lot\n`;
    text += `• الربح المحتمل: $${potentialProfit.toFixed(2)}\n`;
    text += `• نسبة R:R: 1:${riskReward.toFixed(2)}\n\n`;

    if (riskReward >= 2) {
      text += '✅ **الصفقة مقبولة** - نسبة المخاطرة/العائد جيدة\n';
    } else if (riskReward >= 1.5) {
      text += '⚠️ **الصفقة مقبولة بحذر** - R:R متوسط\n';
    } else {
      text += ' **الصفقة غير مقبولة** - R:R ضعيف جداً\n';
    }

    return text;
  }
}