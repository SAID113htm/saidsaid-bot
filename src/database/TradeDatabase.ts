import * as fs from 'fs';
import * as path from 'path';

export interface Trade {
  id?: number;
  symbol: string;
  direction: 'BUY' | 'SELL';
  entry: number;
  stopLoss: number;
  takeProfit: number;
  exitPrice?: number;
  lotSize: number;
  riskPercent: number;
  confidence: number;
  status: 'OPEN' | 'WIN' | 'LOSS' | 'BREAKEVEN';
  profit?: number;
  pips?: number;
  reason: string;
  notes?: string;
  openTime: string;
  closeTime?: string;
  strategy: string;
}

export interface TradingStats {
  totalTrades: number;
  openTrades: number;
  closedTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  totalProfit: number;
  totalPips: number;
  averageProfit: number;
  averageLoss: number;
  profitFactor: number;
  bestTrade: number;
  worstTrade: number;
  maxDrawdown: number;
  bestSymbol: string;
  worstSymbol: string;
  averageHoldTime: number;
  consecutiveWins: number;
  consecutiveLosses: number;
  bestDay: string;
  worstDay: string;
}

export class TradeDatabase {
  private trades: Trade[] = [];
  private filePath: string;

  constructor() {
    this.filePath = path.join(__dirname, '../../trades.json');
    this.loadTrades();
  }

  private loadTrades(): void {
    try {
      if (fs.existsSync(this.filePath)) {
        const data = fs.readFileSync(this.filePath, 'utf-8');
        this.trades = JSON.parse(data);
        console.log('✅ Loaded ' + this.trades.length + ' trades from JSON');
      } else {
        this.trades = [];
        this.saveTrades();
      }
    } catch (error) {
      console.error('❌ Failed to load trades:', error);
      this.trades = [];
    }
  }

  private saveTrades(): void {
    try {
      fs.writeFileSync(this.filePath, JSON.stringify(this.trades, null, 2));
    } catch (error) {
      console.error('❌ Failed to save trades:', error);
    }
  }

  addTrade(trade: Omit<Trade, 'id'>): number {
    const id = this.trades.length > 0 
      ? Math.max(...this.trades.map(t => t.id || 0)) + 1 
      : 1;

    const newTrade: Trade = {
      ...trade,
      id,
    };

    this.trades.push(newTrade);
    this.saveTrades();
    return id;
  }

  closeTrade(id: number, exitPrice: number, status: 'WIN' | 'LOSS' | 'BREAKEVEN', profit: number, pips: number): void {
    const trade = this.trades.find(t => t.id === id);
    if (trade) {
      trade.exitPrice = exitPrice;
      trade.status = status;
      trade.profit = profit;
      trade.pips = pips;
      trade.closeTime = new Date().toISOString();
      this.saveTrades();
    }
  }

  getOpenTrades(): Trade[] {
    return this.trades.filter(t => t.status === 'OPEN');
  }

  getTradeById(id: number): Trade | undefined {
    return this.trades.find(t => t.id === id);
  }

