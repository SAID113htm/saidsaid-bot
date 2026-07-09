export interface PositionCalculation {
  symbol: string;
  direction: 'BUY' | 'SELL';
  entry: number;
  stopLoss: number;
  takeProfit: number;
  riskPercent: number;
  accountBalance: number;
  riskAmount: number;
  positionSize: number;
  potentialProfit: number;
  riskRewardRatio: number;
}

export class RiskManager {
  calculatePosition(params: {
    symbol: string;
    direction: 'BUY' | 'SELL';
    entry: number;
    stopLoss: number;
    takeProfit: number;
    riskPercent: number;
    accountBalance: number;
  }): PositionCalculation {
    const { entry, stopLoss, takeProfit, riskPercent, accountBalance, direction, symbol } = params;

    const riskAmount = (accountBalance * riskPercent) / 100;
    const riskPerUnit = Math.abs(entry - stopLoss);
    const positionSize = riskAmount / riskPerUnit;
    const potentialProfit = Math.abs(takeProfit - entry) * positionSize;
    const riskRewardRatio = Math.abs(takeProfit - entry) / riskPerUnit;

    return {
      symbol,
      direction,
      entry,
      stopLoss,
      takeProfit,
      riskPercent,
      accountBalance,
      riskAmount,
      positionSize: Math.round(positionSize * 100) / 100,
      potentialProfit: Math.round(potentialProfit * 100) / 100,
      riskRewardRatio: Math.round(riskRewardRatio * 100) / 100,
    };
  }

  validateRisk(params: {
    riskPercent: number;
    riskRewardRatio: number;
    confidence: string;
  }): { valid: boolean; warnings: string[] } {
    const warnings: string[] = [];

    if (params.riskPercent > 2) {
      warnings.push('⚠️ المخاطرة أعلى من 2% - غير مستحسن');
    }

    if (params.riskRewardRatio < 1.5) {
      warnings.push('⚠️ نسبة المخاطرة/العائد أقل من 1:1.5');
    }

    if (params.confidence === 'LOW') {
      warnings.push('⚠️ مستوى الثقة منخفض - يُنصح بالانتظار');
    }

    return {
      valid: warnings.length === 0,
      warnings,
    };
  }
}