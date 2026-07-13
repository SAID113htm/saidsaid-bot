import { Candle } from './SmartMoney';

export interface LiquidityZone {
  type: 'BUY_SIDE' | 'SELL_SIDE';
  price: number;
  strength: number;
  description: string;
  swept: boolean;
  timestamp: string;
}

export interface Inducement {
  type: 'BULLISH' | 'BEARISH';
  price: number;
  description: string;
  target: number;
}

export interface LiquidityAnalysis {
  buySideLiquidity: LiquidityZone[];
  sellSideLiquidity: LiquidityZone[];
  totalBuySideLiquidity: number;
  totalSellSideLiquidity: number;
  liquidityImbalance: 'BUY_HEAVY' | 'SELL_HEAVY' | 'BALANCED';
  currentPrice: number;
  nearestBuyLiquidity: number;
  nearestSellLiquidity: number;
  inducements: Inducement[];
  institutionalFootprint: {
    accumulation: boolean;
    distribution: boolean;
    manipulation: boolean;
    description: string;
  };
  smartMoneyBias: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  likelyDirection: string;
  traps: string[];
  recommendations: string[];
}

export class LiquidityAnalyzer {
  constructor() {}

  analyze(candles: Candle[]): LiquidityAnalysis {
    if (candles.length < 30) {
      return this.getEmptyAnalysis();
    }

    const currentPrice = candles[candles.length - 1].close;
    const buySideLiquidity = this.findBuySideLiquidity(candles);
    const sellSideLiquidity = this.findSellSideLiquidity(candles);
    const totalBuySide = buySideLiquidity.reduce((sum, z) => sum + z.strength, 0);
    const totalSellSide = sellSideLiquidity.reduce((sum, z) => sum + z.strength, 0);

    let imbalance: 'BUY_HEAVY' | 'SELL_HEAVY' | 'BALANCED';
    if (totalBuySide > totalSellSide * 1.3) imbalance = 'BUY_HEAVY';
    else if (totalSellSide > totalBuySide * 1.3) imbalance = 'SELL_HEAVY';
    else imbalance = 'BALANCED';

    const nearestBuy = this.findNearestLiquidity(buySideLiquidity, currentPrice, 'above');
    const nearestSell = this.findNearestLiquidity(sellSideLiquidity, currentPrice, 'below');
    const inducements = this.findInducements(candles);
    const institutionalFootprint = this.analyzeInstitutionalFootprint(candles);
    const smartMoneyBias = this.determineSmartMoneyBias(
      imbalance,
      institutionalFootprint,
      buySideLiquidity,
      sellSideLiquidity,
      currentPrice
    );
    const likelyDirection = this.predictLikelyDirection(
      smartMoneyBias,
      nearestBuy,
      nearestSell,
      currentPrice
    );
    const traps = this.identifyTraps(candles, buySideLiquidity, sellSideLiquidity);
    const recommendations = this.generateRecommendations(
      smartMoneyBias,
      nearestBuy,
      nearestSell,
      currentPrice,
      traps
    );

    return {
      buySideLiquidity,
      sellSideLiquidity,
      totalBuySideLiquidity: totalBuySide,
      totalSellSideLiquidity: totalSellSide,
      liquidityImbalance: imbalance,
      currentPrice,
      nearestBuyLiquidity: nearestBuy,
      nearestSellLiquidity: nearestSell,
      inducements,
      institutionalFootprint,
      smartMoneyBias,
      likelyDirection,
      traps,
      recommendations,
    };
  }

