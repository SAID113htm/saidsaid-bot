import axios from 'axios';

export interface NewsItem {
  title: string;
  titleAr: string;
  time: string;
  timeLocal: string;
  currency: string;
  impact: 'HIGH' | 'MEDIUM' | 'LOW';
  impactAr: string;
  country: string;
  countryAr: string;
  flag: string;
  description?: string;
}

export class NewsAnalyzer {
  private translationMap: Map<string, string> = new Map([
    ['Non-Farm Payrolls', '🔥 تقرير الوظائف الأمريكي (NFP)'],
    ['Non-Farm Employment Change', '🔥 تغيير الوظائف غير الزراعية'],
    ['Unemployment Rate', '📊 معدل البطالة'],
    ['CPI m/m', '💰 مؤشر التضخم (CPI)'],
    ['CPI y/y', '💰 مؤشر التضخم (CPI)'],
    ['Core CPI m/m', '💰 مؤشر التضخم الأساسي (CPI)'],
    ['Core CPI y/y', '💰 مؤشر التضخم الأساسي (CPI)'],
    ['PPI m/m', '📈 مؤشر أسعار المنتجين (PPI)'],
    ['PPI y/y', '📈 مؤشر أسعار المنتجين (PPI)'],
    ['FOMC Interest Rate Decision', '🏦 قرار الفائدة الفيدرالي (FOMC)'],
    ['Federal Funds Rate', '🏦 معدل الفائدة الفيدرالي'],
    ['FOMC Statement', '📜 بيان اللجنة الفيدرالية'],
    ['Fed Chair Powell Speaks', '🎤 خطاب رئيس الفيدرالي باول'],
    ['Fed Chairman Warsh Testifies', '🎤 شهادة رئيس الفيدرالي وارش'],
    ['GDP q/q', '📊 الناتج المحلي الإجمالي (GDP)'],
    ['GDP y/y', '📊 الناتج المحلي الإجمالي (GDP)'],
    ['Retail Sales m/m', '🛒 المبيعات التجزئة'],
    ['ISM Manufacturing PMI', '🏭 مؤشر مديري المشتريات الصناعي'],
    ['ISM Services PMI', '🏢 مؤشر مديري المشتريات الخدمي'],
    ['ADP Non-Farm Employment Change', '👥 تقرير وظائف ADP'],
    ['Initial Jobless Claims', '📋 طلبات إعانة البطالة'],
    ['Consumer Confidence', '💪 ثقة المستهلك'],
    ['Michigan Consumer Sentiment', '📊 مؤشر ثقة المستهلك'],
    ['Existing Home Sales', '🏠 مبيعات المنازل القائمة'],
    ['New Home Sales', '🏠 مبيعات المنازل الجديدة'],
    ['Building Permits', '🏗️ تصاريح البناء'],
    ['Housing Starts', '🏗️ بدء البناء السكني'],
    ['Trade Balance', '⚖️ الميزان التجاري'],
    ['Crude Oil Inventories', '🛢️ مخزونات النفط الخام'],
    ['ECB Interest Rate Decision', '🏦 قرار الفائدة الأوروبي'],
    ['ECB Press Conference', '📺 المؤتمر الصحفي للبنك المركزي'],
    ['Eurozone GDP', '📊 الناتج المحلي لمنطقة اليورو'],
    ['Eurozone CPI', '💰 مؤشر التضخم لمنطقة اليورو'],
    ['German GDP', '📊 الناتج المحلي الألماني'],
    ['German CPI', '💰 مؤشر التضخم الألماني'],
    ['UK GDP', '📊 الناتج المحلي البريطاني'],
    ['UK CPI', '💰 مؤشر التضخم البريطاني'],
    ['BOE Interest Rate Decision', '🏦 قرار الفائدة البريطاني'],
    ['BOJ Interest Rate Decision', '🏦 قرار الفائدة الياباني'],
    ['RBA Interest Rate Decision', '🏦 قرار الفائدة الأسترالي'],
    ['BOC Interest Rate Decision', '🏦 قرار الفائدة الكندي'],
    ['SNB Interest Rate Decision', '🏦 قرار الفائدة السويسري'],
    ['RBNZ Interest Rate Decision', '🏦 قرار الفائدة النيوزيلندي'],
  ]);

  private currencyMap: Map<string, { country: string; flag: string }> = new Map([
    ['USD', { country: 'الولايات المتحدة', flag: '🇺🇸' }],
    ['EUR', { country: 'منطقة اليورو', flag: '🇪🇺' }],
    ['GBP', { country: 'بريطانيا', flag: '🇬🇧' }],
    ['JPY', { country: 'اليابان', flag: '🇯🇵' }],
    ['AUD', { country: 'أستراليا', flag: '🇦🇺' }],
    ['CAD', { country: 'كندا', flag: '🇨🇦' }],
    ['CHF', { country: 'سويسرا', flag: '🇨🇭' }],
    ['NZD', { country: 'نيوزيلندا', flag: '🇳🇿' }],
    ['CNY', { country: 'الصين', flag: '🇨🇳' }],
    ['XAU', { country: 'الذهب', flag: '🥇' }],
    ['XAG', { country: 'الفضة', flag: '🥈' }],
  ]);

