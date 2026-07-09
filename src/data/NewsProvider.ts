export interface NewsItem {
  title: string;
  impact: 'HIGH' | 'MEDIUM' | 'LOW';
  currency: string;
  time: string;
  forecast?: string;
  previous?: string;
  actual?: string;
}

export class NewsProvider {
  async getEconomicCalendar(currency?: string): Promise<NewsItem[]> {
    const news: NewsItem[] = [
      {
        title: 'Non-Farm Payrolls',
        impact: 'HIGH',
        currency: 'USD',
        time: '15:30',
        forecast: '180K',
        previous: '150K',
      },
      {
        title: 'CPI m/m',
        impact: 'HIGH',
        currency: 'USD',
        time: '15:30',
        forecast: '0.3%',
        previous: '0.2%',
      },
      {
        title: 'ECB Interest Rate Decision',
        impact: 'HIGH',
        currency: 'EUR',
        time: '14:45',
        forecast: '4.50%',
        previous: '4.50%',
      },
      {
        title: 'Unemployment Rate',
        impact: 'MEDIUM',
        currency: 'USD',
        time: '15:30',
        forecast: '3.7%',
        previous: '3.7%',
      },
      {
        title: 'GDP q/q',
        impact: 'MEDIUM',
        currency: 'GBP',
        time: '09:00',
        forecast: '0.2%',
        previous: '0.1%',
      },
    ];

    if (currency) {
      return news.filter(n => n.currency === currency);
    }
    return news;
  }

  async getHighImpactNews(): Promise<NewsItem[]> {
    const allNews = await this.getEconomicCalendar();
    return allNews.filter(n => n.impact === 'HIGH');
  }
}