export interface Candle {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface SmartMoneyAnalysis {
  bos: {
    bullish: boolean;
    bearish: boolean;
    lastBullishBOS: string | null;
    lastBearishBOS: string | null;
  };
  choch: {
    bullish: boolean;
    bearish: boolean;
    lastBullishCHOCH: string | null;
    lastBearishCHOCH: string | null;
  };
  orderBlocks: {
    bullish: Array<{ time: string; price: number }>;
    bearish: Array<{ time: string; price: number }>;
  };
  fvg: {
    bullish: Array<{ time: string; low: number; high: number }>;
    bearish: Array<{ time: string; low: number; high: number }>;
  };
  liquiditySweeps: Array<{ time: string; type: 'high' | 'low'; price: number }>;
  structure: 'BULLISH' | 'BEARISH' | 'RANGING';
}

export class SmartMoneyAnalyzer {
  
  analyze(candles: Candle[]): SmartMoneyAnalysis {
    const result: SmartMoneyAnalysis = {
      bos: {
        bullish: false,
        bearish: false,
        lastBullishBOS: null,
        lastBearishBOS: null,
      },
      choch: {
        bullish: false,
        bearish: false,
        lastBullishCHOCH: null,
        lastBearishCHOCH: null,
      },
      orderBlocks: {
        bullish: [],
        bearish: [],
      },
      fvg: {
        bullish: [],
        bearish: [],
      },
      liquiditySweeps: [],
      structure: 'RANGING',
    };

    if (candles.length < 20) return result;

    result.bos = this.analyzeBOS(candles);
    result.choch = this.analyzeCHOCH(candles);
    result.orderBlocks = this.analyzeOrderBlocks(candles);
    result.fvg = this.analyzeFVG(candles);
    result.liquiditySweeps = this.analyzeLiquiditySweeps(candles);
    result.structure = this.determineStructure(candles, result);

    return result;
  }

  private analyzeBOS(candles: Candle[]): SmartMoneyAnalysis['bos'] {
    const result: SmartMoneyAnalysis['bos'] = {
      bullish: false,
      bearish: false,
      lastBullishBOS: null,
      lastBearishBOS: null,
    };

    const swingHighs: Array<{ time: string; price: number }> = [];
    const swingLows: Array<{ time: string; price: number }> = [];

    for (let i = 5; i < candles.length - 5; i++) {
      const candle = candles[i];
      const prevCandles = candles.slice(i - 5, i);
      const nextCandles = candles.slice(i + 1, i + 6);

      const isSwingHigh = candle.high > Math.max(...prevCandles.map(c => c.high)) &&
                          candle.high > Math.max(...nextCandles.map(c => c.high));

      const isSwingLow = candle.low < Math.min(...prevCandles.map(c => c.low)) &&
                         candle.low < Math.min(...nextCandles.map(c => c.low));

      if (isSwingHigh) {
        swingHighs.push({ time: candle.time, price: candle.high });
      }
      if (isSwingLow) {
        swingLows.push({ time: candle.time, price: candle.low });
      }
    }

    if (swingHighs.length >= 2) {
      const lastHigh = swingHighs[swingHighs.length - 1];
      const prevHigh = swingHighs[swingHighs.length - 2];
      
      if (lastHigh.price > prevHigh.price) {
        result.bullish = true;
        result.lastBullishBOS = lastHigh.time;
      }
    }

    if (swingLows.length >= 2) {
      const lastLow = swingLows[swingLows.length - 1];
      const prevLow = swingLows[swingLows.length - 2];
      
      if (lastLow.price < prevLow.price) {
        result.bearish = true;
        result.lastBearishBOS = lastLow.time;
      }
    }

    return result;
  }

  private analyzeCHOCH(candles: Candle[]): SmartMoneyAnalysis['choch'] {
    const result: SmartMoneyAnalysis['choch'] = {
      bullish: false,
      bearish: false,
      lastBullishCHOCH: null,
      lastBearishCHOCH: null,
    };

    if (candles.length < 30) return result;

    const recentCandles = candles.slice(0, 15);
    const olderCandles = candles.slice(15, 30);

    const recentHigh = Math.max(...recentCandles.map(c => c.high));
    const recentLow = Math.min(...recentCandles.map(c => c.low));
    const olderHigh = Math.max(...olderCandles.map(c => c.high));
    const olderLow = Math.min(...olderCandles.map(c => c.low));

    if (recentHigh > olderHigh && recentLow > olderLow) {
      result.bullish = true;
      result.lastBullishCHOCH = recentCandles[0].time;
    }

    if (recentLow < olderLow && recentHigh < olderHigh) {
      result.bearish = true;
      result.lastBearishCHOCH = recentCandles[0].time;
    }

    return result;
  }

  private analyzeOrderBlocks(candles: Candle[]): SmartMoneyAnalysis['orderBlocks'] {
    const result: SmartMoneyAnalysis['orderBlocks'] = {
      bullish: [],
      bearish: [],
    };

    for (let i = 10; i < candles.length - 5; i++) {
      const candle = candles[i];
      const nextCandle = candles[i + 1];
      const afterCandles = candles.slice(i + 2, i + 7);

      if (candle.close < candle.open && 
          nextCandle.close > nextCandle.open &&
          afterCandles.every(c => c.close > candle.open)) {
        result.bullish.push({
          time: candle.time,
          price: (candle.high + candle.low) / 2,
        });
      }

      if (candle.close > candle.open && 
          nextCandle.close < nextCandle.open &&
          afterCandles.every(c => c.close < candle.close)) {
        result.bearish.push({
          time: candle.time,
          price: (candle.high + candle.low) / 2,
        });
      }
    }

    result.bullish = result.bullish.slice(-3);
    result.bearish = result.bearish.slice(-3);

    return result;
  }

