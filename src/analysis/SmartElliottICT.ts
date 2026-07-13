import { Candle, SmartMoneyAnalyzer } from '../smartmoney/SmartMoney';
import { ElliottWaveAnalyzer, ElliottWaveAnalysis } from '../elliott/ElliottWaveAnalyzer';
import { LiquidityAnalyzer, LiquidityAnalysis } from '../smartmoney/LiquidityAnalyzer';

export interface SmartElliottICTAnalysis {
  symbol: string;
  elliott: ElliottWaveAnalysis;
  ict: {
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
  liquidity: LiquidityAnalysis;
  combinedDecision: 'STRONG_BUY' | 'BUY' | 'NEUTRAL' | 'SELL' | 'STRONG_SELL';
  combinedConfidence: number;
  combinedStrength: number;
  entry: number;
  stopLoss: number;
  takeProfit1: number;
  takeProfit2: number;
  takeProfit3: number;
  riskReward: number;
  killZone: string;
  smartMoneyTarget: string;
  recommendations: string[];
}

export class SmartElliottICT {
  private elliott: ElliottWaveAnalyzer;
  private smc: SmartMoneyAnalyzer;
  private liquidity: LiquidityAnalyzer;

  constructor() {
    this.elliott = new ElliottWaveAnalyzer();
    this.smc = new SmartMoneyAnalyzer();
    this.liquidity = new LiquidityAnalyzer();
  }

  async analyze(symbol: string, candles: Candle[]): Promise<SmartElliottICTAnalysis> {
    const elliottAnalysis = this.elliott.analyze(candles);
    const smcAnalysis: any = this.smc.analyze(candles);
    const ictData = this.extractICTData(smcAnalysis);
    const liquidityAnalysis = this.liquidity.analyze(candles);
    
    const combined = this.combineAnalyses(elliottAnalysis, ictData, liquidityAnalysis, candles);
    const entryPoints = this.calculateOptimalEntryPoints(candles, combined, elliottAnalysis, ictData, liquidityAnalysis);
    const killZone = this.getCurrentKillZone();
    const smartMoneyTarget = this.determineSmartMoneyTarget(liquidityAnalysis);
    const recommendations = this.generateRecommendations(combined, elliottAnalysis, ictData, liquidityAnalysis);

    return {
      symbol,
      elliott: elliottAnalysis,
      ict: ictData,
      liquidity: liquidityAnalysis,
      combinedDecision: combined.decision,
      combinedConfidence: combined.confidence,
      combinedStrength: combined.strength,
      entry: entryPoints.entry,
      stopLoss: entryPoints.stopLoss,
      takeProfit1: entryPoints.takeProfit1,
      takeProfit2: entryPoints.takeProfit2,
      takeProfit3: entryPoints.takeProfit3,
      riskReward: entryPoints.riskReward,
      killZone,
      smartMoneyTarget,
      recommendations,
    };
  }

