import * as fs from 'fs';
import * as path from 'path';

interface JournalEntry {
  id: string;
  date: string;
  symbol: string;
  direction: 'BUY' | 'SELL';
  entry: number;
  stopLoss: number;
  takeProfit: number;
  exit: number;
  profit: number;
  profitPercent: number;
  confidence: number;
  result: 'WIN' | 'LOSS' | 'BREAKEVEN';
  notes: string;
  screenshot?: string;
}

export class TradeJournal {
  private filePath: string;
  private entries: JournalEntry[];

  constructor() {
    this.filePath = path.join(__dirname, '../../trades.json');
    this.entries = this.loadEntries();
  }

  private loadEntries(): JournalEntry[] {
    if (fs.existsSync(this.filePath)) {
      return JSON.parse(fs.readFileSync(this.filePath, 'utf-8'));
    }
    return [];
  }

  private saveEntries(): void {
    fs.writeFileSync(this.filePath, JSON.stringify(this.entries, null, 2));
  }

  addTrade(trade: Omit<JournalEntry, 'id' | 'date'>): JournalEntry {
    const entry: JournalEntry = {
      ...trade,
      id: `TRADE_${Date.now()}`,
      date: new Date().toISOString(),
    };

    this.entries.push(entry);
    this.saveEntries();
    
    console.log(`✅ Trade logged: ${entry.id}`);
    return entry;
  }

  getStatistics(): any {
    const totalTrades = this.entries.length;
    const winningTrades = this.entries.filter(e => e.result === 'WIN').length;
    const losingTrades = this.entries.filter(e => e.result === 'LOSS').length;
    const winRate = (winningTrades / totalTrades) * 100;
    
    const totalProfit = this.entries.reduce((sum, e) => sum + e.profit, 0);
    const averageProfit = totalProfit / totalTrades;
    
    const grossProfit = this.entries
      .filter(e => e.profit > 0)
      .reduce((sum, e) => sum + e.profit, 0);
    const grossLoss = Math.abs(
      this.entries
        .filter(e => e.profit < 0)
        .reduce((sum, e) => sum + e.profit, 0)
    );
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit;

    // حساب Max Drawdown
    let peakBalance = 1000;
    let currentBalance = 1000;
    let maxDrawdown = 0;
    
    this.entries.forEach(e => {
      currentBalance += e.profit;
      if (currentBalance > peakBalance) {
        peakBalance = currentBalance;
      }
      const drawdown = ((peakBalance - currentBalance) / peakBalance) * 100;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    });

    return {
      totalTrades,
      winningTrades,
      losingTrades,
      winRate: winRate.toFixed(2),
      totalProfit: totalProfit.toFixed(2),
      averageProfit: averageProfit.toFixed(2),
      profitFactor: profitFactor.toFixed(2),
      maxDrawdown: maxDrawdown.toFixed(2),
      bestTrade: Math.max(...this.entries.map(e => e.profit)).toFixed(2),
      worstTrade: Math.min(...this.entries.map(e => e.profit)).toFixed(2),
    };
  }

  getRecentTrades(count: number = 10): JournalEntry[] {
    return this.entries.slice(-count).reverse();
  }

  exportReport(): string {
    const stats = this.getStatistics();
    
    let report = '📊 Trade Journal Report\n';
    report += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n';
    report += `Total Trades: ${stats.totalTrades}\n`;
    report += `Win Rate: ${stats.winRate}%\n`;
    report += `Total Profit: $${stats.totalProfit}\n`;
    report += `Profit Factor: ${stats.profitFactor}\n`;
    report += `Max Drawdown: ${stats.maxDrawdown}%\n\n`;
    
    report += '📝 Recent Trades:\n';
    this.getRecentTrades(10).forEach(trade => {
      const emoji = trade.result === 'WIN' ? '✅' : trade.result === 'LOSS' ? '' : '⚪';
      report += `${emoji} ${trade.symbol} ${trade.direction} | $${trade.profit.toFixed(2)}\n`;
    });
    
    return report;
  }
}

// مثال على الاستخدام
const journal = new TradeJournal();

// إضافة صفقة
journal.addTrade({
  symbol: 'EUR/USD',
  direction: 'BUY',
  entry: 1.0850,
  stopLoss: 1.0820,
  takeProfit: 1.0910,
  exit: 1.0910,
  profit: 60,
  profitPercent: 0.55,
  confidence: 75,
  result: 'WIN',
  notes: 'BOS + CHOCH confirmation',
});

// عرض الإحصائيات
console.log(journal.getStatistics());