  private findBuySideLiquidity(candles: Candle[]): LiquidityZone[] {
    const zones: LiquidityZone[] = [];
    const lookback = 5;

    for (let i = lookback; i < candles.length - lookback; i++) {
      const high = candles[i].high;
      let isSwingHigh = true;

      for (let j = 1; j <= lookback; j++) {
        if (candles[i - j].high >= high || candles[i + j].high >= high) {
          isSwingHigh = false;
          break;
        }
      }

      if (isSwingHigh) {
        const touches = this.countTouches(candles, high, 'high', 0.001);
        const strength = Math.min(100, touches * 25);

        zones.push({
          type: 'BUY_SIDE',
          price: high,
          strength,
          description: `قمة واضحة عند ${high.toFixed(5)} - سيولة شراء (Stop Losses البائعين)`,
          swept: this.isSwept(candles, i, high, 'above'),
          timestamp: candles[i].time,
        });
      }
    }

    return zones.sort((a, b) => b.strength - a.strength).slice(0, 5);
  }

  private findSellSideLiquidity(candles: Candle[]): LiquidityZone[] {
    const zones: LiquidityZone[] = [];
    const lookback = 5;

    for (let i = lookback; i < candles.length - lookback; i++) {
      const low = candles[i].low;
      let isSwingLow = true;

      for (let j = 1; j <= lookback; j++) {
        if (candles[i - j].low <= low || candles[i + j].low <= low) {
          isSwingLow = false;
          break;
        }
      }

      if (isSwingLow) {
        const touches = this.countTouches(candles, low, 'low', 0.001);
        const strength = Math.min(100, touches * 25);

        zones.push({
          type: 'SELL_SIDE',
          price: low,
          strength,
          description: `قاع واضح عند ${low.toFixed(5)} - سيولة بيع (Stop Losses المشترين)`,
          swept: this.isSwept(candles, i, low, 'below'),
          timestamp: candles[i].time,
        });
      }
    }

    return zones.sort((a, b) => b.strength - a.strength).slice(0, 5);
  }

  private countTouches(candles: Candle[], level: number, type: 'high' | 'low', tolerance: number): number {
    let touches = 0;
    for (const candle of candles) {
      const price = type === 'high' ? candle.high : candle.low;
      if (Math.abs(price - level) / level <= tolerance) {
        touches++;
      }
    }
    return touches;
  }

  private isSwept(candles: Candle[], index: number, level: number, direction: 'above' | 'below'): boolean {
    for (let i = index + 1; i < candles.length; i++) {
      if (direction === 'above' && candles[i].high > level) return true;
      if (direction === 'below' && candles[i].low < level) return true;
    }
    return false;
  }

  private findNearestLiquidity(
    zones: LiquidityZone[],
    currentPrice: number,
    direction: 'above' | 'below'
  ): number {
    const relevant = zones.filter(z =>
      direction === 'above' ? z.price > currentPrice : z.price < currentPrice
    );

    if (relevant.length === 0) return 0;

    return direction === 'above'
      ? Math.min(...relevant.map(z => z.price))
      : Math.max(...relevant.map(z => z.price));
  }

  private findInducements(candles: Candle[]): Inducement[] {
    const inducements: Inducement[] = [];
    const recent = candles.slice(-20);

    for (let i = 2; i < recent.length - 2; i++) {
      const prev = recent[i - 1];
      const curr = recent[i];
      const next = recent[i + 1];

      if (curr.high > prev.high && curr.high > next.high && next.close < curr.high) {
        inducements.push({
          type: 'BULLISH',
          price: curr.high,
          description: 'إغراء صاعد - قمة صغيرة قد يتم كسرها لجذب المشترين',
          target: curr.low,
        });
      }

      if (curr.low < prev.low && curr.low < next.low && next.close > curr.low) {
        inducements.push({
          type: 'BEARISH',
          price: curr.low,
          description: 'إغراء هابط - قاع صغير قد يتم كسره لجذب البائعين',
          target: curr.high,
        });
      }
    }

    return inducements.slice(0, 3);
  }

