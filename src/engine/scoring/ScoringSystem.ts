import { DEFAULT_WEIGHTS, getDecisionFromScore } from './Weights';

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
