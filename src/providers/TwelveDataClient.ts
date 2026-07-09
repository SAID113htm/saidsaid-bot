import axios from 'axios';

export interface CandleData {
  datetime: string;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
}

export interface TimeSeriesResponse {
  meta: {
    symbol: string;
    interval: string;
    currency: string;
    exchange: string;
    type: string;
  };
  values: CandleData[];
  status: string;
}

export class TwelveDataClient {
  private apiKey: string;
  private baseUrl = 'https://api.twelvedata.com';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async getTimeSeries(
    symbol: string,
    interval: string = '1day',
    outputsize: number = 100
  ): Promise<TimeSeriesResponse> {
    try {
      console.log(`📊 Fetching time series for: ${symbol}, interval: ${interval}`);
      
      const response = await axios.get(`${this.baseUrl}/time_series`, {
        params: {
          symbol: symbol,
          interval: interval,
          outputsize: outputsize,
          apikey: this.apiKey,
        },
      });

      if (response.data.status === 'error') {
        console.error('❌ TwelveData Error:', response.data.message);
        throw new Error(response.data.message || 'API Error');
      }

      console.log(`✅ Successfully fetched ${response.data.values?.length || 0} candles for ${symbol}`);
      return response.data;
    } catch (error: any) {
      console.error('❌ TwelveData TimeSeries Error:', error.response?.data || error.message);
      throw new Error(`TwelveData Error: ${error.response?.data?.message || error.message}`);
    }
  }

  async getQuote(symbol: string): Promise<any> {
    try {
      console.log(`📊 Fetching quote for: ${symbol}`);
      
      const response = await axios.get(`${this.baseUrl}/quote`, {
        params: {
          symbol: symbol,
          apikey: this.apiKey,
        },
      });

      if (response.data.status === 'error') {
        console.error('❌ TwelveData Quote Error:', response.data.message);
        throw new Error(response.data.message || 'API Error');
      }

      console.log(`✅ Successfully fetched quote for ${symbol}`);
      return response.data;
    } catch (error: any) {
      console.error('❌ TwelveData Quote Error:', error.response?.data || error.message);
      throw new Error(`TwelveData Error: ${error.response?.data?.message || error.message}`);
    }
  }
}