  constructor() {}

  private translateTitle(title: string): string {
    for (const [en, ar] of this.translationMap.entries()) {
      if (title.toLowerCase().includes(en.toLowerCase())) {
        return ar;
      }
    }
    return title;
  }

  private convertToLocalTime(utcTime: string): string {
    try {
      const date = new Date(utcTime);
      date.setHours(date.getHours() + 1);
      const days = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
      const day = days[date.getDay()];
      const hours = date.getHours().toString().padStart(2, '0');
      const minutes = date.getMinutes().toString().padStart(2, '0');
      return `${day} ${hours}:${minutes}`;
    } catch {
      return utcTime;
    }
  }

  private extractCurrency(title: string, defaultCurrency: string = 'USD'): string {
    const currencies = ['USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF', 'NZD', 'CNY'];
    for (const curr of currencies) {
      if (title.includes(curr)) return curr;
    }
    return defaultCurrency;
  }

  // ✅ دالة جديدة: تطبيع عنوان الخبر لإزالة التكرار
  private normalizeTitle(title: string): string {
    // إزالة m/m و y/y لأنها نفس الخبر
    let normalized = title.toLowerCase();
    normalized = normalized.replace(/\s*m\/m\s*/g, '').replace(/\s*y\/y\s*/g, '');
    normalized = normalized.replace(/\s+/, ' ').trim();
    
    // توحيد المصطلحات المتشابهة
    const synonyms: Record<string, string> = {
      'consumer price index': 'cpi',
      'producer price index': 'ppi',
      'gross domestic product': 'gdp',
      'interest rate decision': 'rate decision',
    };
    
    for (const [key, value] of Object.entries(synonyms)) {
      normalized = normalized.replace(key, value);
    }
    
    return normalized;
  }

  // ✅ دالة جديدة: إزالة التكرار الذكي
  private removeDuplicates(news: any[]): any[] {
    const uniqueNews = new Map<string, any>();
    
    for (const item of news) {
      const normalizedTitle = this.normalizeTitle(item.title || '');
      const time = item.date || '';
      const country = item.country || '';
      
      // مفتاح فريد: العنوان المطبع + الوقت + الدولة
      const key = `${normalizedTitle}|${time}|${country}`;
      
      if (!uniqueNews.has(key)) {
        uniqueNews.set(key, item);
      }
    }
    
    return Array.from(uniqueNews.values());
  }

  async getHighImpactNews(symbol: string = 'USD'): Promise<NewsItem[]> {
    try {
      const currency = this.extractCurrencyFromSymbol(symbol);
      const response = await axios.get(
        'https://nfs.faireconomy.media/ff_calendar_thisweek.json',
        { timeout: 10000 }
      );

      const allNews = response.data || [];
      
      // فلترة حسب العملة والأهمية
      const filteredNews = allNews.filter((item: any) => {
        const itemCurrency = item.country || 'USD';
        const isHighImpact = item.impact === 'High' || item.impact === 'Holiday';
        const matchesCurrency = itemCurrency === this.getCurrencyCountry(currency);
        return isHighImpact && matchesCurrency;
      });

      // ✅ إزالة التكرار الذكي
      const uniqueNews = this.removeDuplicates(filteredNews).slice(0, 5);

      return uniqueNews.map((item: any): NewsItem => {
        const curr = this.extractCurrency(item.title || '', currency);
        const countryInfo = this.currencyMap.get(curr) || { country: curr, flag: '🌍' };
        return {
          title: item.title || '',
          titleAr: this.translateTitle(item.title || ''),
          time: item.date || '',
          timeLocal: this.convertToLocalTime(item.date || ''),
          currency: curr,
          impact: 'HIGH',
          impactAr: '🔴 عالي التأثير',
          country: countryInfo.country,
          countryAr: countryInfo.country,
          flag: countryInfo.flag,
        };
      });
    } catch (error) {
      console.error('❌ Failed to fetch news:', error);
      return this.getFallbackNews(symbol);
    }
  }

  private extractCurrencyFromSymbol(symbol: string): string {
    const upper = symbol.toUpperCase();
    if (upper.includes('EUR')) return 'EUR';
    if (upper.includes('GBP')) return 'GBP';
    if (upper.includes('JPY')) return 'JPY';
    if (upper.includes('AUD')) return 'AUD';
    if (upper.includes('CAD')) return 'CAD';
    if (upper.includes('CHF')) return 'CHF';
    if (upper.includes('NZD')) return 'NZD';
    if (upper.includes('XAU')) return 'USD';
    if (upper.includes('XAG')) return 'USD';
    return 'USD';
  }

