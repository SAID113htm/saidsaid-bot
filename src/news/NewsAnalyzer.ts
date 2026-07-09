export interface EconomicNews {
  title: string;
  impact: 'HIGH' | 'MEDIUM' | 'LOW';
  currency: string;
  time: string;
  source: string;
}

export class NewsAnalyzer {
  private economicCalendar: EconomicNews[] = [
    { title: '🔥 Non-Farm Payrolls (NFP)', impact: 'HIGH', currency: 'USD', time: 'الجمعة 15:30', source: 'Economic Calendar' },
    { title: ' CPI m/m (التضخم)', impact: 'HIGH', currency: 'USD', time: 'الثلاثاء 15:30', source: 'Economic Calendar' },
    { title: ' FOMC Interest Rate Decision', impact: 'HIGH', currency: 'USD', time: 'الأربعاء 21:00', source: 'Federal Reserve' },
    { title: '🔥 ECB Interest Rate Decision', impact: 'HIGH', currency: 'EUR', time: 'الخميس 14:45', source: 'ECB' },
    { title: '🔥 BOE Interest Rate Decision', impact: 'HIGH', currency: 'GBP', time: 'الخميس 14:00', source: 'Bank of England' },
    { title: '🔥 BOJ Interest Rate Decision', impact: 'HIGH', currency: 'JPY', time: 'الخميس 03:00', source: 'Bank of Japan' },
    { title: '📊 GDP q/q', impact: 'MEDIUM', currency: 'USD', time: 'الخميس 15:30', source: 'Economic Calendar' },
    { title: ' Unemployment Claims', impact: 'MEDIUM', currency: 'USD', time: 'الخميس 15:30', source: 'Economic Calendar' },
    { title: '📊 Retail Sales m/m', impact: 'MEDIUM', currency: 'USD', time: 'الجمعة 15:30', source: 'Economic Calendar' },
    { title: '📊 PMI Manufacturing', impact: 'MEDIUM', currency: 'EUR', time: 'الجمعة 10:00', source: 'Economic Calendar' },
  ];

  async getHighImpactNews(currency?: string): Promise<EconomicNews[]> {
    let news = this.economicCalendar.filter(n => n.impact === 'HIGH');
    
    if (currency) {
      const curr = this.extractCurrency(currency);
      news = news.filter(n => n.currency === curr);
    }
    
    return news;
  }

  async getAllNews(currency?: string): Promise<EconomicNews[]> {
    let news = this.economicCalendar;
    
    if (currency) {
      const curr = this.extractCurrency(currency);
      news = news.filter(n => n.currency === curr);
    }
    
    return news;
  }

  isTradingAllowed(symbol: string): boolean {
    const currency = this.extractCurrency(symbol);
    const highImpactNews = this.economicCalendar.filter(
      n => n.impact === 'HIGH' && n.currency === currency
    );
    return highImpactNews.length === 0;
  }

  formatNewsForSymbol(symbol: string, news: EconomicNews[]): string {
    if (news.length === 0) return '📰 لا توجد أخبار عالية التأثير';
    
    let text = '📰 **الأخبار الاقتصادية المؤثرة:**\n\n';
    news.forEach(n => {
      const emoji = n.impact === 'HIGH' ? '🔴' : '🟡';
      text += emoji + ' **' + n.title + '**\n';
      text += '   💱 العملة: ' + n.currency + '\n';
      text += '   🕐 الوقت: ' + n.time + '\n';
      text += '   📡 المصدر: ' + n.source + '\n\n';
    });
    
    return text;
  }

  private extractCurrency(symbol: string): string {
    if (symbol.includes('USD')) return 'USD';
    if (symbol.includes('EUR')) return 'EUR';
    if (symbol.includes('GBP')) return 'GBP';
    if (symbol.includes('JPY')) return 'JPY';
    if (symbol.includes('CHF')) return 'CHF';
    if (symbol.includes('AUD')) return 'AUD';
    if (symbol.includes('CAD')) return 'CAD';
    if (symbol.includes('NZD')) return 'NZD';
    return 'USD';
  }
}