  private extractICTData(smc: any) {
    const trend = smc.trend || smc.marketStructure || smc.direction || 'NEUTRAL';
    const bos = smc.bos || {};
    const bullishBOS = bos.bullish === true || (typeof bos === 'object' && bos.bullish);
    const bearishBOS = bos.bearish === true || (typeof bos === 'object' && bos.bearish);
    const choch = smc.choch || {};
    const bullishCHOCH = choch.bullish === true || (typeof choch === 'object' && choch.bullish);
    const bearishCHOCH = choch.bearish === true || (typeof choch === 'object' && choch.bearish);
    const orderBlocks = smc.orderBlocks || {};
    const bullishOrderBlocks = Array.isArray(orderBlocks.bullish) ? orderBlocks.bullish.length : 0;
    const bearishOrderBlocks = Array.isArray(orderBlocks.bearish) ? orderBlocks.bearish.length : 0;
    const fvg = smc.fvg || {};
    const bullishFVG = Array.isArray(fvg.bullish) ? fvg.bullish.length : 0;
    const bearishFVG = Array.isArray(fvg.bearish) ? fvg.bearish.length : 0;
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

  private combineAnalyses(
    elliott: ElliottWaveAnalysis,
    ict: any,
    liquidity: LiquidityAnalysis,
    candles: Candle[]
  ): { decision: 'STRONG_BUY' | 'BUY' | 'NEUTRAL' | 'SELL' | 'STRONG_SELL'; confidence: number; strength: number } {
    let buySignals = 0;
    let sellSignals = 0;
    let totalSignals = 0;

    // Elliott
    if (elliott.direction === 'BULLISH') {
      buySignals += 2;
      if (elliott.currentWave === 3) buySignals += 2;
    } else if (elliott.direction === 'BEARISH') {
      sellSignals += 2;
      if (elliott.currentWave === 3) sellSignals += 2;
    }
    totalSignals += 3;

    // ICT
    if (ict.trend === 'BULLISH') buySignals += 1;
    else if (ict.trend === 'BEARISH') sellSignals += 1;
    totalSignals += 1;

    if (ict.bullishBOS) buySignals += 2;
    if (ict.bearishBOS) sellSignals += 2;
    totalSignals += 2;

    if (ict.bullishCHOCH) buySignals += 1;
    if (ict.bearishCHOCH) sellSignals += 1;
    totalSignals += 2;

    // ✅ LIQUIDITY ANALYSIS (جديد)
    if (liquidity.smartMoneyBias === 'BULLISH') buySignals += 3;
    else if (liquidity.smartMoneyBias === 'BEARISH') sellSignals += 3;
    totalSignals += 3;

    if (liquidity.institutionalFootprint.accumulation) buySignals += 2;
    if (liquidity.institutionalFootprint.distribution) sellSignals += 2;
    totalSignals += 2;

    const buyScore = (buySignals / totalSignals) * 100;
    const sellScore = (sellSignals / totalSignals) * 100;
    const confidence = Math.max(buyScore, sellScore);
    const strength = Math.abs(buyScore - sellScore);

    let decision: 'STRONG_BUY' | 'BUY' | 'NEUTRAL' | 'SELL' | 'STRONG_SELL';
    if (buyScore >= 70) {
      decision = buyScore >= 85 ? 'STRONG_BUY' : 'BUY';
    } else if (sellScore >= 70) {
      decision = sellScore >= 85 ? 'STRONG_SELL' : 'SELL';
    } else {
      decision = 'NEUTRAL';
    }

    return { decision, confidence: Math.min(100, confidence), strength: Math.min(100, strength) };
  }

  private calculateOptimalEntryPoints(
    candles: Candle[],
    combined: any,
    elliott: ElliottWaveAnalysis,
    ict: any,
    liquidity: LiquidityAnalysis
  ) {
    const currentPrice = candles[candles.length - 1].close;
    const atr = this.calculateATR(candles, 14);

    let entry = currentPrice;
    let stopLoss = currentPrice;
    let takeProfit1 = currentPrice;
    let takeProfit2 = currentPrice;
    let takeProfit3 = currentPrice;

    // ✅ استخدام مناطق السيولة كأهداف
    if (combined.decision === 'STRONG_BUY' || combined.decision === 'BUY') {
      entry = currentPrice;
      // SL تحت أقرب سيولة بيع
      stopLoss = liquidity.nearestSellLiquidity > 0
        ? liquidity.nearestSellLiquidity - atr * 0.5
        : currentPrice - atr * 1.5;
      // TP عند أقرب سيولة شراء
      takeProfit1 = liquidity.nearestBuyLiquidity > 0
        ? liquidity.nearestBuyLiquidity
        : currentPrice + atr * 2;
      takeProfit2 = elliott.target > 0 ? elliott.target : currentPrice + atr * 3;
      takeProfit3 = currentPrice + atr * 4;
    } else if (combined.decision === 'STRONG_SELL' || combined.decision === 'SELL') {
      entry = currentPrice;
      stopLoss = liquidity.nearestBuyLiquidity > 0
        ? liquidity.nearestBuyLiquidity + atr * 0.5
        : currentPrice + atr * 1.5;
      takeProfit1 = liquidity.nearestSellLiquidity > 0
        ? liquidity.nearestSellLiquidity
        : currentPrice - atr * 2;
      takeProfit2 = elliott.target > 0 ? elliott.target : currentPrice - atr * 3;
      takeProfit3 = currentPrice - atr * 4;
    } else {
      entry = currentPrice;
      stopLoss = currentPrice - atr;
      takeProfit1 = currentPrice + atr;
      takeProfit2 = currentPrice + atr * 1.5;
      takeProfit3 = currentPrice + atr * 2;
    }

    const risk = Math.abs(entry - stopLoss);
    const reward = Math.abs(takeProfit1 - entry);
    const riskReward = risk > 0 ? reward / risk : 0;

    return { entry, stopLoss, takeProfit1, takeProfit2, takeProfit3, riskReward };
  }

  private calculateATR(candles: Candle[], period: number): number {
    if (candles.length < period) return candles[candles.length - 1].close * 0.01;
    let atr = 0;
    for (let i = candles.length - period; i < candles.length; i++) {
      const high = candles[i].high;
      const low = candles[i].low;
      const prevClose = i > 0 ? candles[i - 1].close : candles[i].open;
      const tr = Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
      atr += tr;
    }
    return atr / period;
  }

  private getCurrentKillZone(): string {
    const now = new Date();
    const hour = now.getUTCHours();
    if (hour >= 7 && hour < 10) return '🇬🇧 London Kill Zone (07:00-10:00 GMT)';
    if (hour >= 12 && hour < 15) return '🇺🇸 New York Kill Zone (12:00-15:00 GMT)';
    if (hour >= 0 && hour < 3) return '🌏 Asian Kill Zone (00:00-03:00 GMT)';
    return '⚪ خارج Kill Zone - حذر';
  }

  // ✅ تحديد هدف Smart Money
  private determineSmartMoneyTarget(liquidity: LiquidityAnalysis): string {
    if (liquidity.smartMoneyBias === 'BULLISH' && liquidity.nearestBuyLiquidity > 0) {
      return `🎯 المؤسسات تستهدف سيولة الشراء عند ${liquidity.nearestBuyLiquidity.toFixed(5)}`;
    }
    if (liquidity.smartMoneyBias === 'BEARISH' && liquidity.nearestSellLiquidity > 0) {
      return `🎯 المؤسسات تستهدف سيولة البيع عند ${liquidity.nearestSellLiquidity.toFixed(5)}`;
    }
    return '⚖️ المؤسسات لم تحدد هدفها بعد - انتظر';
  }

  private generateRecommendations(
    combined: any,
    elliott: ElliottWaveAnalysis,
    ict: any,
    liquidity: LiquidityAnalysis
  ): string[] {
    const recommendations: string[] = [];

    // Elliott
    if (elliott.currentWave === 3) {
      recommendations.push('🌟 الموجة 3 هي الأقوى - فرصة ممتازة!');
    } else if (elliott.currentWave === 5) {
      recommendations.push('⚠️ الموجة 5 الأخيرة - حذر من الانعكاس');
    }

    // ICT
    if (ict.bullishBOS && ict.bearishBOS) {
      recommendations.push('⚠️ BOS متناقض - حذر');
    }

    // ✅ LIQUIDITY (جديد)
    if (liquidity.institutionalFootprint.accumulation) {
      recommendations.push('🏦 المؤسسات تتجمع - شراء صامت جارٍ');
    }
    if (liquidity.institutionalFootprint.distribution) {
      recommendations.push('🏦 المؤسسات توزّع - بيع صامت جارٍ');
    }
    if (liquidity.institutionalFootprint.manipulation) {
      recommendations.push('🎭 المؤسسات تتلاعب - كسر مستويات لجمع السيولة');
    }

    if (liquidity.traps.length > 0) {
      recommendations.push('⚠️ انتبه للفخاخ - ضع SL ضيق');
    }

    if (combined.decision === 'STRONG_BUY' || combined.decision === 'STRONG_SELL') {
      recommendations.push('💪 إشارة قوية - يمكنك التداول بثقة');
    } else if (combined.decision === 'NEUTRAL') {
      recommendations.push('⚠️ إشارة محايدة - انتظر وضوح أكثر');
    }

    if (this.getCurrentKillZone().includes('خارج')) {
      recommendations.push('⏰ خارج Kill Zone - تقلبات منخفضة');
    }

    // الفلسفة
    recommendations.push('🎓 تذكّر: تداول مع المؤسسات، لا ضدها');

    return recommendations;
  }

  formatAnalysis(analysis: SmartElliottICTAnalysis): string {
    let text = `🏛️ **التحليل المدمج - Elliott + ICT + Liquidity**\n`;
    text += `💱 **الزوج:** ${analysis.symbol}\n\n`;

    text += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
    text += '🌊 **Elliott Wave Analysis:**\n';
    text += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
    text += `🌊 الموجة الحالية: ${analysis.elliott.waveName}\n`;
    text += `📈 الاتجاه: ${analysis.elliott.direction}\n`;
    text += `📊 نسبة الإكمال: ${analysis.elliott.progress.toFixed(0)}%\n`;
    text += `🎯 الهدف المتوقع: ${analysis.elliott.target.toFixed(5)}\n\n`;

    text += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
    text += '🔍 **ICT (Smart Money):**\n';
    text += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
    text += `📍 الاتجاه: ${analysis.ict.trend}\n`;
    text += `🔄 BOS: ${analysis.ict.bullishBOS ? 'صاعد ✅' : analysis.ict.bearishBOS ? 'هابط 🔴' : 'لا يوجد'}\n`;
    text += `⚡ CHOCH: ${analysis.ict.bullishCHOCH ? 'صاعد ✅' : analysis.ict.bearishCHOCH ? 'هابط 🔴' : 'لا يوجد'}\n`;
    text += `📦 Order Blocks: ${analysis.ict.bullishOrderBlocks + analysis.ict.bearishOrderBlocks}\n`;
    text += `⚡ FVG: ${analysis.ict.bullishFVG + analysis.ict.bearishFVG}\n\n`;

    // ✅ LIQUIDITY SECTION (جديد)
    text += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
    text += '💎 **تحليل السيولة (Liquidity):**\n';
    text += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
    text += `🎯 اتجاه Smart Money: ${this.getBiasEmoji(analysis.liquidity.smartMoneyBias)} ${analysis.liquidity.smartMoneyBias}\n`;
    text += `📊 اختلال السيولة: ${this.getImbalanceEmoji(analysis.liquidity.liquidityImbalance)} ${analysis.liquidity.liquidityImbalance}\n`;
    text += `🏦 بصمة المؤسسات: ${analysis.liquidity.institutionalFootprint.description}\n`;
    if (analysis.liquidity.nearestBuyLiquidity > 0) {
      text += `🔝 أقرب سيولة شراء: ${analysis.liquidity.nearestBuyLiquidity.toFixed(5)}\n`;
    }
    if (analysis.liquidity.nearestSellLiquidity > 0) {
      text += `🔻 أقرب سيولة بيع: ${analysis.liquidity.nearestSellLiquidity.toFixed(5)}\n`;
    }
    text += `🎯 ${analysis.smartMoneyTarget}\n\n`;

    text += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
    text += '🎯 **القرار المدمج:**\n';
    text += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
    const decisionEmoji = this.getDecisionEmoji(analysis.combinedDecision);
    text += `${decisionEmoji} **${analysis.combinedDecision}**\n`;
    text += `💪 القوة: ${analysis.combinedStrength.toFixed(0)}/100\n`;
    text += `🎯 الثقة: ${analysis.combinedConfidence.toFixed(0)}%\n`;
    text += `📊 R:R: 1:${analysis.riskReward.toFixed(2)}\n`;
    text += `⏰ ${analysis.killZone}\n\n`;

    text += '🎯 **نقاط الدخول:**\n';
    text += `• الدخول: ${analysis.entry.toFixed(5)}\n`;
    text += `• وقف الخسارة: ${analysis.stopLoss.toFixed(5)}\n`;
    text += `• جني الربح 1: ${analysis.takeProfit1.toFixed(5)}\n`;
    text += `• جني الربح 2: ${analysis.takeProfit2.toFixed(5)}\n`;
    text += `• جني الربح 3: ${analysis.takeProfit3.toFixed(5)}\n\n`;

    if (analysis.recommendations.length > 0) {
      text += '💡 **التوصيات:**\n';
      analysis.recommendations.forEach(rec => {
        text += `• ${rec}\n`;
      });
    }

    text += '\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
    text += '🎓 **الفلسفة:**\n';
    text += 'السوق يتحرك حيث السيولة، ليس بالعشوائية.\n';
    text += 'المتداول الصغير لا يحرك السعر، بل يركب الموجة مع الكبار.\n';
    text += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━';

    return text;
  }

  private getBiasEmoji(bias: string): string {
    if (bias === 'BULLISH') return '🟢';
    if (bias === 'BEARISH') return '🔴';
    return '🟡';
  }

  private getImbalanceEmoji(imbalance: string): string {
    if (imbalance === 'BUY_HEAVY') return '📈';
    if (imbalance === 'SELL_HEAVY') return '📉';
    return '⚖️';
  }

  private getDecisionEmoji(decision: string): string {
    switch (decision) {
      case 'STRONG_BUY': return '🟢🟢';
      case 'BUY': return '🟢';
      case 'SELL': return '🔴';
      case 'STRONG_SELL': return '🔴🔴';
      default: return '🟡';
    }
  }
}