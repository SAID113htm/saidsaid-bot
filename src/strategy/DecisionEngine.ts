import { MarketData } from '../data/PriceProvider';
import { NewsItem } from '../data/NewsRSSProvider';

export interface TradingSignal {
  symbol: string;
  direction: 'STRONG_BUY' | 'BUY' | 'NEUTRAL' | 'SELL' | 'STRONG_SELL';
  score: number;
  confidence: number;
  entry: number;
  stopLoss: number;
  takeProfit1: number;
  takeProfit2: number;
  takeProfit3: number;
  riskRewardRatio: number;
  reasons: string[];
  warnings: string[];
  timeframeBreakdown: {
    MN: string;
    W1: string;
    D1: string;
    H4: string;
    H1: string;
  };
  smcDetails: string[];
  timestamp: Date;
}

export class DecisionEngine {
  // أوزان الفريمات
  private timeframeWeights = {
    MN: 0.40,  // 40%
    W1: 0.30,  // 30%
    D1: 0.20,  // 20%
    H4: 0.10,  // 10%
  };

  // الحد الأدنى المقبول لـ R:R
  private minRiskRewardRatio = 2.0;

  analyze(
    marketData: MarketData,
    smartMoneyAnalysis: any,
    news: NewsItem[]
  ): TradingSignal {
    let totalScore = 0;
    const reasons: string[] = [];
    const warnings: string[] = [];
    const smcDetails: string[] = [];

    // 1. تحليل الاتجاه متعدد الفريمات مع الترجيح
    const mtfResult = this.analyzeMTFWeighted(marketData);
    totalScore += mtfResult.score;
    reasons.push(...mtfResult.reasons);

    // 2. تحليل Smart Money مع تحديد الفريم
    const smcResult = this.analyzeSMCDetailed(smartMoneyAnalysis, marketData);
    totalScore += smcResult.score;
    reasons.push(...smcResult.reasons);
    smcDetails.push(...smcResult.details);

    // 3. تحليل الزخم
    const momentumResult = this.analyzeMomentum(marketData);
    totalScore += momentumResult.score;
    reasons.push(...momentumResult.reasons);

    // 4. تحليل الأخبار
    const newsResult = this.analyzeNews(marketData.symbol, news);
    totalScore += newsResult.score;
    if (newsResult.warnings.length > 0) {
      warnings.push(...newsResult.warnings);
    }

    // فلترة: إذا كانت الفريمات الكبرى مخالفة، اخفض الثقة
    const majorTrends = [mtfResult.timeframeBreakdown.MN, mtfResult.timeframeBreakdown.W1];
    const minorTrend = mtfResult.timeframeBreakdown.H1;
    
    if (majorTrends.every(t => t === 'BEARISH') && minorTrend === 'BULLISH') {
      warnings.push('⚠️ الفريمات الكبرى هابطة - الصعود الحالي مجرد ارتداد');
      if (totalScore > 0) totalScore *= 0.3; // خفض 70%
    }
    
    if (majorTrends.every(t => t === 'BULLISH') && minorTrend === 'BEARISH') {
      warnings.push('⚠️ الفريمات الكبرى صاعدة - الهبوط الحالي مجرد تصحيح');
      if (totalScore < 0) totalScore *= 0.3;
    }

    // تحديد الاتجاه
    const direction = this.getDirection(totalScore);

    // حساب الثقة
    const confidence = this.calculateConfidence(totalScore, reasons.length, warnings.length);

    // حساب المستويات
    const levels = this.calculateLevels(marketData, direction);

    // فلتر R:R
    if (levels.rr < this.minRiskRewardRatio) {
      warnings.push(`⚠️ نسبة R:R (${levels.rr.toFixed(2)}) أقل من الحد الأدنى (${this.minRiskRewardRatio})`);
      if (direction !== 'NEUTRAL') {
        warnings.push('❌ الصفقة غير مقبولة - R:R ضعيف');
      }
    }

    return {
      symbol: marketData.symbol,
      direction,
      score: Math.round(totalScore),
      confidence: Math.round(confidence),
      entry: levels.entry,
      stopLoss: levels.stopLoss,
      takeProfit1: levels.tp1,
      takeProfit2: levels.tp2,
      takeProfit3: levels.tp3,
      riskRewardRatio: levels.rr,
      reasons,
      warnings,
      timeframeBreakdown: mtfResult.timeframeBreakdown,
      smcDetails,
      timestamp: new Date(),
    };
  }