  private analyzeFVG(candles: Candle[]): SmartMoneyAnalysis['fvg'] {
    const result: SmartMoneyAnalysis['fvg'] = {
      bullish: [],
      bearish: [],
    };

    for (let i = 2; i < candles.length; i++) {
      const current = candles[i];
      const prev = candles[i - 1];

      if (current.low > prev.high && prev.close > prev.open) {
        result.bullish.push({
          time: current.time,
          low: prev.high,
          high: current.low,
        });
      }

      if (current.high < prev.low && prev.close < prev.open) {
        result.bearish.push({
          time: current.time,
          low: current.high,
          high: prev.low,
        });
      }
    }

    result.bullish = result.bullish.slice(-3);
    result.bearish = result.bearish.slice(-3);

    return result;
  }

  private analyzeLiquiditySweeps(candles: Candle[]): SmartMoneyAnalysis['liquiditySweeps'] {
    const sweeps: SmartMoneyAnalysis['liquiditySweeps'] = [];

    if (candles.length < 10) return sweeps;

    for (let i = 5; i < candles.length; i++) {
      const current = candles[i];
      const prevCandles = candles.slice(i - 5, i);

      const highestHigh = Math.max(...prevCandles.map(c => c.high));
      const lowestLow = Math.min(...prevCandles.map(c => c.low));

      if (current.high > highestHigh && current.close < current.open) {
        sweeps.push({
          time: current.time,
          type: 'high',
          price: current.high,
        });
      }

      if (current.low < lowestLow && current.close > current.open) {
        sweeps.push({
          time: current.time,
          type: 'low',
          price: current.low,
        });
      }
    }

    return sweeps.slice(-5);
  }

  private determineStructure(
    candles: Candle[],
    analysis: SmartMoneyAnalysis
  ): 'BULLISH' | 'BEARISH' | 'RANGING' {
    let bullishScore = 0;
    let bearishScore = 0;

    if (analysis.bos.bullish) bullishScore += 2;
    if (analysis.bos.bearish) bearishScore += 2;
    if (analysis.choch.bullish) bullishScore += 1;
    if (analysis.choch.bearish) bearishScore += 1;
    if (analysis.orderBlocks.bullish.length > 0) bullishScore += 1;
    if (analysis.orderBlocks.bearish.length > 0) bearishScore += 1;

    const recentCandles = candles.slice(0, 20);
    const firstClose = parseFloat(recentCandles[recentCandles.length - 1].close.toString());
    const lastClose = parseFloat(recentCandles[0].close.toString());
    const priceChange = ((lastClose - firstClose) / firstClose) * 100;

    if (priceChange > 2) bullishScore += 1;
    if (priceChange < -2) bearishScore += 1;

    if (bullishScore > bearishScore + 1) return 'BULLISH';
    if (bearishScore > bullishScore + 1) return 'BEARISH';
    return 'RANGING';
  }

  formatSmartMoney(analysis: SmartMoneyAnalysis): string {
    let text = '\n Smart Money Analysis\n\n';

    const structureEmoji: any = {
      'BULLISH': '🟢',
      'BEARISH': '🔴',
      'RANGING': '🟡'
    };
    text += 'الهيكل: ' + structureEmoji[analysis.structure] + ' ' + analysis.structure + '\n\n';

    if (analysis.bos.bullish) {
      text += '✅ BOS صاعد موجود\n';
    }
    if (analysis.bos.bearish) {
      text += '🔻 BOS هابط موجود\n';
    }
    if (!analysis.bos.bullish && !analysis.bos.bearish) {
      text += '❌ لا يوجد BOS واضح\n';
    }
    text += '\n';

    if (analysis.choch.bullish) {
      text += '✅ CHOCH صاعد - تغير الاتجاه\n';
    }
    if (analysis.choch.bearish) {
      text += '🔻 CHOCH هابط - تغير الاتجاه\n';
    }
    text += '\n';

    if (analysis.orderBlocks.bullish.length > 0) {
      text += '📍 Order Blocks صاعدة: ' + analysis.orderBlocks.bullish.length + '\n';
      analysis.orderBlocks.bullish.forEach((ob, i) => {
        text += '   ' + (i + 1) + '. ' + ob.price.toFixed(5) + '\n';
      });
      text += '\n';
    }

    if (analysis.orderBlocks.bearish.length > 0) {
      text += '📍 Order Blocks هابطة: ' + analysis.orderBlocks.bearish.length + '\n';
      analysis.orderBlocks.bearish.forEach((ob, i) => {
        text += '   ' + (i + 1) + '. ' + ob.price.toFixed(5) + '\n';
      });
      text += '\n';
    }

    if (analysis.fvg.bullish.length > 0) {
      text += '🔺 FVG صاعد: ' + analysis.fvg.bullish.length + '\n';
    }
    if (analysis.fvg.bearish.length > 0) {
      text += '⚡ FVG هابط: ' + analysis.fvg.bearish.length + '\n';
    }
    text += '\n';

    if (analysis.liquiditySweeps.length > 0) {
      text += '💧 Liquidity Sweeps: ' + analysis.liquiditySweeps.length + '\n';
    }

    return text;
  }
}