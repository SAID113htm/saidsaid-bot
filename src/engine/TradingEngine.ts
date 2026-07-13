import { Candle } from '../smartmoney/SmartMoney';
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
    let t = '**تحليل Pipeline - ' + symbol + '**\n\n';
    t += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
    t += this.getEmoji(sig.status) + ' **القرار: ' + sig.status + '**\n';
    t += '📊 **النتيجة: ' + sig.score.toFixed(0) + '/100**\n';
    t += '🎯 **الثقة: ' + sig.confidence + '%**\n';
    t += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n';
    t += '📋 **الطبقات:**\n';
    sig.breakdown.forEach((b: any, i: number) => {
      t += (i + 1) + '. ' + (b.passed ? '✅' : '❌') + ' **' + b.layer + '** (' + b.score + '/' + b.maxScore + ')\n';
    });
    if (sig.entry && sig.status !== 'REJECT') {
      t += '\n🎯 **الدخول:**\n';
      t += '• Entry: ' + sig.entry.toFixed(5) + '\n';
      t += '• SL: ' + sig.stopLoss?.toFixed(5) + '\n';
      t += '• TP1: ' + sig.takeProfit1?.toFixed(5) + '\n';
      t += '• R:R: 1:' + sig.riskReward?.toFixed(2) + '\n';
    }
    t += '\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
    t += this.getEmoji(sig.status) + ' **' + this.getText(sig.status) + '**\n';
    t += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
    return t;
  }

  private getEmoji(s: string) {
    return s === 'STRONG_BUY' || s === 'BUY' ? '🟢' : s === 'REJECT' ? '🔴' : '🟡';
  }

  private getText(s: string) {
    return s === 'STRONG_BUY' ? 'ممتازة' : s === 'BUY' ? 'جيدة' : s === 'REJECT' ? 'مرفوضة' : 'متوسطة';
  }
}