  private analyzeMTFWeighted(data: MarketData): { 
    score: number; 
    reasons: string[];
    timeframeBreakdown: { MN: string; W1: string; D1: string; H4: string; H1: string };
  } {
    let score = 0;
    const reasons: string[] = [];

    const trends = {
      MN: this.getTrend(data.candles.MN),
      W1: this.getTrend(data.candles.W1),
      D1: this.getTrend(data.candles.D1),
      H4: this.getTrend(data.candles.H4),
      H1: this.getTrend(data.candles.H1),
    };

    // تطبيق الأوزان
    const mnScore = trends.MN === 'BULLISH' ? 10 : trends.MN === 'BEARISH' ? -10 : 0;
    const w1Score = trends.W1 === 'BULLISH' ? 10 : trends.W1 === 'BEARISH' ? -10 : 0;
    const d1Score = trends.D1 === 'BULLISH' ? 10 : trends.D1 === 'BEARISH' ? -10 : 0;
    const h4Score = trends.H4 === 'BULLISH' ? 10 : trends.H4 === 'BEARISH' ? -10 : 0;
    const h1Score = trends.H1 === 'BULLISH' ? 10 : trends.H1 === 'BEARISH' ? -10 : 0;

    score += mnScore * this.timeframeWeights.MN;
    score += w1Score * this.timeframeWeights.W1;
    score += d1Score * this.timeframeWeights.D1;
    score += h4Score * this.timeframeWeights.H4;
    score += h1Score * 0.05; // H1 وزن خفيف

    // عرض الاتجاهات
    const trendEmoji = { BULLISH: '🟢', BEARISH: '🔴', NEUTRAL: '🟡' };
    const trendText = { BULLISH: 'صاعد', BEARISH: 'هابط', NEUTRAL: 'جانبي' };

    reasons.push(`${trendEmoji[trends.MN]} الاتجاه الشهري (MN): ${trendText[trends.MN]} - الوزن 40%`);
    reasons.push(`${trendEmoji[trends.W1]} الاتجاه الأسبوعي (W1): ${trendText[trends.W1]} - الوزن 30%`);
    reasons.push(`${trendEmoji[trends.D1]} الاتجاه اليومي (D1): ${trendText[trends.D1]} - الوزن 20%`);
    reasons.push(`${trendEmoji[trends.H4]} H4: ${trendText[trends.H4]} - الوزن 10%`);
    reasons.push(`${trendEmoji[trends.H1]} H1: ${trendText[trends.H1]}`);

    // مكافأة التوافق
    const bullishCount = Object.values(trends).filter(t => t === 'BULLISH').length;
    const bearishCount = Object.values(trends).filter(t => t === 'BEARISH').length;

    if (bullishCount >= 4) {
      score += 15;
      reasons.push(`✅ توافق قوي بين الفريمات (${bullishCount}/5 صاعد)`);
    } else if (bearishCount >= 4) {
      score -= 15;
      reasons.push(`✅ توافق قوي بين الفريمات (${bearishCount}/5 هابط)`);
    }

    return { 
      score, 
      reasons,
      timeframeBreakdown: trends
    };
  }

