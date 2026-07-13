import { Candle } from '../smartmoney/SmartMoney';

export interface ElliottWaveAnalysis {
  currentWave: number; // 1-5 أو -1 لـ A, -2 لـ B, -3 لـ C
  waveName: string;
  direction: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  progress: number; // نسبة إكمال الموجة الحالية (0-100)
  target: number; // السعر المستهدف
  invalidationLevel: number; // مستوى إبطال التحليل
  fibonacciLevels: {
    level382: number;
    level500: number;
    level618: number;
    level1000: number;
    level1618: number;
  };
  confidence: number;
  description: string;
  recommendations: string[];
}

export class ElliottWaveAnalyzer {
  constructor() {}

  analyze(candles: Candle[]): ElliottWaveAnalysis {
    if (candles.length < 50) {
      return this.getNeutralAnalysis();
    }

    // تحديد القمم والقيعان
    const pivots = this.findPivots(candles);
    
    if (pivots.length < 5) {
      return this.getNeutralAnalysis();
    }

    // تحديد الاتجاه العام
    const trend = this.determineTrend(candles);
    
    // عد الموجات
    const waveCount = this.countWaves(pivots, trend);
    
    // حساب مستويات فيبوناتشي
    const fibLevels = this.calculateFibonacci(pivots, trend);
    
    // تحديد الموجة الحالية
    const currentWave = this.identifyCurrentWave(waveCount, candles);
    
    // حساب الهدف
    const target = this.calculateTarget(currentWave, pivots, trend, fibLevels);
    
    // حساب مستوى الإبطال
    const invalidationLevel = this.calculateInvalidation(currentWave, pivots, trend);
    
    // حساب نسبة التقدم
    const progress = this.calculateProgress(currentWave, candles, target);
    
    // حساب الثقة
    const confidence = this.calculateConfidence(waveCount, candles);
    
    // الوصف والتوصيات
    const { description, recommendations } = this.getWaveDescription(currentWave, trend);

    return {
      currentWave: currentWave.number,
      waveName: currentWave.name,
      direction: trend,
      progress,
      target,
      invalidationLevel,
      fibonacciLevels: fibLevels,
      confidence,
      description,
      recommendations,
    };
  }

  private findPivots(candles: Candle[]): { index: number; price: number; type: 'high' | 'low' }[] {
    const pivots: { index: number; price: number; type: 'high' | 'low' }[] = [];
    const lookback = 5;

    for (let i = lookback; i < candles.length - lookback; i++) {
      const currentHigh = candles[i].high;
      const currentLow = candles[i].low;
      
      let isHigh = true;
      let isLow = true;
      
      for (let j = 1; j <= lookback; j++) {
        if (candles[i - j].high >= currentHigh || candles[i + j].high >= currentHigh) {
          isHigh = false;
        }
        if (candles[i - j].low <= currentLow || candles[i + j].low <= currentLow) {
          isLow = false;
        }
      }
      
      if (isHigh) {
        pivots.push({ index: i, price: currentHigh, type: 'high' });
      }
      if (isLow) {
        pivots.push({ index: i, price: currentLow, type: 'low' });
      }
    }

    return pivots.sort((a, b) => a.index - b.index);
  }

  private determineTrend(candles: Candle[]): 'BULLISH' | 'BEARISH' | 'NEUTRAL' {
    const recent = candles.slice(-30);
    const first = recent[0].close;
    const last = recent[recent.length - 1].close;
    const change = ((last - first) / first) * 100;
    
    if (change > 3) return 'BULLISH';
    if (change < -3) return 'BEARISH';
    return 'NEUTRAL';
  }

  private countWaves(pivots: { index: number; price: number; type: 'high' | 'low' }[], trend: string): number {
    // عد بسيط للموجات بناءً على القمم والقيعان
    let waveCount = 0;
    let lastType = '';
    
    for (const pivot of pivots) {
      if (pivot.type !== lastType) {
        waveCount++;
        lastType = pivot.type;
      }
    }
    
    return Math.min(waveCount, 8); // حد أقصى 8 موجات
  }

