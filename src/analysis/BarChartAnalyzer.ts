import { Candle } from '../smartmoney/SmartMoney';

export interface BarPattern {
  pattern: string;
  direction: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  confidence: number;
  description: string;
  location: number;
}

export class BarChartAnalyzer {
  analyze(candles: Candle[]): BarPattern[] {
    const patterns: BarPattern[] = [];

    if (candles.length < 5) return patterns;

    // تحليل آخر 5 شموع
    const recent = candles.slice(0, 5);

    // 1. Pin Bar (Shooting Star / Hammer)
    const pinBar = this.detectPinBar(recent);
    if (pinBar) patterns.push(pinBar);

    // 2. Engulfing Pattern
    const engulfing = this.detectEngulfing(recent);
    if (engulfing) patterns.push(engulfing);

    // 3. Doji
    const doji = this.detectDoji(recent[0]);
    if (doji) patterns.push(doji);

    // 4. Morning/Evening Star
    const star = this.detectStarPattern(recent);
    if (star) patterns.push(star);

    // 5. Three White Soldiers / Three Black Crows
    const soldiers = this.detectThreeSoldiers(recent);
    if (soldiers) patterns.push(soldiers);

    return patterns;
  }

  private detectPinBar(candles: Candle[]): BarPattern | null {
    const candle = candles[0];
    const body = Math.abs(candle.close - candle.open);
    const upperShadow = candle.high - Math.max(candle.open, candle.close);
    const lowerShadow = Math.min(candle.open, candle.close) - candle.low;
    const totalRange = candle.high - candle.low;

    if (totalRange === 0) return null;

    // Pin Bar صاعد (Hammer)
    if (lowerShadow > body * 2 && upperShadow < body * 0.5) {
      return {
        pattern: '🔨 Hammer (Pin Bar صاعد)',
        direction: 'BULLISH',
        confidence: 75,
        description: 'شمعة انعكاسية صاعدة - ذيل سفلي طويل',
        location: 0,
      };
    }

    // Pin Bar هابط (Shooting Star)
    if (upperShadow > body * 2 && lowerShadow < body * 0.5) {
      return {
        pattern: '⭐ Shooting Star (Pin Bar هابط)',
        direction: 'BEARISH',
        confidence: 75,
        description: 'شمعة انعكاسية هابطة - ذيل علوي طويل',
        location: 0,
      };
    }

    return null;
  }

  private detectEngulfing(candles: Candle[]): BarPattern | null {
    if (candles.length < 2) return null;

    const prev = candles[1];
    const current = candles[0];

    const prevBody = Math.abs(prev.close - prev.open);
    const currentBody = Math.abs(current.close - current.open);

    // Bullish Engulfing
    if (
      prev.close < prev.open && // السابقة هابطة
      current.close > current.open && // الحالية صاعدة
      current.open < prev.close &&
      current.close > prev.open &&
      currentBody > prevBody
    ) {
      return {
        pattern: '🟢 Bullish Engulfing',
        direction: 'BULLISH',
        confidence: 80,
        description: 'نمط ابتلاعي صاعد - انعكاس قوي',
        location: 0,
      };
    }

    // Bearish Engulfing
    if (
      prev.close > prev.open && // السابقة صاعدة
      current.close < current.open && // الحالية هابطة
      current.open > prev.close &&
      current.close < prev.open &&
      currentBody > prevBody
    ) {
      return {
        pattern: '🔴 Bearish Engulfing',
        direction: 'BEARISH',
        confidence: 80,
        description: 'نمط ابتلاعي هابط - انعكاس قوي',
        location: 0,
      };
    }

    return null;
  }

  private detectDoji(candle: Candle): BarPattern | null {
    const body = Math.abs(candle.close - candle.open);
    const totalRange = candle.high - candle.low;

    if (totalRange === 0) return null;

    const bodyRatio = body / totalRange;

    if (bodyRatio < 0.1) {
      return {
        pattern: '✳️ Doji',
        direction: 'NEUTRAL',
        confidence: 60,
        description: 'شمعة تردد - انعكاس محتمل',
        location: 0,
      };
    }

    return null;
  }

  private detectStarPattern(candles: Candle[]): BarPattern | null {
    if (candles.length < 3) return null;

    const first = candles[2];
    const middle = candles[1];
    const last = candles[0];

    const firstBody = Math.abs(first.close - first.open);
    const middleBody = Math.abs(middle.close - middle.open);
    const lastBody = Math.abs(last.close - last.open);

    // Morning Star (صاعد)
    if (
      first.close < first.open && // الأولى هابطة
      middleBody < firstBody * 0.3 && // الوسطى صغيرة
      last.close > last.open && // الأخيرة صاعدة
      lastBody > firstBody * 0.5
    ) {
      return {
        pattern: '🌅 Morning Star',
        direction: 'BULLISH',
        confidence: 85,
        description: 'نجمة الصباح - انعكاس صاعد قوي',
        location: 0,
      };
    }

    // Evening Star (هابط)
    if (
      first.close > first.open && // الأولى صاعدة
      middleBody < firstBody * 0.3 && // الوسطى صغيرة
      last.close < last.open && // الأخيرة هابطة
      lastBody > firstBody * 0.5
    ) {
      return {
        pattern: '🌆 Evening Star',
        direction: 'BEARISH',
        confidence: 85,
        description: 'نجمة المساء - انعكاس هابط قوي',
        location: 0,
      };
    }

    return null;
  }

  private detectThreeSoldiers(candles: Candle[]): BarPattern | null {
    if (candles.length < 3) return null;

    const c1 = candles[2];
    const c2 = candles[1];
    const c3 = candles[0];

    // Three White Soldiers
    if (
      c1.close > c1.open &&
      c2.close > c2.open &&
      c3.close > c3.open &&
      c2.close > c1.close &&
      c3.close > c2.close
    ) {
      return {
        pattern: '⚪ Three White Soldiers',
        direction: 'BULLISH',
        confidence: 90,
        description: 'ثلاث جنود بيض - اتجاه صاعد قوي',
        location: 0,
      };
    }

    // Three Black Crows
    if (
      c1.close < c1.open &&
      c2.close < c2.open &&
      c3.close < c3.open &&
      c2.close < c1.close &&
      c3.close < c2.close
    ) {
      return {
        pattern: '⚫ Three Black Crows',
        direction: 'BEARISH',
        confidence: 90,
        description: 'ثلاثة غربان سود - اتجاه هابط قوي',
        location: 0,
      };
    }

    return null;
  }

  formatPatterns(patterns: BarPattern[]): string {
    if (patterns.length === 0) {
      return '📊 **تحليل الشموع:**\nلا توجد أنماط واضحة حالياً\n\n';
    }

    let text = '📊 **تحليل الشموع (Bar Chart Patterns):**\n\n';
    
    patterns.forEach((p, i) => {
      const emoji = p.direction === 'BULLISH' ? '🟢' : p.direction === 'BEARISH' ? '🔴' : '🟡';
      text += `${emoji} **${p.pattern}**\n`;
      text += `   📝 ${p.description}\n`;
      text += `   🎯 الثقة: ${p.confidence}%\n\n`;
    });

    return text;
  }
}