  private analyzeSMCDetailed(smc: any, marketData: MarketData): { 
    score: number; 
    reasons: string[];
    details: string[];
  } {
    let score = 0;
    const reasons: string[] = [];
    const details: string[] = [];

    if (!smc) {
      return { score: 0, reasons: ['⚠️ لا يوجد تحليل SMC'], details: [] };
    }

    // تحديد الفريم الأفضل لـ SMC (D1)
    const d1Trend = this.getTrend(marketData.candles.D1);
    const h4Trend = this.getTrend(marketData.candles.H4);

    // هيكل السوق
    if (smc.structure === 'BULLISH') {
      score += 8;
      details.push(` هيكل السوق صاعد (HH + HL) - الفريم: D1`);
    } else if (smc.structure === 'BEARISH') {
      score -= 8;
      details.push(`🔴 هيكل السوق هابط (LH + LL) - الفريم: D1`);
    }

    // BOS
    if (smc.bos?.bullish) {
      score += 6;
      details.push(`✅ BOS صاعد - كسر هيكل - الفريم: H4`);
    }
    if (smc.bos?.bearish) {
      score -= 6;
      details.push(` BOS هابط - كسر هيكل - الفريم: H4`);
    }

    // CHOCH
    if (smc.choch?.bullish) {
      score += 5;
      details.push(`✅ CHOCH صاعد - تغير اتجاه - الفريم: H1`);
    }
    if (smc.choch?.bearish) {
      score -= 5;
      details.push(`🔻 CHOCH هابط - تغير اتجاه - الفريم: H1`);
    }

    // Order Blocks
    if (smc.orderBlocks?.bullish?.length > 0) {
      score += 4;
      details.push(`📍 ${smc.orderBlocks.bullish.length} Order Block صاعد نشط - الفريم: D1`);
    }
    if (smc.orderBlocks?.bearish?.length > 0) {
      score -= 4;
      details.push(`📍 ${smc.orderBlocks.bearish.length} Order Block هابط نشط - الفريم: D1`);
    }

    // FVG
    if (smc.fvg?.bullish?.length > 0) {
      score += 3;
      details.push(`⚡ ${smc.fvg.bullish.length} FVG صاعد (فجوة) - الفريم: H4`);
    }
    if (smc.fvg?.bearish?.length > 0) {
      score -= 3;
      details.push(`⚡ ${smc.fvg.bearish.length} FVG هابط (فجوة) - الفريم: H4`);
    }

    // Liquidity Sweeps
    if (smc.liquiditySweeps?.length > 0) {
      details.push(`💧 ${smc.liquiditySweeps.length} Liquidity Sweep - الفريم: H1`);
    }

    return { score, reasons: details, details };
  }

  private analyzeMomentum(data: MarketData): { score: number; reasons: string[] } {
    let score = 0;
    const reasons: string[] = [];

    const rsi = this.calculateRSI(data.candles.D1);
    
    if (rsi < 30) {
      score += 8;
      reasons.push(`📈 RSI في ذروة بيع (${rsi.toFixed(1)}) - انعكاس محتمل`);
    } else if (rsi > 70) {
      score -= 8;
      reasons.push(` RSI في ذروة شراء (${rsi.toFixed(1)}) - تصحيح محتمل`);
    } else if (rsi > 55 && rsi < 70) {
      score += 3;
      reasons.push(`📈 RSI إيجابي (${rsi.toFixed(1)})`);
    } else if (rsi < 45 && rsi > 30) {
      score -= 3;
      reasons.push(` RSI سلبي (${rsi.toFixed(1)})`);
    } else {
      reasons.push(`⚖️ RSI متعادل (${rsi.toFixed(1)})`);
    }

    const change24h = data.change24h;
    if (change24h > 2) {
      score += 5;
      reasons.push(`🚀 ارتفاع 24 ساعة: +${change24h.toFixed(2)}%`);
    } else if (change24h < -2) {
      score -= 5;
      reasons.push(`📉 هبوط 24 ساعة: ${change24h.toFixed(2)}%`);
    }

    return { score, reasons };
  }

