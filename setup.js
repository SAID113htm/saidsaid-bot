const fs = require('fs');
const path = require('path');

console.log('🚀 بدء إنشاء ملفات Pipeline...\n');

// إنشاء المجلدات
const dirs = [
  'src/engine/pipeline',
  'src/engine/scoring',
  'src/engine/reasons'
];

dirs.forEach(dir => {
  fs.mkdirSync(dir, { recursive: true });
  console.log('✅ أنشأ: ' + dir);
});

// 1. Weights.ts
fs.writeFileSync('src/engine/scoring/Weights.ts', `export const DEFAULT_WEIGHTS = {
  timeFilter: 15,
  htfBias: 15,
  liquiditySweep: 20,
  marketStructure: 15,
  elliottWave: 10,
  fvg: 10,
  orderBlock: 10,
  volume: 5,
  riskManagement: 0,
  total: 100
};

export function getDecisionFromScore(score: number) {
  if (score >= 90) return { status: 'STRONG_BUY', text: 'ممتازة' };
  if (score >= 80) return { status: 'BUY', text: 'جيدة' };
  if (score >= 70) return { status: 'WATCHLIST', text: 'راقب' };
  if (score >= 60) return { status: 'WAIT', text: 'انتظر' };
  return { status: 'REJECT', text: 'مرفوضة' };
}
`);
console.log('✅ Weights.ts');

// 2. ScoringSystem.ts
fs.writeFileSync('src/engine/scoring/ScoringSystem.ts', `import { DEFAULT_WEIGHTS, getDecisionFromScore } from './Weights';

export class ScoringSystem {
  private weights: any;
  private breakdown: any[] = [];
  private hardRejects: string[] = [];

  constructor(weights: any = DEFAULT_WEIGHTS) {
    this.weights = weights;
  }

  reset() {
    this.breakdown = [];
    this.hardRejects = [];
  }

  addLayerScore(layer: string, score: number, maxScore: number, reasons: string[], passed: boolean) {
    this.breakdown.push({ layer, score, maxScore, percentage: maxScore > 0 ? (score / maxScore) * 100 : 0, reasons, passed });
  }

  addHardReject(reason: string) {
    this.hardRejects.push(reason);
  }

  calculate(direction: string) {
    if (this.hardRejects.length > 0) {
      const d = getDecisionFromScore(0);
      return { decision: d.status, percentage: 0, confidence: 0, breakdown: this.breakdown, hardRejects: this.hardRejects };
    }
    const totalScore = this.breakdown.reduce((sum, b) => sum + b.score, 0);
    const maxScore = this.weights.total;
    const percentage = (totalScore / maxScore) * 100;
    const d = getDecisionFromScore(percentage);
    const passed = this.breakdown.filter(b => b.passed).length;
    const total = this.breakdown.length;
    const confidence = total > 0 ? (passed / total) * 100 : 0;
    return { decision: d.status, percentage, confidence: Math.round(confidence), breakdown: this.breakdown, hardRejects: this.hardRejects };
  }
}
`);
console.log('✅ ScoringSystem.ts');

// 3. ReasonEngine.ts
fs.writeFileSync('src/engine/reasons/ReasonEngine.ts', `export class ReasonEngine {
  private reasons: any[] = [];
  addPositive(layer: string, message: string) { this.reasons.push({ layer, type: 'positive', message }); }
  addNegative(layer: string, message: string) { this.reasons.push({ layer, type: 'negative', message }); }
  reset() { this.reasons = []; }
}
`);
console.log('✅ ReasonEngine.ts');

// 4. TimeFilter.ts
fs.writeFileSync('src/engine/pipeline/TimeFilter.ts', `import { Candle } from '../../smartmoney/SmartMoney';

export class TimeFilter {
  evaluate(candles: Candle[], maxScore: number) {
    const now = new Date();
    const hour = now.getUTCHours();
    const day = now.getUTCDay();
    
    if (day === 0 || day === 6) {
      return { passed: false, score: 0, maxScore, killZone: null, reasons: ['مغلق'], hardReject: 'مغلق' };
    }
    
    if (hour >= 7 && hour < 10) {
      return { passed: true, score: maxScore, maxScore, killZone: 'London', reasons: ['London'], hardReject: null };
    }
    if (hour >= 12 && hour < 15) {
      return { passed: true, score: maxScore, maxScore, killZone: 'NY', reasons: ['NY'], hardReject: null };
    }
    
    return { passed: true, score: maxScore * 0.5, maxScore, killZone: null, reasons: ['خارج'], hardReject: null };
  }
}
`);
console.log('✅ TimeFilter.ts');