  private identifyCurrentWave(waveCount: number, candles: Candle[]): { number: number; name: string } {
    const waveNumber = (waveCount % 5) + 1;
    const waveNames: Record<number, string> = {
      1: 'الموجة 1 - البداية',
      2: 'الموجة 2 - التصحيح',
      3: 'الموجة 3 - الأقوى',
      4: 'الموجة 4 - التصحيح',
      5: 'الموجة 5 - النهاية',
    };
    
    return {
      number: waveNumber,
      name: waveNames[waveNumber] || 'موجة غير محددة',
    };
  }

  private calculateFibonacci(pivots: { index: number; price: number; type: 'high' | 'low' }[], trend: string) {
    if (pivots.length < 2) {
      return {
        level382: 0,
        level500: 0,
        level618: 0,
        level1000: 0,
        level1618: 0,
      };
    }

    const swingHigh = Math.max(...pivots.filter(p => p.type === 'high').map(p => p.price));
    const swingLow = Math.min(...pivots.filter(p => p.type === 'low').map(p => p.price));
    const range = swingHigh - swingLow;

    if (trend === 'BULLISH') {
      return {
        level382: swingHigh - range * 0.382,
        level500: swingHigh - range * 0.5,
        level618: swingHigh - range * 0.618,
        level1000: swingLow,
        level1618: swingHigh + range * 0.618,
      };
    } else {
      return {
        level382: swingLow + range * 0.382,
        level500: swingLow + range * 0.5,
        level618: swingLow + range * 0.618,
        level1000: swingHigh,
        level1618: swingLow - range * 0.618,
      };
    }
  }

  private calculateTarget(
    currentWave: { number: number; name: string },
    pivots: { index: number; price: number; type: 'high' | 'low' }[],
    trend: string,
    fibLevels: any
  ): number {
    if (pivots.length < 2) return 0;

    const lastPrice = pivots[pivots.length - 1].price;
    
    // أهداف مختلفة حسب الموجة
    switch (currentWave.number) {
      case 1:
        return trend === 'BULLISH' ? fibLevels.level1618 : fibLevels.level1618;
      case 3:
        return trend === 'BULLISH' ? lastPrice * 1.05 : lastPrice * 0.95;
      case 5:
        return trend === 'BULLISH' ? lastPrice * 1.03 : lastPrice * 0.97;
      default:
        return trend === 'BULLISH' ? fibLevels.level1000 : fibLevels.level1000;
    }
  }

  private calculateInvalidation(
    currentWave: { number: number; name: string },
    pivots: { index: number; price: number; type: 'high' | 'low' }[],
    trend: string
  ): number {
    if (pivots.length < 2) return 0;

    const swingPoint = trend === 'BULLISH' 
      ? Math.min(...pivots.filter(p => p.type === 'low').map(p => p.price))
      : Math.max(...pivots.filter(p => p.type === 'high').map(p => p.price));

    // مستوى إبطال مختلف حسب الموجة
    switch (currentWave.number) {
      case 2:
        return swingPoint; // لا يجب أن يكسر بداية الموجة 1
      case 4:
        return swingPoint; // لا يجب أن يتداخل مع الموجة 1
      default:
        return trend === 'BULLISH' ? swingPoint * 0.99 : swingPoint * 1.01;
    }
  }

  private calculateProgress(
    currentWave: { number: number; name: string },
    candles: Candle[],
    target: number
  ): number {
    if (target === 0) return 50;

    const currentPrice = candles[candles.length - 1].close;
    const startPrice = candles[Math.max(0, candles.length - 30)].close;
    const totalMove = Math.abs(target - startPrice);
    const currentMove = Math.abs(currentPrice - startPrice);

    if (totalMove === 0) return 50;
    
    const progress = (currentMove / totalMove) * 100;
    return Math.min(100, Math.max(0, progress));
  }

  private calculateConfidence(waveCount: number, candles: Candle[]): number {
    let confidence = 50;
    
    // كلما زاد عدد الموجات المحددة، زادت الثقة
    if (waveCount >= 5) confidence += 20;
    else if (waveCount >= 3) confidence += 10;
    
    // كلما زادت البيانات، زادت الثقة
    if (candles.length >= 100) confidence += 15;
    else if (candles.length >= 50) confidence += 10;
    
    return Math.min(100, confidence);
  }