  private analyzeNews(symbol: string, news: NewsItem[]): { score: number; warnings: string[] } {
    let score = 0;
    const warnings: string[] = [];

    if (news.length === 0) {
      return { score: 0, warnings: [] };
    }

    const highImpact = news.filter(n => n.impact === 'HIGH').length;
    
    if (highImpact > 0) {
      warnings.push(`⚠️ ${highImpact} أخبار عالية التأثير قريبة`);
      score -= highImpact * 5;
    }

    return { score, warnings };
  }

  private getTrend(candles: any[]): 'BULLISH' | 'BEARISH' | 'NEUTRAL' {
    if (candles.length < 10) return 'NEUTRAL';
    const recent = candles.slice(0, 5);
    const older = candles.slice(5, 10);
    const recentAvg = recent.reduce((s, c) => s + c.close, 0) / recent.length;
    const olderAvg = older.reduce((s, c) => s + c.close, 0) / older.length;
    const change = ((recentAvg - olderAvg) / olderAvg) * 100;
    if (change > 0.5) return 'BULLISH';
    if (change < -0.5) return 'BEARISH';
    return 'NEUTRAL';
  }

  private calculateRSI(candles: any[], period: number = 14): number {
    if (candles.length < period + 1) return 50;
    let gains = 0, losses = 0;
    for (let i = 1; i <= period; i++) {
      const change = candles[i - 1].close - candles[i].close;
      if (change > 0) gains += change;
      else losses += Math.abs(change);
    }
    const avgGain = gains / period;
    const avgLoss = losses / period;
    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  }

  private getDirection(score: number): TradingSignal['direction'] {
    if (score >= 40) return 'STRONG_BUY';
    if (score >= 15) return 'BUY';
    if (score <= -40) return 'STRONG_SELL';
    if (score <= -15) return 'SELL';
    return 'NEUTRAL';
  }

  private calculateConfidence(score: number, reasonsCount: number, warningsCount: number): number {
    const baseConfidence = Math.min(Math.abs(score), 80);
    const reasonsBonus = Math.min(reasonsCount * 2, 15);
    const warningsPenalty = warningsCount * 5;
    return Math.max(0, Math.min(100, baseConfidence + reasonsBonus - warningsPenalty));
  }

  private calculateLevels(data: MarketData, direction: string) {
    const price = data.currentPrice;
    const atr = this.calculateATR(data.candles.D1, 14);
    
    let entry, stopLoss, tp1, tp2, tp3;

    if (direction === 'STRONG_BUY' || direction === 'BUY') {
      entry = price;
      stopLoss = price - (atr * 1.5);
      tp1 = price + (atr * 1);
      tp2 = price + (atr * 2);
      tp3 = price + (atr * 3);
    } else if (direction === 'STRONG_SELL' || direction === 'SELL') {
      entry = price;
      stopLoss = price + (atr * 1.5);
      tp1 = price - (atr * 1);
      tp2 = price - (atr * 2);
      tp3 = price - (atr * 3);
    } else {
      entry = price;
      stopLoss = price;
      tp1 = price;
      tp2 = price;
      tp3 = price;
    }

    const risk = Math.abs(entry - stopLoss);
    const reward = Math.abs(tp2 - entry);
    const rr = risk > 0 ? reward / risk : 0;

    return { entry, stopLoss, tp1, tp2, tp3, rr };
  }

  private calculateATR(candles: any[], period: number): number {
    if (candles.length < period) return 0.001;
    const trs = [];
    for (let i = 1; i <= period; i++) {
      const c = candles[i - 1];
      const prev = candles[i];
      const tr = Math.max(
        c.high - c.low,
        Math.abs(c.high - prev.close),
        Math.abs(c.low - prev.close)
      );
      trs.push(tr);
    }
    return trs.reduce((s, t) => s + t, 0) / period;
  }
}