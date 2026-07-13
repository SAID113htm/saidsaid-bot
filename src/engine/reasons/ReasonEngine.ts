export class ReasonEngine {
  private reasons: any[] = [];
  addPositive(layer: string, message: string) { this.reasons.push({ layer, type: 'positive', message }); }
  addNegative(layer: string, message: string) { this.reasons.push({ layer, type: 'negative', message }); }
  reset() { this.reasons = []; }
}