  getStatistics(days: number = 30): TradingStats {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const startDateStr = startDate.toISOString();

    const trades = this.trades.filter(t => t.openTime >= startDateStr);
    const closedTrades = trades.filter(t => t.status !== 'OPEN');
    const openTrades = trades.filter(t => t.status === 'OPEN');
    const winningTrades = closedTrades.filter(t => t.status === 'WIN');
    const losingTrades = closedTrades.filter(t => t.status === 'LOSS');

    const profits = closedTrades.filter(t => (t.profit || 0) > 0).map(t => t.profit || 0);
    const losses = closedTrades.filter(t => (t.profit || 0) < 0).map(t => Math.abs(t.profit || 0));

    const totalProfit = closedTrades.reduce((sum, t) => sum + (t.profit || 0), 0);
    const totalPips = closedTrades.reduce((sum, t) => sum + (t.pips || 0), 0);
    const grossProfit = profits.reduce((sum, p) => sum + p, 0);
    const grossLoss = losses.reduce((sum, l) => sum + l, 0);

    const bestTrade = closedTrades.length > 0 ? Math.max(...closedTrades.map(t => t.profit || 0)) : 0;
    const worstTrade = closedTrades.length > 0 ? Math.min(...closedTrades.map(t => t.profit || 0)) : 0;

    const maxDrawdown = this.calculateMaxDrawdown(closedTrades);
    const symbolStats = this.getSymbolStats(closedTrades);
    const dayStats = this.getDayStats(closedTrades);
    const consecutive = this.calculateConsecutive(closedTrades);
    const avgHoldTime = this.calculateAverageHoldTime(closedTrades);

    return {
      totalTrades: trades.length,
      openTrades: openTrades.length,
      closedTrades: closedTrades.length,
      winningTrades: winningTrades.length,
      losingTrades: losingTrades.length,
      winRate: closedTrades.length > 0 ? (winningTrades.length / closedTrades.length) * 100 : 0,
      totalProfit,
      totalPips,
      averageProfit: profits.length > 0 ? grossProfit / profits.length : 0,
      averageLoss: losses.length > 0 ? grossLoss / losses.length : 0,
      profitFactor: grossLoss > 0 ? grossProfit / grossLoss : grossProfit,
      bestTrade,
      worstTrade,
      maxDrawdown,
      bestSymbol: symbolStats.best,
      worstSymbol: symbolStats.worst,
      averageHoldTime: avgHoldTime,
      consecutiveWins: consecutive.wins,
      consecutiveLosses: consecutive.losses,
      bestDay: dayStats.best,
      worstDay: dayStats.worst,
    };
  }

  private calculateMaxDrawdown(trades: Trade[]): number {
    if (trades.length === 0) return 0;
    let peak = 0;
    let maxDrawdown = 0;
    let currentBalance = 0;
    const sortedTrades = [...trades].sort((a, b) => 
      new Date(a.openTime).getTime() - new Date(b.openTime).getTime()
    );
    for (const trade of sortedTrades) {
      currentBalance += trade.profit || 0;
      if (currentBalance > peak) peak = currentBalance;
      const drawdown = peak - currentBalance;
      if (drawdown > maxDrawdown) maxDrawdown = drawdown;
    }
    return maxDrawdown;
  }

  private getSymbolStats(trades: Trade[]): { best: string; worst: string } {
    const symbolMap = new Map<string, number>();
    trades.forEach(t => {
      const current = symbolMap.get(t.symbol) || 0;
      symbolMap.set(t.symbol, current + (t.profit || 0));
    });
    let best = 'لا يوجد';
    let worst = 'لا يوجد';
    let bestProfit = -Infinity;
    let worstProfit = Infinity;
    symbolMap.forEach((profit, symbol) => {
      if (profit > bestProfit) { bestProfit = profit; best = symbol; }
      if (profit < worstProfit) { worstProfit = profit; worst = symbol; }
    });
    return { best, worst };
  }

  private getDayStats(trades: Trade[]): { best: string; worst: string } {
    const dayMap = new Map<string, number>();
    trades.forEach(t => {
      const day = new Date(t.openTime).toLocaleDateString('ar-SA');
      const current = dayMap.get(day) || 0;
      dayMap.set(day, current + (t.profit || 0));
    });
    let best = 'لا يوجد';
    let worst = 'لا يوجد';
    let bestProfit = -Infinity;
    let worstProfit = Infinity;
    dayMap.forEach((profit, day) => {
      if (profit > bestProfit) { bestProfit = profit; best = day; }
      if (profit < worstProfit) { worstProfit = profit; worst = day; }
    });
    return { best, worst };
  }

  private calculateConsecutive(trades: Trade[]): { wins: number; losses: number } {
    const sorted = [...trades].sort((a, b) => 
      new Date(a.closeTime || '').getTime() - new Date(b.closeTime || '').getTime()
    );
    let maxWins = 0, maxLosses = 0;
    let currentWins = 0, currentLosses = 0;
    for (const trade of sorted) {
      if (trade.status === 'WIN') {
        currentWins++;
        currentLosses = 0;
        if (currentWins > maxWins) maxWins = currentWins;
      } else if (trade.status === 'LOSS') {
        currentLosses++;
        currentWins = 0;
        if (currentLosses > maxLosses) maxLosses = currentLosses;
      }
    }
    return { wins: maxWins, losses: maxLosses };
  }

