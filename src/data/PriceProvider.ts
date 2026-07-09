import { YahooFinanceClient } from '../providers/YahooFinanceClient';

export interface Candle {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface MarketData {
  symbol: string;
  currentPrice: number;
  change24h: number;
  high24h: number;
  low24h: number;
  volume24h: number;
  candles: {
    M15: Candle[];
    H1: Candle[];
    H4: Candle[];
    D1: Candle[];
    W1: Candle[];
    MN: Candle[];
  };
  timestamp: Date;
}

export class PriceProvider {
  private client: YahooFinanceClient;

  constructor(apiKey: string) {
    this.client = new YahooFinanceClient();
  }

  async getFullMarketData(symbol: string): Promise<MarketData> {
    console.log('📊 Fetching market data for:', symbol);

    try {
      const [d1Data, h4Data, h1Data, quote] = await Promise.all([
        this.client.getTimeSeries(symbol, '1day', 100),
        this.client.getTimeSeries(symbol, '1h', 100),
        this.client.getTimeSeries(symbol, '1h', 24),
        this.client.getQuote(symbol),
      ]);

      const currentPrice = parseFloat(quote.close);

      return {
        symbol: symbol,
        currentPrice,
        change24h: this.calculateChange(d1Data.values),
        high24h: Math.max(...d1Data.values.slice(0, 1).map((c: any) => parseFloat(c.high))),
        low24h: Math.min(...d1Data.values.slice(0, 1).map((c: any) => parseFloat(c.low))),
        volume24h: parseFloat(quote.volume || '0'),
        candles: {
          M15: this.formatCandles(h1Data.values.slice(0, 15)),
          H1: this.formatCandles(h1Data.values),
          H4: this.formatCandles(h4Data.values),
          D1: this.formatCandles(d1Data.values),
          W1: [],
          MN: [],
        },
        timestamp: new Date(),
      };
    } catch (error: any) {
      console.error('❌ PriceProvider Error:', error);
      throw error;
    }
  }

  private formatCandles(raw: any[]): Candle[] {
    return raw.map((c: any) => ({
      time: c.datetime,
      open: parseFloat(c.open),
      high: parseFloat(c.high),
      low: parseFloat(c.low),
      close: parseFloat(c.close),
      volume: parseFloat(c.volume || '0'),
    }));
  }

  private calculateChange(candles: any[]): number {
    if (candles.length < 2) return 0;
    const prev = parseFloat(candles[1].close);
    const current = parseFloat(candles[0].close);
    return ((current - prev) / prev) * 100;
  }
}