  private getCurrencyCountry(currency: string): string {
    const map: Record<string, string> = {
      'USD': 'USD', 'EUR': 'EUR', 'GBP': 'GBP', 'JPY': 'JPY',
      'AUD': 'AUD', 'CAD': 'CAD', 'CHF': 'CHF', 'NZD': 'NZD',
    };
    return map[currency] || 'USD';
  }

  private getFallbackNews(symbol: string): NewsItem[] {
    const currency = this.extractCurrencyFromSymbol(symbol);
    const countryInfo = this.currencyMap.get(currency) || { country: currency, flag: '🌍' };
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
    
    return [{
      title: 'Non-Farm Payrolls',
      titleAr: '🔥 تقرير الوظائف الأمريكي (NFP)',
      time: tomorrow.toISOString(),
      timeLocal: this.convertToLocalTime(tomorrow.toISOString()),
      currency: 'USD',
      impact: 'HIGH',
      impactAr: '🔴 عالي التأثير',
      country: 'الولايات المتحدة',
      countryAr: 'الولايات المتحدة',
      flag: '🇺🇸',
    }];
  }

  formatNewsAlert(symbol: string, news: NewsItem[]): string {
    if (news.length === 0) {
      return '✅ **لا توجد أخبار عالية التأثير قادمة**\n\n' +
             '💱 الزوج: ' + symbol + '\n' +
             '━━━━━━━━━━━━━━━━━━━\n\n' +
             '📊 السوق هادئ - يمكنك التداول بحرية';
    }

    const newsByCountry = new Map<string, NewsItem[]>();
    news.forEach(n => {
      const key = n.flag + ' ' + n.countryAr;
      if (!newsByCountry.has(key)) {
        newsByCountry.set(key, []);
      }
      newsByCountry.get(key)!.push(n);
    });

    let text = '⚠️ **تنبيه: أخبار عالية التأثير قادمة!**\n\n';
    text += '━━━━━━━━━━━━━━━━━━━\n';
    text += '💱 **الزوج:** ' + symbol + '\n';
    text += '📅 **عدد الأخبار:** ' + news.length + '\n';
    text += '━━━━━━━━━━━━━━━━━━━\n\n';

    newsByCountry.forEach((items, country) => {
      text += country + '\n';
      text += '─────────────────\n';
      items.forEach(n => {
        text += '🔴 **' + n.titleAr + '**\n';
        text += '    🕐 ' + n.timeLocal + '\n';
        text += '    💱 ' + n.currency + '\n\n';
      });
    });

    text += '💡 **نصائح التداول:**\n';
    text += '• 🛑 أغلق صفقاتك المفتوحة أو وسّع الـ SL\n';
    text += '• ⚠️ تجنب فتح صفقات جديدة قبل الخبر بـ 30 دقيقة\n';
    text += '• ⏰ انتظر 15 دقيقة بعد الخبر للتداول\n';
    text += '• 📊 راقب التقلبات - قد تكون حادة\n';
    text += '• 🎯 استخدم حجم صفقة أصغر من المعتاد';

    return text;
  }

  formatNewsForSymbol(symbol: string): string {
    const news = this.getFallbackNews(symbol);
    return this.formatNewsAlert(symbol, news);
  }

  async formatNewsForSymbolAsync(symbol: string): Promise<string> {
    try {
      const news = await this.getHighImpactNews(symbol);
      return this.formatNewsAlert(symbol, news);
    } catch (error) {
      return this.formatNewsForSymbol(symbol);
    }
  }

  async getAllHighImpactNews(): Promise<NewsItem[]> {
    try {
      const response = await axios.get(
        'https://nfs.faireconomy.media/ff_calendar_thisweek.json',
        { timeout: 10000 }
      );

      const allNews = response.data || [];
      const filteredNews = allNews.filter((item: any) => item.impact === 'High');
      
      // ✅ إزالة التكرار
      const uniqueNews = this.removeDuplicates(filteredNews).slice(0, 10);

      return uniqueNews.map((item: any): NewsItem => {
        const curr = this.extractCurrency(item.title || '', 'USD');
        const countryInfo = this.currencyMap.get(curr) || { country: curr, flag: '🌍' };
        return {
          title: item.title || '',
          titleAr: this.translateTitle(item.title || ''),
          time: item.date || '',
          timeLocal: this.convertToLocalTime(item.date || ''),
          currency: curr,
          impact: 'HIGH',
          impactAr: '🔴 عالي التأثير',
          country: countryInfo.country,
          countryAr: countryInfo.country,
          flag: countryInfo.flag,
        };
      });
    } catch (error) {
      console.error('❌ Failed to fetch all news:', error);
      return [];
    }
  }
}