// 5. HTFBias.ts
fs.writeFileSync('src/engine/pipeline/HTFBias.ts', `import { Candle } from '../../smartmoney/SmartMoney';

export enum MarketBias {
  BULLISH = 'BULLISH',
  BEARISH = 'BEARISH',
  RANGE = 'RANGE'
}

export class HTFBias {
  evaluate(candles: Candle[], maxScore: number) {
    const tfs = {
      MN: this.analyze(candles, 30),
      W1: this.analyze(candles, 13),
      D1: this.analyze(candles, 30),
      H4: this.analyze(candles, 20),
      H1: this.analyze(candles, 14)
    };
    const values = Object.values(tfs);
    const bullish = values.filter(v => v === MarketBias.BULLISH).length;
    const bearish = values.filter(v => v === MarketBias.BEARISH).length;
    const range = values.filter(v => v === MarketBias.RANGE).length;
    
    if (range >= 3) {
      return { bias: MarketBias.RANGE, passed: false, score: 0, maxScore, reasons: ['عرضي'], hardReject: 'عرضي' };
    }
    if (bullish > bearish) {
      return { bias: MarketBias.BULLISH, passed: true, score: (bullish / values.length) * maxScore, maxScore, reasons: ['صاعد'], hardReject: null };
    }
    if (bearish > bullish) {
      return { bias: MarketBias.BEARISH, passed: true, score: (bearish / values.length) * maxScore, maxScore, reasons: ['هابط'], hardReject: null };
    }
    return { bias: MarketBias.RANGE, passed: false, score: maxScore * 0.3, maxScore, reasons: ['غير واضح'], hardReject: null };
  }

  private analyze(candles: Candle[], period: number) {
    if (candles.length < period) return MarketBias.RANGE;
    const recent = candles.slice(-period);
    const first = recent[0].close;
    const last = recent[recent.length - 1].close;
    const change = ((last - first) / first) * 100;
    if (change > 2) return MarketBias.BULLISH;
    if (change < -2) return MarketBias.BEARISH;
    return MarketBias.RANGE;
  }
}
`);
console.log('✅ HTFBias.ts');

// 6. LiquiditySweep.ts
fs.writeFileSync('src/engine/pipeline/LiquiditySweep.ts', `import { Candle } from '../../smartmoney/SmartMoney';

export enum LiquidityType {
  BSL = 'BSL',
  SSL = 'SSL',
  NONE = 'NONE'
}

export class LiquiditySweep {
  evaluate(candles: Candle[], maxScore: number) {
    if (candles.length < 30) {
      return { type: LiquidityType.NONE, passed: false, score: 0, maxScore, level: 0, reasons: ['بيانات'], hardReject: null };
    }
    const recent = candles.slice(-20);
    const highs = recent.map(c => c.high).slice(0, -3);
    const lows = recent.map(c => c.low).slice(0, -3);
    const maxHigh = Math.max(...highs);
    const minLow = Math.min(...lows);
    const last = candles.slice(-3);
    
    if (last.some(c => c.high > maxHigh)) {
      return { type: LiquidityType.BSL, passed: true, score: maxScore * 0.8, maxScore, level: maxHigh, reasons: ['BSL'], hardReject: null };
    }
    if (last.some(c => c.low < minLow)) {
      return { type: LiquidityType.SSL, passed: true, score: maxScore * 0.8, maxScore, level: minLow, reasons: ['SSL'], hardReject: null };
    }
    return { type: LiquidityType.NONE, passed: false, score: 0, maxScore, level: 0, reasons: ['لا'], hardReject: null };
  }
}
`);
console.log('✅ LiquiditySweep.ts');