  private calculateAverageHoldTime(trades: Trade[]): number {
    let totalTime = 0;
    let count = 0;
    trades.forEach(t => {
      if (t.closeTime && t.openTime) {
        const open = new Date(t.openTime).getTime();
        const close = new Date(t.closeTime).getTime();
        totalTime += (close - open) / (1000 * 60 * 60);
        count++;
      }
    });
    return count > 0 ? totalTime / count : 0;
  }

  getRecentTrades(count: number = 10): Trade[] {
    return [...this.trades]
      .sort((a, b) => new Date(b.openTime).getTime() - new Date(a.openTime).getTime())
      .slice(0, count);
  }

  formatStatistics(stats: TradingStats, days: number = 30): string {
    let text = '📊 **إحصائيات التداول - آخر ' + days + ' يوم**\n\n';
    text += '━━━━━━━━━━━━━━━━━━━\n';
    
    text += '📈 **ملخص عام:**\n';
    text += '• إجمالي الصفقات: ' + stats.totalTrades + '\n';
    text += '• صفقات مفتوحة: ' + stats.openTrades + '\n';
    text += '• صفقات مغلقة: ' + stats.closedTrades + '\n\n';

    text += '💰 **الأداء:**\n';
    const profitEmoji = stats.totalProfit >= 0 ? '🟢' : '🔴';
    text += profitEmoji + ' الربح الكلي: $' + stats.totalProfit.toFixed(2) + '\n';
    text += '📊 إجمالي النقاط: ' + stats.totalPips.toFixed(1) + ' pips\n';
    text += ' نسبة الفوز: ' + stats.winRate.toFixed(1) + '%\n';
    text += '• صفقات رابحة: ' + stats.winningTrades + '\n';
    text += '• صفقات خاسرة: ' + stats.losingTrades + '\n\n';

    text += '💹 **التحليل المالي:**\n';
    text += '• متوسط الربح: $' + stats.averageProfit.toFixed(2) + '\n';
    text += '• متوسط الخسارة: $' + stats.averageLoss.toFixed(2) + '\n';
    text += '• Profit Factor: ' + stats.profitFactor.toFixed(2) + '\n';
    text += '🏆 أفضل صفقة: $' + stats.bestTrade.toFixed(2) + '\n';
    text += '📉 أسوأ صفقة: $' + stats.worstTrade.toFixed(2) + '\n';
    text += '⚠️ Max Drawdown: $' + stats.maxDrawdown.toFixed(2) + '\n\n';

    text += ' **التحليل التفصيلي:**\n';
    text += '• أفضل زوج: ' + stats.bestSymbol + '\n';
    text += '• أسوأ زوج: ' + stats.worstSymbol + '\n';
    text += '• أفضل يوم: ' + stats.bestDay + '\n';
    text += '• أسوأ يوم: ' + stats.worstDay + '\n';
    text += '• متوسط مدة الصفقة: ' + stats.averageHoldTime.toFixed(1) + ' ساعة\n';
    text += ' أكبر سلسلة انتصارات: ' + stats.consecutiveWins + '\n';
    text += ' أكبر سلسلة خسائر: ' + stats.consecutiveLosses + '\n\n';

    const grade = this.calculateGrade(stats);
    text += '⭐ **التقييم العام:** ' + grade.emoji + ' ' + grade.text + '\n';
    text += '━━━━━━━━━━━━━━━━━━━';

    return text;
  }

  private calculateGrade(stats: TradingStats): { emoji: string; text: string } {
    if (stats.closedTrades < 5) return { emoji: '🆕', text: 'جديد - تحتاج مزيد من الصفقات' };
    if (stats.winRate >= 60 && stats.profitFactor >= 2.0) return { emoji: '', text: 'ممتاز - أداء احترافي!' };
    if (stats.winRate >= 55 && stats.profitFactor >= 1.5) return { emoji: '🌟', text: 'جيد جداً' };
    if (stats.winRate >= 50 && stats.profitFactor >= 1.2) return { emoji: '👍', text: 'جيد' };
    if (stats.winRate >= 45) return { emoji: '️', text: 'متوسط - يحتاج تحسين' };
    return { emoji: '❌', text: 'ضعيف - راجع استراتيجيتك' };
  }

  close(): void {
    this.saveTrades();
  }
}