  private analyzeInstitutionalFootprint(candles: Candle[]): {
    accumulation: boolean;
    distribution: boolean;
    manipulation: boolean;
    description: string;
  } {
    const recent = candles.slice(-30);
    const volumes = recent.map(c => c.volume);
    const avgVolume = volumes.reduce((a, b) => a + b, 0) / volumes.length;

    const unusualCandles = recent.filter(c =>
      c.volume > avgVolume * 1.5 &&
      Math.abs(c.close - c.open) / c.open < 0.005
    );

    const lows = recent.slice(-10).map(c => c.low);
    const recentLow = Math.min(...lows);
    const accumulationCandles = unusualCandles.filter(c =>
      c.low <= recentLow * 1.02 && c.close > c.open
    );

    const highs = recent.slice(-10).map(c => c.high);
    const recentHigh = Math.max(...highs);
    const distributionCandles = unusualCandles.filter(c =>
      c.high >= recentHigh * 0.98 && c.close < c.open
    );

    const manipulationCandles = recent.filter(c => {
      const range = c.high - c.low;
      const body = Math.abs(c.close - c.open);
      return range > body * 2 && c.volume > avgVolume * 1.3;
    });

    const accumulation = accumulationCandles.length >= 2;
    const distribution = distributionCandles.length >= 2;
    const manipulation = manipulationCandles.length >= 2;

    let description = '';
    if (accumulation) {
      description = '🏦 المؤسسات في مرحلة تجميع (Accumulation) - شراء صامت في القاع';
    } else if (distribution) {
      description = '🏦 المؤسسات في مرحلة توزيع (Distribution) - بيع صامت في القمة';
    } else if (manipulation) {
      description = '🎭 المؤسسات في مرحلة تلاعب (Manipulation) - كسر مستويات لجمع السيولة';
    } else {
      description = '📊 لا توجد بصمة مؤسسات واضحة حالياً';
    }

    return { accumulation, distribution, manipulation, description };
  }

  private determineSmartMoneyBias(
    imbalance: string,
    footprint: any,
    buyLiquidity: LiquidityZone[],
    sellLiquidity: LiquidityZone[],
    currentPrice: number
  ): 'BULLISH' | 'BEARISH' | 'NEUTRAL' {
    let bullishScore = 0;
    let bearishScore = 0;

    if (imbalance === 'SELL_HEAVY') {
      bullishScore += 2;
    } else if (imbalance === 'BUY_HEAVY') {
      bearishScore += 2;
    }

    if (footprint.accumulation) bullishScore += 3;
    if (footprint.distribution) bearishScore += 3;
    if (footprint.manipulation) {
      if (currentPrice < (buyLiquidity[0]?.price || currentPrice)) {
        bullishScore += 2;
      } else {
        bearishScore += 2;
      }
    }

    const nearestBuy = buyLiquidity.length > 0 ? buyLiquidity[0].price : 0;
    const nearestSell = sellLiquidity.length > 0 ? sellLiquidity[0].price : 0;

    if (nearestBuy > 0 && Math.abs(currentPrice - nearestBuy) / currentPrice < 0.01) {
      bearishScore += 2;
    }
    if (nearestSell > 0 && Math.abs(currentPrice - nearestSell) / currentPrice < 0.01) {
      bullishScore += 2;
    }

    if (bullishScore > bearishScore + 2) return 'BULLISH';
    if (bearishScore > bullishScore + 2) return 'BEARISH';
    return 'NEUTRAL';
  }

  private predictLikelyDirection(
    bias: string,
    nearestBuy: number,
    nearestSell: number,
    currentPrice: number
  ): string {
    if (bias === 'BULLISH') {
      if (nearestBuy > 0) {
        return `📈 صاعد - الهدف: سيولة الشراء عند ${nearestBuy.toFixed(5)}`;
      }
      return '📈 صاعد - المؤسسات تفضل الشراء';
    }
    if (bias === 'BEARISH') {
      if (nearestSell > 0) {
        return `📉 هابط - الهدف: سيولة البيع عند ${nearestSell.toFixed(5)}`;
      }
      return '📉 هابط - المؤسسات تفضل البيع';
    }
    return '⚖️ محايد - انتظر وضوح الاتجاه';
  }

