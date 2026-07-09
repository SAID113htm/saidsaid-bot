import axios from 'axios';

export class YahooFinanceClient {
  private baseUrl = 'https://query1.finance.yahoo.com/v8/finance/chart';

  private symbolMap: { [key: string]: string } = {
    'EUR/USD': 'EURUSD=X',
    'GBP/USD': 'GBPUSD=X',
    'USD/JPY': 'USDJPY=X',
    'USD/CHF': 'USDCHF=X',
    'AUD/USD': 'AUDUSD=X',
    'USD/CAD': 'USDCAD=X',
    'NZD/USD': 'NZDUSD=X',
    'EUR/GBP': 'EURGBP=X',
    'EUR/JPY': 'EURJPY=X',
    'GBP/JPY': 'GBPJPY=X',
    'EUR/CHF': 'EURCHF=X',
    'EUR/AUD': 'EURAUD=X',
    'EUR/CAD': 'EURCAD=X',
    'GBP/CHF': 'GBPCHF=X',
    'GBP/AUD': 'GBPAUD=X',
    'GBP/CAD': 'GBPCAD=X',
    'GBP/NZD': 'GBPNZD=X',
    'CHF/JPY': 'CHFJPY=X',
    'AUD/JPY': 'AUDJPY=X',
    'AUD/NZD': 'AUDNZD=X',
    'CAD/JPY': 'CADJPY=X',
    'NZD/JPY': 'NZDJPY=X',
    'XAU/USD': 'GC=F',
    'XAG/USD': 'SI=F',
    'XPT/USD': 'PL=F',
    'XPD/USD': 'PA=F',
    'WTI/USD': 'CL=F',
    'BRENT/USD': 'BZ=F',
    'NATGAS/USD': 'NG=F',
    'BTC/USD': 'BTC-USD',
    'ETH/USD': 'ETH-USD',
    'BNB/USD': 'BNB-USD',
    'XRP/USD': 'XRP-USD',
    'ADA/USD': 'ADA-USD',
    'SOL/USD': 'SOL-USD',
    'DOGE/USD': 'DOGE-USD',
    'DOT/USD': 'DOT-USD',
    'MATIC/USD': 'MATIC-USD',
    'LTC/USD': 'LTC-USD',
    'INDEX:SPX': '^GSPC',
    'INDEX:DJI': '^DJI',
    'INDEX:NDX': '^NDX',
    'INDEX:DAX': '^GDAXI',
    'INDEX:FTSE': '^FTSE',
    'INDEX:N225': '^N225',
    'INDEX:HSI': '^HSI',
    'INDEX:CAC': '^FCHI',
    'INDEX:IBEX': '^IBEX',
    'INDEX:AORD': '^AORD',
  };

  async getTimeSeries(symbol: string, interval: string = '1d', outputsize: number = 100): Promise<any> {
    try {
      const yahooSymbol = this.symbolMap[symbol] || symbol;
      
      const intervalMap: { [key: string]: string } = {
        '1min': '1m',
        '5min': '5m',
        '15min': '15m',
        '30min': '30m',
        '1h': '1h',
        '4h': '1h',
        '1day': '1d',
        '1week': '1wk',
        '1month': '1mo',
      };

      const yahooInterval = intervalMap[interval] || '1d';
      const range = outputsize > 100 ? '2y' : '1y';

      console.log(`📊 Yahoo Finance: ${symbol} -> ${yahooSymbol} (${yahooInterval})`);

      const response = await axios.get(`${this.baseUrl}/${yahooSymbol}`, {
        params: {
          interval: yahooInterval,
          range: range,
        },
      });

      const result = response.data;
      const timestamps = result.chart.result[0].timestamp;
      const quote = result.chart.result[0].indicators.quote[0];

      const values = timestamps.map((ts: number, i: number) => ({
        datetime: new Date(ts * 1000).toISOString().split('T')[0],
        open: quote.open[i]?.toString() || '0',
        high: quote.high[i]?.toString() || '0',
        low: quote.low[i]?.toString() || '0',
        close: quote.close[i]?.toString() || '0',
        volume: quote.volume[i]?.toString() || '0',
      })).filter((v: any) => v.close !== '0' && v.close !== null);

      return {
        meta: {
          symbol: symbol,
          interval: interval,
        },
        values: values.slice(-outputsize),
      };
    } catch (error: any) {
      console.error('❌ Yahoo Finance Error:', error.message);
      throw new Error(`Yahoo Finance Error: ${error.message}`);
    }
  }

  async getQuote(symbol: string): Promise<any> {
    try {
      const yahooSymbol = this.symbolMap[symbol] || symbol;

      const response = await axios.get(`https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}`, {
        params: {
          interval: '1d',
          range: '1d',
        },
      });

      const result = response.data;
      const meta = result.chart.result[0].meta;
      const quote = result.chart.result[0].indicators.quote[0];

      const currentClose = quote.close[quote.close.length - 1];
      const previousClose = meta.previousClose || quote.close[quote.close.length - 2] || currentClose;

      return {
        symbol: symbol,
        name: meta.symbol,
        exchange: meta.exchangeName,
        currency: meta.currency,
        open: quote.open[quote.open.length - 1]?.toString() || '0',
        high: quote.high[quote.high.length - 1]?.toString() || '0',
        low: quote.low[quote.low.length - 1]?.toString() || '0',
        close: currentClose?.toString() || '0',
        volume: quote.volume[quote.volume.length - 1]?.toString() || '0',
        previousClose: previousClose?.toString() || '0',
        change: (currentClose - previousClose).toString(),
        changePercent: ((currentClose - previousClose) / previousClose * 100).toString(),
      };
    } catch (error: any) {
      console.error('❌ Yahoo Finance Quote Error:', error.message);
      throw new Error(`Yahoo Finance Error: ${error.message}`);
    }
  }
}