  private getWaveDescription(currentWave: { number: number; name: string }, trend: string): { description: string; recommendations: string[] } {
    const recommendations: string[] = [];
    let description = '';

    switch (currentWave.number) {
      case 1:
        description = 'بداية اتجاه جديد - فرصة دخول مبكرة';
        recommendations.push('انتظر تأكيد الانعكاس');
        recommendations.push('استخدم حجم صفقة صغير');
        recommendations.push('ضع SL ضيق');
        break;
      case 2:
        description = 'تصحيح بعد الموجة 1 - فرصة دخول ممتازة';
        recommendations.push('ابحث عن Order Block في منطقة 61.8%');
        recommendations.push('انتظر تأكيد CHOCH');
        recommendations.push('هذه من أفضل فرص الدخول');
        break;
      case 3:
        description = 'الموجة الأقوى - أفضل فرصة تداول';
        recommendations.push('دخول بثقة عالية');
        recommendations.push('استخدم حجم صفقة أكبر');
        recommendations.push('لا تفوت هذه الفرصة!');
        break;
      case 4:
        description = 'تصحيح قبل الموجة الأخيرة';
        recommendations.push('كن حذراً - التصحيح قد يكون معقداً');
        recommendations.push('انتظر انتهاء التصحيح');
        recommendations.push('لا تدخل حتى تأكيد BOS');
        break;
      case 5:
        description = 'الموجة الأخيرة - حذر من الانعكاس';
        recommendations.push('قلل حجم الصفقة');
        recommendations.push('ضع TP قريب');
        recommendations.push('استعد للانعكاس');
        break;
      default:
        description = 'موجة غير محددة';
        recommendations.push('انتظر وضوح أكثر');
    }

    return { description, recommendations };
  }

  private getNeutralAnalysis(): ElliottWaveAnalysis {
    return {
      currentWave: 0,
      waveName: 'غير محدد',
      direction: 'NEUTRAL',
      progress: 0,
      target: 0,
      invalidationLevel: 0,
      fibonacciLevels: {
        level382: 0,
        level500: 0,
        level618: 0,
        level1000: 0,
        level1618: 0,
      },
      confidence: 0,
      description: 'بيانات غير كافية لتحليل الموجات',
      recommendations: ['انتظر المزيد من البيانات'],
    };
  }

  formatAnalysis(analysis: ElliottWaveAnalysis, symbol: string): string {
    let text = `🌊 **تحليل Elliott Wave - ${symbol}**\n\n`;
    text += '━━━━━━━━━━━━━━━━━━━\n';
    text += `🌊 **الموجة الحالية:** ${analysis.waveName}\n`;
    text += `📈 **الاتجاه:** ${analysis.direction}\n`;
    text += `📊 **نسبة الإكمال:** ${analysis.progress.toFixed(0)}%\n`;
    text += `🎯 **الثقة:** ${analysis.confidence.toFixed(0)}%\n`;
    text += '━━━━━━━━━━━━━━━━━━━\n\n';

    text += '📝 **الوصف:**\n';
    text += `${analysis.description}\n\n`;

    text += '🎯 **المستويات المهمة:**\n';
    text += `• السعر المستهدف: ${analysis.target.toFixed(5)}\n`;
    text += `• مستوى الإبطال: ${analysis.invalidationLevel.toFixed(5)}\n\n`;

    text += '📐 **مستويات فيبوناتشي:**\n';
    text += `• 38.2%: ${analysis.fibonacciLevels.level382.toFixed(5)}\n`;
    text += `• 50.0%: ${analysis.fibonacciLevels.level500.toFixed(5)}\n`;
    text += `• 61.8%: ${analysis.fibonacciLevels.level618.toFixed(5)}\n`;
    text += `• 100.0%: ${analysis.fibonacciLevels.level1000.toFixed(5)}\n`;
    text += `• 161.8%: ${analysis.fibonacciLevels.level1618.toFixed(5)}\n\n`;

    if (analysis.recommendations.length > 0) {
      text += '💡 **التوصيات:**\n';
      analysis.recommendations.forEach(rec => {
        text += `• ${rec}\n`;
      });
    }

    return text;
  }
}