  private identifyTraps(
    candles: Candle[],
    buyLiquidity: LiquidityZone[],
    sellLiquidity: LiquidityZone[]
  ): string[] {
    const traps: string[] = [];
    const currentPrice = candles[candles.length - 1].close;

    const recentHighs = candles.slice(-10);
    const maxHigh = Math.max(...recentHighs.map(c => c.high));
    if (currentPrice > maxHigh * 0.995) {
      traps.push('⚠️ فخ صاعد محتمل - السعر قريب من قمة حديثة، قد يكون إغراء');
    }

    const minLow = Math.min(...recentHighs.map(c => c.low));
    if (currentPrice < minLow * 1.005) {
      traps.push('⚠️ فخ هابط محتمل - السعر قريب من قاع حديث، قد يكون إغراء');
    }

    buyLiquidity.forEach(z => {
      if (Math.abs(currentPrice - z.price) / currentPrice < 0.005 && z.swept) {
        traps.push(`🎯 تم كسح سيولة الشراء عند ${z.price.toFixed(5)} - انعكاس محتمل`);
      }
    });

    sellLiquidity.forEach(z => {
      if (Math.abs(currentPrice - z.price) / currentPrice < 0.005 && z.swept) {
        traps.push(`🎯 تم كسح سيولة البيع عند ${z.price.toFixed(5)} - انعكاس محتمل`);
      }
    });

    return traps.slice(0, 3);
  }

  private generateRecommendations(
    bias: string,
    nearestBuy: number,
    nearestSell: number,
    currentPrice: number,
    traps: string[]
  ): string[] {
    const recs: string[] = [];

    if (bias === 'BULLISH') {
      recs.push('🟢 Smart Money يميل للشراء - ابحث عن فرص BUY');
      if (nearestSell > 0) {
        recs.push(`🎯 انتظر كسر سيولة البيع عند ${nearestSell.toFixed(5)} ثم ادخل BUY`);
      }
      recs.push('💡 ادخل بعد تأكيد BOS صاعد على H1/H4');
    } else if (bias === 'BEARISH') {
      recs.push('🔴 Smart Money يميل للبيع - ابحث عن فرص SELL');
      if (nearestBuy > 0) {
        recs.push(`🎯 انتظر كسر سيولة الشراء عند ${nearestBuy.toFixed(5)} ثم ادخل SELL`);
      }
      recs.push('💡 ادخل بعد تأكيد BOS هابط على H1/H4');
    } else {
      recs.push('⚠️ Smart Money محايد - انتظر وضوح الاتجاه');
      recs.push('💡 لا تدخل صفقات حتى تتحدد مناطق السيولة المستهدفة');
    }

    if (traps.length > 0) {
      recs.push('⚠️ انتبه للفخاخ المحتملة - ضع SL ضيق');
    }

    recs.push('🎓 تذكّر: تداول مع المؤسسات، ليس ضدها');

    return recs;
  }

  private getEmptyAnalysis(): LiquidityAnalysis {
    return {
      buySideLiquidity: [],
      sellSideLiquidity: [],
      totalBuySideLiquidity: 0,
      totalSellSideLiquidity: 0,
      liquidityImbalance: 'BALANCED',
      currentPrice: 0,
      nearestBuyLiquidity: 0,
      nearestSellLiquidity: 0,
      inducements: [],
      institutionalFootprint: {
        accumulation: false,
        distribution: false,
        manipulation: false,
        description: 'بيانات غير كافية',
      },
      smartMoneyBias: 'NEUTRAL',
      likelyDirection: '⚖️ محايد',
      traps: [],
      recommendations: ['انتظر المزيد من البيانات'],
    };
  }