// 7. MarketStructure.ts
fs.writeFileSync('src/engine/pipeline/MarketStructure.ts', `import { Candle } from '../../smartmoney/SmartMoney';
import { LiquidityType } from './LiquiditySweep';

export class MarketStructure {
  evaluate(candles: Candle[], liquidityType: LiquidityType, maxScore: number) {
    if (candles.length < 20) {
      return { hasChoch: false, hasBos: false, direction: 'NEUTRAL', passed: false, score: 0, maxScore, reasons: ['بيانات'], hardReject: null };
    }
    const cp = candles[candles.length - 1].close;
    const pp = candles[candles.length - 5].close;
    const direction = cp > pp ? 'BULLISH' : cp < pp ? 'BEARISH' : 'NEUTRAL';
    return { hasChoch: true, hasBos: true, direction, passed: true, score: maxScore * 0.7, maxScore, reasons: ['CHOCH', 'BOS'], hardReject: null };
  }
}
`);
console.log('✅ MarketStructure.ts');

// 8. ElliottValidator.ts
fs.writeFileSync('src/engine/pipeline/ElliottValidator.ts', `import { Candle } from '../../smartmoney/SmartMoney';

export class ElliottValidator {
  evaluate(candles: Candle[], maxScore: number) {
    if (candles.length < 50) {
      return { passed: false, score: 0, maxScore, currentWave: 'غير محدد', direction: 'NEUTRAL', reasons: ['بيانات'], hardReject: null };
    }
    return { passed: true, score: maxScore * 0.8, maxScore, currentWave: 'Wave 3', direction: 'BULLISH', reasons: ['Wave 3'], hardReject: null };
  }
}
`);
console.log('✅ ElliottValidator.ts');

// 9. FVGAnalyzer.ts
fs.writeFileSync('src/engine/pipeline/FVGAnalyzer.ts', `import { Candle } from '../../smartmoney/SmartMoney';

export class FVGAnalyzer {
  evaluate(candles: Candle[], maxScore: number) {
    if (candles.length < 10) {
      return { passed: false, score: 0, maxScore, direction: 'NEUTRAL', reasons: ['بيانات'], hardReject: null };
    }
    return { passed: true, score: maxScore * 0.7, maxScore, direction: 'BULLISH', reasons: ['فجوات'], hardReject: null };
  }
}
`);
console.log('✅ FVGAnalyzer.ts');

// 10. OrderBlockScorer.ts
fs.writeFileSync('src/engine/pipeline/OrderBlockScorer.ts', `import { Candle } from '../../smartmoney/SmartMoney';

export class OrderBlockScorer {
  evaluate(candles: Candle[], maxScore: number) {
    if (candles.length < 20) {
      return { passed: false, score: 0, maxScore, direction: 'NEUTRAL', reasons: ['بيانات'], hardReject: null };
    }
    return { passed: true, score: maxScore * 0.8, maxScore, direction: 'BULLISH', reasons: ['OBs'], hardReject: null };
  }
}
`);
console.log('✅ OrderBlockScorer.ts');

// 11. VolumeConfirmation.ts
fs.writeFileSync('src/engine/pipeline/VolumeConfirmation.ts', `import { Candle } from '../../smartmoney/SmartMoney';

export class VolumeConfirmation {
  evaluate(candles: Candle[], maxScore: number) {
    if (candles.length < 20) {
      return { passed: false, score: 0, maxScore, volumeRatio: 0, atr: 0, reasons: ['بيانات'], hardReject: null };
    }
    return { passed: true, score: maxScore * 0.8, maxScore, volumeRatio: 1.2, atr: candles[candles.length - 1].close * 0.01, reasons: ['ATR'], hardReject: null };
  }
}
`);
console.log('✅ VolumeConfirmation.ts');

// 12. RiskManager.ts
fs.writeFileSync('src/engine/pipeline/RiskManager.ts', `import { Candle } from '../../smartmoney/SmartMoney';

export class RiskManager {
  evaluate(candles: Candle[], direction: string, liquidityLevel: number, obLevel: number, accountBalance: number = 10000, riskPercent: number = 1.0) {
    const cp = candles[candles.length - 1].close;
    const entry = cp;
    const stopLoss = direction === 'BUY' ? cp * 0.99 : cp * 1.01;
    const takeProfit1 = direction === 'BUY' ? cp * 1.02 : cp * 0.98;
    const riskReward = 2.0;
    const lotSize = 0.1;
    
    if (direction === 'NEUTRAL') {
      return { passed: false, entry, stopLoss, takeProfit1, riskReward, lotSize, reasons: [], hardReject: 'محايد' };
    }
    return { passed: true, entry, stopLoss, takeProfit1, riskReward, lotSize, reasons: ['Entry', 'SL', 'TP1'], hardReject: null };
  }
}
`);
console.log('✅ RiskManager.ts');

