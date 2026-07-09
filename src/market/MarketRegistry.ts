export interface MarketAsset {
  symbol: string;
  name: string;
  type: string;
}

export interface MarketCategory {
  id: string;
  name: string;
  emoji: string;
  assets: MarketAsset[];
}

export class MarketRegistry {
  private markets: MarketCategory[] = [
    {
      id: 'forex_major',
      name: 'Forex - الأزواج الرئيسية',
      emoji: '💱',
      assets: [
        { symbol: 'EUR/USD', name: 'EUR/USD', type: 'forex' },
        { symbol: 'GBP/USD', name: 'GBP/USD', type: 'forex' },
        { symbol: 'USD/JPY', name: 'USD/JPY', type: 'forex' },
        { symbol: 'USD/CHF', name: 'USD/CHF', type: 'forex' },
        { symbol: 'AUD/USD', name: 'AUD/USD', type: 'forex' },
        { symbol: 'USD/CAD', name: 'USD/CAD', type: 'forex' },
        { symbol: 'NZD/USD', name: 'NZD/USD', type: 'forex' },
      ]
    },
    {
      id: 'forex_minor',
      name: 'Forex - الأزواج الفرعية',
      emoji: '💱',
      assets: [
        { symbol: 'EUR/GBP', name: 'EUR/GBP', type: 'forex' },
        { symbol: 'EUR/JPY', name: 'EUR/JPY', type: 'forex' },
        { symbol: 'GBP/JPY', name: 'GBP/JPY', type: 'forex' },
        { symbol: 'EUR/CHF', name: 'EUR/CHF', type: 'forex' },
        { symbol: 'EUR/AUD', name: 'EUR/AUD', type: 'forex' },
        { symbol: 'EUR/CAD', name: 'EUR/CAD', type: 'forex' },
        { symbol: 'GBP/CHF', name: 'GBP/CHF', type: 'forex' },
        { symbol: 'GBP/AUD', name: 'GBP/AUD', type: 'forex' },
        { symbol: 'GBP/CAD', name: 'GBP/CAD', type: 'forex' },
        { symbol: 'GBP/NZD', name: 'GBP/NZD', type: 'forex' },
        { symbol: 'CHF/JPY', name: 'CHF/JPY', type: 'forex' },
        { symbol: 'AUD/JPY', name: 'AUD/JPY', type: 'forex' },
        { symbol: 'AUD/NZD', name: 'AUD/NZD', type: 'forex' },
        { symbol: 'CAD/JPY', name: 'CAD/JPY', type: 'forex' },
        { symbol: 'NZD/JPY', name: 'NZD/JPY', type: 'forex' },
      ]
    },
    {
      id: 'metals',
      name: 'المعادن الثمينة',
      emoji: '🥇',
      assets: [
        { symbol: 'XAU/USD', name: 'الذهب', type: 'metal' },
        { symbol: 'XAG/USD', name: 'الفضة', type: 'metal' },
        { symbol: 'XPT/USD', name: 'البلاتين', type: 'metal' },
        { symbol: 'XPD/USD', name: 'البلاديوم', type: 'metal' },
      ]
    },
    {
      id: 'energy',
      name: 'الطاقة',
      emoji: '⚡',
      assets: [
        { symbol: 'WTI/USD', name: 'نفط WTI', type: 'energy' },
        { symbol: 'BRENT/USD', name: 'نفط برنت', type: 'energy' },
        { symbol: 'NATGAS/USD', name: 'غاز طبيعي', type: 'energy' },
      ]
    },
    {
      id: 'crypto',
      name: 'العملات الرقمية',
      emoji: '₿',
      assets: [
        { symbol: 'BTC/USD', name: 'بيتكوين', type: 'crypto' },
        { symbol: 'ETH/USD', name: 'إيثيريوم', type: 'crypto' },
        { symbol: 'BNB/USD', name: 'باينانس', type: 'crypto' },
        { symbol: 'XRP/USD', name: 'ريبل', type: 'crypto' },
        { symbol: 'ADA/USD', name: 'كاردانو', type: 'crypto' },
        { symbol: 'SOL/USD', name: 'سولانا', type: 'crypto' },
        { symbol: 'DOGE/USD', name: 'دوجكوين', type: 'crypto' },
      ]
    },
    {
      id: 'indices',
      name: 'المؤشرات العالمية',
      emoji: '📊',
      assets: [
        { symbol: 'INDEX:SPX', name: 'S&P 500', type: 'index' },
        { symbol: 'INDEX:DJI', name: 'داو جونز', type: 'index' },
        { symbol: 'INDEX:NDX', name: 'ناسداك 100', type: 'index' },
        { symbol: 'INDEX:DAX', name: 'داكس الألماني', type: 'index' },
        { symbol: 'INDEX:FTSE', name: 'فوتسي 100', type: 'index' },
        { symbol: 'INDEX:N225', name: 'نيكاي 225', type: 'index' },
        { symbol: 'INDEX:HSI', name: 'هانغ سنغ', type: 'index' },
        { symbol: 'INDEX:CAC', name: 'كاك 40', type: 'index' },
        { symbol: 'INDEX:IBEX', name: 'IBEX 35', type: 'index' },
        { symbol: 'INDEX:AORD', name: 'ASX 200', type: 'index' },
      ]
    }
  ];

  getMarkets(): MarketCategory[] {
    return this.markets;
  }

  getMarketById(id: string): MarketCategory | undefined {
    return this.markets.find(m => m.id === id);
  }

  getAssetBySymbol(symbol: string): MarketAsset | undefined {
    for (const market of this.markets) {
      const asset = market.assets.find(a => a.symbol === symbol);
      if (asset) return asset;
    }
    return undefined;
  }

  getAllSymbols(): string[] {
    const symbols: string[] = [];
    for (const market of this.markets) {
      for (const asset of market.assets) {
        symbols.push(asset.symbol);
      }
    }
    return symbols;
  }
}