  formatAnalysis(analysis: LiquidityAnalysis, symbol: string): string {
    let text = `💎 **تحليل السيولة - ${symbol}**\n\n`;
    text += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
    text += `💰 **السعر الحالي:** ${analysis.currentPrice.toFixed(5)}\n`;
    text += `🎯 **اتجاه Smart Money:** ${this.getBiasEmoji(analysis.smartMoneyBias)} ${analysis.smartMoneyBias}\n`;
    text += `📊 **اختلال السيولة:** ${this.getImbalanceEmoji(analysis.liquidityImbalance)} ${analysis.liquidityImbalance}\n`;
    text += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n';

    text += '🏦 **بصمة المؤسسات:**\n';
    text += `${analysis.institutionalFootprint.description}\n`;
    text += `• تجميع (Accumulation): ${analysis.institutionalFootprint.accumulation ? '✅ نعم' : '❌ لا'}\n`;
    text += `• توزيع (Distribution): ${analysis.institutionalFootprint.distribution ? '✅ نعم' : '❌ لا'}\n`;
    text += `• تلاعب (Manipulation): ${analysis.institutionalFootprint.manipulation ? '✅ نعم' : '❌ لا'}\n\n`;

    text += '💰 **مناطق السيولة:**\n';
    text += `📊 إجمالي سيولة الشراء: ${analysis.totalBuySideLiquidity}\n`;
    text += `📊 إجمالي سيولة البيع: ${analysis.totalSellSideLiquidity}\n\n`;

    if (analysis.nearestBuyLiquidity > 0) {
      text += `🎯 أقرب سيولة شراء (فوق): ${analysis.nearestBuyLiquidity.toFixed(5)}\n`;
    }
    if (analysis.nearestSellLiquidity > 0) {
      text += `🎯 أقرب سيولة بيع (تحت): ${analysis.nearestSellLiquidity.toFixed(5)}\n`;
    }
    text += '\n';

    if (analysis.buySideLiquidity.length > 0) {
      text += '🔝 **سيولة جانب الشراء (القمم):**\n';
      analysis.buySideLiquidity.slice(0, 3).forEach((z, i) => {
        const status = z.swept ? '✅ مكسوحة' : '🎯 مستهدفة';
        text += `  ${i + 1}. ${z.price.toFixed(5)} - قوة: ${z.strength}% - ${status}\n`;
      });
      text += '\n';
    }

    if (analysis.sellSideLiquidity.length > 0) {
      text += '🔻 **سيولة جانب البيع (القيعان):**\n';
      analysis.sellSideLiquidity.slice(0, 3).forEach((z, i) => {
        const status = z.swept ? '✅ مكسوحة' : '🎯 مستهدفة';
        text += `  ${i + 1}. ${z.price.toFixed(5)} - قوة: ${z.strength}% - ${status}\n`;
      });
      text += '\n';
    }

    if (analysis.inducements.length > 0) {
      text += '🎣 **الإغراءات (Inducements):**\n';
      analysis.inducements.forEach(ind => {
        text += `• ${ind.description}\n`;
        text += `  السعر: ${ind.price.toFixed(5)} → الهدف: ${ind.target.toFixed(5)}\n`;
      });
      text += '\n';
    }

    text += '🎯 **الاتجاه المحتمل:**\n';
    text += `${analysis.likelyDirection}\n\n`;

    if (analysis.traps.length > 0) {
      text += '⚠️ **الفخاخ المحتملة:**\n';
      analysis.traps.forEach(trap => {
        text += `• ${trap}\n`;
      });
      text += '\n';
    }

    if (analysis.recommendations.length > 0) {
      text += '💡 **التوصيات:**\n';
      analysis.recommendations.forEach(rec => {
        text += `• ${rec}\n`;
      });
    }

    text += '\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
    text += '🎓 **الفلسفة:**\n';
    text += 'السوق يتحرك حيث السيولة، وليس بالعشوائية.\n';
    text += 'تداول مع المؤسسات، لا ضدها.\n';
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
}