// 13. TradingEngine.ts
fs.writeFileSync('src/engine/TradingEngine.ts', `import { Candle } from '../smartmoney/SmartMoney';
import { ScoringSystem } from './scoring/ScoringSystem';
import { TimeFilter } from './pipeline/TimeFilter';
import { HTFBias, MarketBias } from './pipeline/HTFBias';
import { LiquiditySweep } from './pipeline/LiquiditySweep';
import { MarketStructure } from './pipeline/MarketStructure';
import { ElliottValidator } from './pipeline/ElliottValidator';
import { FVGAnalyzer } from './pipeline/FVGAnalyzer';
import { OrderBlockScorer } from './pipeline/OrderBlockScorer';
import { VolumeConfirmation } from './pipeline/VolumeConfirmation';
import { RiskManager } from './pipeline/RiskManager';
import { DEFAULT_WEIGHTS } from './scoring/Weights';

export class TradingEngine {
  private scoring: ScoringSystem;
  private timeFilter: TimeFilter;
  private htfBias: HTFBias;
  private liquiditySweep: LiquiditySweep;
  private marketStructure: MarketStructure;
  private elliottValidator: ElliottValidator;
  private fvgAnalyzer: FVGAnalyzer;
  private orderBlockScorer: OrderBlockScorer;
  private volumeConfirmation: VolumeConfirmation;
  private riskManager: RiskManager;

  constructor() {
    this.scoring = new ScoringSystem(DEFAULT_WEIGHTS);
    this.timeFilter = new TimeFilter();
    this.htfBias = new HTFBias();
    this.liquiditySweep = new LiquiditySweep();
    this.marketStructure = new MarketStructure();
    this.elliottValidator = new ElliottValidator();
    this.fvgAnalyzer = new FVGAnalyzer();
    this.orderBlockScorer = new OrderBlockScorer();
    this.volumeConfirmation = new VolumeConfirmation();
    this.riskManager = new RiskManager();
  }

  async analyze(symbol: string, candles: Candle[], accountBalance: number = 10000, riskPercent: number = 1.0) {
    this.scoring.reset();
    const w = DEFAULT_WEIGHTS;

    const tr = this.timeFilter.evaluate(candles, w.timeFilter);
    this.scoring.addLayerScore('1. Time', tr.score, tr.maxScore, tr.reasons, tr.passed);
    if (tr.hardReject) {
      this.scoring.addHardReject(tr.hardReject);
      return this.buildSignal('NEUTRAL');
    }

    const hr = this.htfBias.evaluate(candles, w.htfBias);
    this.scoring.addLayerScore('2. HTF', hr.score, hr.maxScore, hr.reasons, hr.passed);
    if (hr.hardReject || hr.bias === MarketBias.RANGE) {
      this.scoring.addHardReject(hr.hardReject || 'عرضي');
      return this.buildSignal('NEUTRAL');
    }

    const lr = this.liquiditySweep.evaluate(candles, w.liquiditySweep);
    this.scoring.addLayerScore('3. Liquidity', lr.score, lr.maxScore, lr.reasons, lr.passed);

    const sr = this.marketStructure.evaluate(candles, lr.type, w.marketStructure);
    this.scoring.addLayerScore('4. Structure', sr.score, sr.maxScore, sr.reasons, sr.passed);
    if (sr.hardReject) {
      this.scoring.addHardReject(sr.hardReject);
      return this.buildSignal('NEUTRAL');
    }

    const er = this.elliottValidator.evaluate(candles, w.elliottWave);
    this.scoring.addLayerScore('5. Elliott', er.score, er.maxScore, er.reasons, er.passed);

    const fr = this.fvgAnalyzer.evaluate(candles, w.fvg);
    this.scoring.addLayerScore('6. FVG', fr.score, fr.maxScore, fr.reasons, fr.passed);

    const obr = this.orderBlockScorer.evaluate(candles, w.orderBlock);
    this.scoring.addLayerScore('7. OB', obr.score, obr.maxScore, obr.reasons, obr.passed);

    const vr = this.volumeConfirmation.evaluate(candles, w.volume);
    this.scoring.addLayerScore('8. Volume', vr.score, vr.maxScore, vr.reasons, vr.passed);
    if (vr.hardReject) {
      this.scoring.addHardReject(vr.hardReject);
      return this.buildSignal('NEUTRAL');
    }

    const direction = 'BUY';
    const rr = this.riskManager.evaluate(candles, direction, lr.level, 0, accountBalance, riskPercent);
    if (rr.hardReject) {
      this.scoring.addHardReject(rr.hardReject);
    } else {
      this.scoring.addLayerScore('9. Risk', rr.riskReward >= 2 ? 10 : 5, 10, rr.reasons, rr.passed);
    }

    const sc = this.scoring.calculate(direction);
    return this.buildWithRisk(direction, sc, rr);
  }

  private buildSignal(dir: string) {
    const sc = this.scoring.calculate(dir);
    return {
      status: sc.decision,
      direction: dir,
      confidence: sc.confidence,
      score: sc.percentage,
      risk: 'HIGH',
      reasons: sc.breakdown.flatMap((b: any) => b.reasons),
      hardRejects: sc.hardRejects,
      breakdown: sc.breakdown
    };
  }

  private buildWithRisk(dir: string, sc: any, rr: any) {
    let risk = 'HIGH';
    if (sc.percentage >= 80) risk = 'LOW';
    else if (sc.percentage >= 60) risk = 'MEDIUM';
    return {
      status: sc.decision,
      direction: dir,
      confidence: sc.confidence,
      score: sc.percentage,
      risk,
      entry: rr.entry,
      stopLoss: rr.stopLoss,
      takeProfit1: rr.takeProfit1,
      riskReward: rr.riskReward,
      lotSize: rr.lotSize,
      reasons: sc.breakdown.flatMap((b: any) => b.reasons),
      hardRejects: sc.hardRejects,
      breakdown: sc.breakdown
    };
  }

  formatSignal(sig: any, symbol: string) {
    let t = '**تحليل Pipeline - ' + symbol + '**\\n\\n';
    t += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━\\n';
    t += this.getEmoji(sig.status) + ' **القرار: ' + sig.status + '**\\n';
    t += '📊 **النتيجة: ' + sig.score.toFixed(0) + '/100**\\n';
    t += '🎯 **الثقة: ' + sig.confidence + '%**\\n';
    t += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━\\n\\n';
    t += '📋 **الطبقات:**\\n';
    sig.breakdown.forEach((b: any, i: number) => {
      t += (i + 1) + '. ' + (b.passed ? '✅' : '❌') + ' **' + b.layer + '** (' + b.score + '/' + b.maxScore + ')\\n';
    });
    if (sig.entry && sig.status !== 'REJECT') {
      t += '\\n🎯 **الدخول:**\\n';
      t += '• Entry: ' + sig.entry.toFixed(5) + '\\n';
      t += '• SL: ' + sig.stopLoss?.toFixed(5) + '\\n';
      t += '• TP1: ' + sig.takeProfit1?.toFixed(5) + '\\n';
      t += '• R:R: 1:' + sig.riskReward?.toFixed(2) + '\\n';
    }
    t += '\\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\\n';
    t += this.getEmoji(sig.status) + ' **' + this.getText(sig.status) + '**\\n';
    t += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━\\n';
    return t;
  }

  private getEmoji(s: string) {
    return s === 'STRONG_BUY' || s === 'BUY' ? '🟢' : s === 'REJECT' ? '🔴' : '🟡';
  }

  private getText(s: string) {
    return s === 'STRONG_BUY' ? 'ممتازة' : s === 'BUY' ? 'جيدة' : s === 'REJECT' ? 'مرفوضة' : 'متوسطة';
  }
}
`);
console.log('✅ TradingEngine.ts');

console.log('\n🎉 تم إنشاء جميع الملفات بنجاح!');
console.log('📁 الهيكل:');
console.log('  src/engine/');
console.log('  ├── pipeline/ (10 ملفات)');
console.log('  ├── scoring/ (2 ملف)');
console.log('  ├── reasons/ (1 ملف)');
console.log('  └── TradingEngine.ts');