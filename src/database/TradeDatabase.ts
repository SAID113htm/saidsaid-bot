import Database from 'better-sqlite3';
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
  private db: Database.Database;

  constructor() {
    const dbPath = path.join(__dirname, '../../trades.db');
    this.db = new Database(dbPath);
    this.initializeDatabase();
  }

  private initializeDatabase(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS trades (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        symbol TEXT NOT NULL,
        direction TEXT NOT NULL,
        entry REAL NOT NULL,
        stop_loss REAL NOT NULL,
        take_profit REAL NOT NULL,
        exit_price REAL,
        lot_size REAL NOT NULL,
        risk_percent REAL NOT NULL,
        confidence INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'OPEN',
        profit REAL,
        pips REAL,
        reason TEXT,
        notes TEXT,
        open_time TEXT NOT NULL,
        close_time TEXT,
        strategy TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE INDEX IF NOT EXISTS idx_trades_status ON trades(status);
      CREATE INDEX IF NOT EXISTS idx_trades_symbol ON trades(symbol);
      CREATE INDEX IF NOT EXISTS idx_trades_open_time ON trades(open_time);
    `);
  }

  addTrade(trade: Omit<Trade, 'id'>): number {
    const stmt = this.db.prepare(`
      INSERT INTO trades (
        symbol, direction, entry, stop_loss, take_profit, exit_price,
        lot_size, risk_percent, confidence, status, profit, pips,
        reason, notes, open_time, close_time, strategy
      ) VALUES (
        @symbol, @direction, @entry, @stopLoss, @takeProfit, @exitPrice,
        @lotSize, @riskPercent, @confidence, @status, @profit, @pips,
        @reason, @notes, @openTime, @closeTime, @strategy
      )
    `);

    const result = stmt.run({
      symbol: trade.symbol,
      direction: trade.direction,
      entry: trade.entry,
      stopLoss: trade.stopLoss,
      takeProfit: trade.takeProfit,
      exitPrice: trade.exitPrice || null,
      lotSize: trade.lotSize,
      riskPercent: trade.riskPercent,
      confidence: trade.confidence,
      status: trade.status,
      profit: trade.profit || null,
      pips: trade.pips || null,
      reason: trade.reason,
      notes: trade.notes || null,
      openTime: trade.openTime,
      closeTime: trade.closeTime || null,
      strategy: trade.strategy,
    });

    return result.lastInsertRowid as number;
  }

  closeTrade(id: number, exitPrice: number, status: 'WIN' | 'LOSS' | 'BREAKEVEN', profit: number, pips: number): void {
    const stmt = this.db.prepare(`
      UPDATE trades 
      SET exit_price = ?, status = ?, profit = ?, pips = ?, close_time = ?
      WHERE id = ?
    `);
    stmt.run(exitPrice, status, profit, pips, new Date().toISOString(), id);
  }

  getOpenTrades(): Trade[] {
    const stmt = this.db.prepare('SELECT * FROM trades WHERE status = ?');
    return stmt.all('OPEN') as Trade[];
  }

  getTradeById(id: number): Trade | undefined {
    const stmt = this.db.prepare('SELECT * FROM trades WHERE id = ?');
    return stmt.get(id) as Trade | undefined;
  }

  getStatistics(days: number = 30): TradingStats {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const startDateStr = startDate.toISOString();

    const stmt = this.db.prepare(`
      SELECT * FROM trades 
      WHERE open_time >= ? 
      ORDER BY open_time DESC
    `);
    const trades = stmt.all(startDateStr) as Trade[];

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
    const stmt = this.db.prepare('SELECT * FROM trades ORDER BY open_time DESC LIMIT ?');
    return stmt.all(count) as Trade[];
  }

  formatStatistics(stats: TradingStats, days: number = 30): string {
    let text = '📊 **إحصائيات التداول - آخر ' + days + ' يوم**\n\n';
    text += '━━━━━━━━━━━━━━━━━━━\n';
    
    text += ' **ملخص عام:**\n';
    text += '• إجمالي الصفقات: ' + stats.totalTrades + '\n';
    text += '• صفقات مفتوحة: ' + stats.openTrades + '\n';
    text += '• صفقات مغلقة: ' + stats.closedTrades + '\n\n';

    text += '💰 **الأداء:**\n';
    const profitEmoji = stats.totalProfit >= 0 ? '🟢' : '🔴';
    text += profitEmoji + ' الربح الكلي: $' + stats.totalProfit.toFixed(2) + '\n';
    text += '📊 إجمالي النقاط: ' + stats.totalPips.toFixed(1) + ' pips\n';
    text += '🎯 نسبة الفوز: ' + stats.winRate.toFixed(1) + '%\n';
    text += '• صفقات رابحة: ' + stats.winningTrades + '\n';
    text += '• صفقات خاسرة: ' + stats.losingTrades + '\n\n';

    text += '💹 **التحليل المالي:**\n';
    text += '• متوسط الربح: $' + stats.averageProfit.toFixed(2) + '\n';
    text += '• متوسط الخسارة: $' + stats.averageLoss.toFixed(2) + '\n';
    text += '• Profit Factor: ' + stats.profitFactor.toFixed(2) + '\n';
    text += '🏆 أفضل صفقة: $' + stats.bestTrade.toFixed(2) + '\n';
    text += '📉 أسوأ صفقة: $' + stats.worstTrade.toFixed(2) + '\n';
    text += '️ Max Drawdown: $' + stats.maxDrawdown.toFixed(2) + '\n\n';

    text += '🔍 **التحليل التفصيلي:**\n';
    text += '• أفضل زوج: ' + stats.bestSymbol + '\n';
    text += '• أسوأ زوج: ' + stats.worstSymbol + '\n';
    text += '• أفضل يوم: ' + stats.bestDay + '\n';
    text += '• أسوأ يوم: ' + stats.worstDay + '\n';
    text += '• متوسط مدة الصفقة: ' + stats.averageHoldTime.toFixed(1) + ' ساعة\n';
    text += '🏅 أكبر سلسلة انتصارات: ' + stats.consecutiveWins + '\n';
    text += '📉 أكبر سلسلة خسائر: ' + stats.consecutiveLosses + '\n\n';

    const grade = this.calculateGrade(stats);
    text += '⭐ **التقييم العام:** ' + grade.emoji + ' ' + grade.text + '\n';
    text += '━━━━━━━━━━━━━━━━━━━';

    return text;
  }

  private calculateGrade(stats: TradingStats): { emoji: string; text: string } {
    if (stats.closedTrades < 5) return { emoji: '🆕', text: 'جديد - تحتاج مزيد من الصفقات' };
    if (stats.winRate >= 60 && stats.profitFactor >= 2.0) return { emoji: '🏆', text: 'ممتاز - أداء احترافي!' };
    if (stats.winRate >= 55 && stats.profitFactor >= 1.5) return { emoji: '', text: 'جيد جداً' };
    if (stats.winRate >= 50 && stats.profitFactor >= 1.2) return { emoji: '👍', text: 'جيد' };
    if (stats.winRate >= 45) return { emoji: '⚠️', text: 'متوسط - يحتاج تحسين' };
    return { emoji: '❌', text: 'ضعيف - راجع استراتيجيتك' };
  }

  close(): void {
    this.db.close();
  }
}