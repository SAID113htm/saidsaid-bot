import { YahooFinanceClient } from '../providers/YahooFinanceClient';
import { SmartMoneyAnalyzer, Candle } from '../smartmoney/SmartMoney';
import { NewsAnalyzer } from '../news/NewsAnalyzer';
import { Telegraf } from 'telegraf';
import * as fs from 'fs';
import * as path from 'path';

export interface AlertRule {
  id: string;
  userId: number;
  symbol: string;
  type: 'ORDER_BLOCK' | 'BOS' | 'CHOCH' | 'RSI' | 'PRICE_TARGET' | 'NEWS';
  condition: {
    direction?: 'BUY' | 'SELL';
    rsiThreshold?: number;
    priceTarget?: number;
    minConfidence?: number;
  };
  isActive: boolean;
  createdAt: string;
  lastTriggered?: string;
}

export interface TriggeredAlert {
  rule: AlertRule;
  message: string;
  timestamp: Date;
  currentPrice: number;
}

export class AlertEngine {
  private yahoo: YahooFinanceClient;
  private smc: SmartMoneyAnalyzer;
  private news: NewsAnalyzer;
  private bot: Telegraf;
  private rules: AlertRule[] = [];
  private triggeredAlerts: Set<string> = new Set();
  private rulesFile: string;

  constructor(bot: Telegraf) {
    this.yahoo = new YahooFinanceClient();
    this.smc = new SmartMoneyAnalyzer();
    this.news = new NewsAnalyzer();
    this.bot = bot;
    this.rulesFile = path.join(__dirname, '../../alerts.json');
    this.loadRules();
  }

  private loadRules(): void {
    if (fs.existsSync(this.rulesFile)) {
      try {
        const data = fs.readFileSync(this.rulesFile, 'utf-8');
        this.rules = JSON.parse(data);
        console.log('✅ Loaded ' + this.rules.length + ' alert rules');
      } catch (error) {
        console.error('❌ Failed to load rules:', error);
        this.rules = [];
      }
    }
  }

  private saveRules(): void {
    fs.writeFileSync(this.rulesFile, JSON.stringify(this.rules, null, 2));
  }

  addRule(rule: Omit<AlertRule, 'id' | 'createdAt' | 'isActive'>): AlertRule {
    const newRule: AlertRule = {
      ...rule,
      id: 'alert_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
      isActive: true,
      createdAt: new Date().toISOString(),
    };

    this.rules.push(newRule);
    this.saveRules();
    return newRule;
  }

  removeRule(ruleId: string, userId: number): boolean {
    const initialLength = this.rules.length;
    this.rules = this.rules.filter(r => r.id !== ruleId || r.userId !== userId);
    
    if (this.rules.length < initialLength) {
      this.saveRules();
      return true;
    }
    return false;
  }

  getUserRules(userId: number): AlertRule[] {
    return this.rules.filter(r => r.userId === userId && r.isActive);
  }

  toggleRule(ruleId: string, userId: number): boolean {
    const rule = this.rules.find(r => r.id === ruleId && r.userId === userId);
    if (rule) {
      rule.isActive = !rule.isActive;
      this.saveRules();
      return true;
    }
    return false;
  }

  async checkAllAlerts(): Promise<TriggeredAlert[]> {
    const triggered: TriggeredAlert[] = [];
    const activeRules = this.rules.filter(r => r.isActive);

    for (const rule of activeRules) {
      try {
        const alert = await this.checkRule(rule);
        if (alert) {
          triggered.push(alert);
          await this.sendAlertToUser(alert);
          rule.lastTriggered = new Date().toISOString();
        }
      } catch (error) {
        console.error('❌ Error checking rule ' + rule.id + ':', error);
      }
    }

    this.saveRules();
    return triggered;
  }

  private async checkRule(rule: AlertRule): Promise<TriggeredAlert | null> {
    const alertKey = rule.id + '_' + new Date().toDateString();
    
    if (this.triggeredAlerts.has(alertKey)) {
      return null;
    }

    try {
      const quote = await this.yahoo.getQuote(rule.symbol);
      const currentPrice = parseFloat(quote.close);

      const d1Data = await this.yahoo.getTimeSeries(rule.symbol, '1day', 50);

      const d1Candles: Candle[] = d1Data.values.map((c: any) => ({
        time: c.datetime,
        open: parseFloat(c.open),
        high: parseFloat(c.high),
        low: parseFloat(c.low),
        close: parseFloat(c.close),
        volume: parseFloat(c.volume),
      }));

      let message = '';
      let shouldTrigger = false;

      switch (rule.type) {
        case 'ORDER_BLOCK': {
          const smcAnalysis = this.smc.analyze(d1Candles);
          if (this.checkOrderBlock(smcAnalysis, currentPrice, rule.condition.direction)) {
            message = this.formatOrderBlockAlert(rule.symbol, currentPrice, smcAnalysis, rule.condition.direction);
            shouldTrigger = true;
          }
          break;
        }

        case 'BOS': {
          const bosSmc = this.smc.analyze(d1Candles);
          if (this.checkBOS(bosSmc, rule.condition.direction)) {
            message = this.formatBOSAlert(rule.symbol, currentPrice, bosSmc, rule.condition.direction);
            shouldTrigger = true;
          }
          break;
        }

        case 'CHOCH': {
          const chochSmc = this.smc.analyze(d1Candles);
          if (this.checkCHOCH(chochSmc, rule.condition.direction)) {
            message = this.formatCHOCHAlert(rule.symbol, currentPrice, chochSmc, rule.condition.direction);
            shouldTrigger = true;
          }
          break;
        }

        case 'RSI': {
          const rsi = this.calculateRSI(d1Candles);
          const threshold = rule.condition.rsiThreshold || 30;
          if ((rule.condition.direction === 'BUY' && rsi < threshold) ||
              (rule.condition.direction === 'SELL' && rsi > (100 - threshold))) {
            message = this.formatRSIAlert(rule.symbol, currentPrice, rsi, rule.condition.direction);
            shouldTrigger = true;
          }
          break;
        }

        case 'PRICE_TARGET': {
          const target = rule.condition.priceTarget || 0;
          if (target > 0 && this.priceReachedTarget(currentPrice, target, 0.001)) {
            message = this.formatPriceAlert(rule.symbol, currentPrice, target);
            shouldTrigger = true;
          }
          break;
        }

        case 'NEWS': {
          const highNews = await this.news.getHighImpactNews(rule.symbol);
          if (highNews.length > 0) {
            message = this.formatNewsAlert(rule.symbol, highNews);
            shouldTrigger = true;
          }
          break;
        }
      }

      if (shouldTrigger && message) {
        this.triggeredAlerts.add(alertKey);
        return {
          rule,
          message,
          timestamp: new Date(),
          currentPrice,
        };
      }
    } catch (error) {
      console.error('❌ Error in checkRule for ' + rule.symbol + ':', error);
    }

    return null;
  }

  private checkOrderBlock(smc: any, currentPrice: number, direction?: string): boolean {
    if (!smc || !smc.orderBlocks) return false;

    if (direction === 'BUY' && smc.orderBlocks.bullish?.length > 0) {
      return smc.orderBlocks.bullish.some((ob: any) => {
        const distance = Math.abs(currentPrice - ob.high) / currentPrice;
        return distance < 0.005;
      });
    }

    if (direction === 'SELL' && smc.orderBlocks.bearish?.length > 0) {
      return smc.orderBlocks.bearish.some((ob: any) => {
        const distance = Math.abs(currentPrice - ob.low) / currentPrice;
        return distance < 0.005;
      });
    }

    return false;
  }

  private checkBOS(smc: any, direction?: string): boolean {
    if (!smc || !smc.bos) return false;
    if (direction === 'BUY') return smc.bos.bullish === true;
    if (direction === 'SELL') return smc.bos.bearish === true;
    return smc.bos.bullish === true || smc.bos.bearish === true;
  }

  private checkCHOCH(smc: any, direction?: string): boolean {
    if (!smc || !smc.choch) return false;
    if (direction === 'BUY') return smc.choch.bullish === true;
    if (direction === 'SELL') return smc.choch.bearish === true;
    return smc.choch.bullish === true || smc.choch.bearish === true;
  }

  private calculateRSI(candles: Candle[], period: number = 14): number {
    if (candles.length < period + 1) return 50;
    let gains = 0, losses = 0;
    for (let i = 1; i <= period; i++) {
      const ch = candles[i - 1].close - candles[i].close;
      if (ch > 0) gains += ch;
      else losses += Math.abs(ch);
    }
    const ag = gains / period, al = losses / period;
    if (al === 0) return 100;
    return 100 - (100 / (1 + ag / al));
  }

  private priceReachedTarget(current: number, target: number, tolerance: number): boolean {
    return Math.abs(current - target) / target <= tolerance;
  }

  private formatOrderBlockAlert(symbol: string, price: number, smc: any, direction?: string): string {
    const dir = direction === 'BUY' ? 'شراء 📈' : direction === 'SELL' ? 'بيع 📉' : 'تداول';
    let text = '🔔 **تنبيه: Order Block مهم!**\n\n';
    text += '━━━━━━━━━━━━━━━━━━━\n';
    text += '💱 **الزوج:** ' + symbol + '\n';
    text += '📍 **السعر الحالي:** ' + price.toFixed(5) + '\n';
    text += '🎯 **الاتجاه المقترح:** ' + dir + '\n';
    text += '━━━━━━━━━━━━━━━━━━━\n\n';
    
    if (direction === 'BUY' && smc.orderBlocks?.bullish?.length > 0) {
      text += '🟢 **Order Blocks صاعدة نشطة:**\n';
      smc.orderBlocks.bullish.slice(0, 2).forEach((ob: any, i: number) => {
        text += '   ' + (i + 1) + '. المنطقة: ' + ob.low.toFixed(5) + ' - ' + ob.high.toFixed(5) + '\n';
      });
    } else if (direction === 'SELL' && smc.orderBlocks?.bearish?.length > 0) {
      text += '🔴 **Order Blocks هابطة نشطة:**\n';
      smc.orderBlocks.bearish.slice(0, 2).forEach((ob: any, i: number) => {
        text += '   ' + (i + 1) + '. المنطقة: ' + ob.low.toFixed(5) + ' - ' + ob.high.toFixed(5) + '\n';
      });
    }

    text += '\n💡 **نصيحة:** انتظر تأكيد الانعكاس قبل الدخول';
    return text;
  }

  private formatBOSAlert(symbol: string, price: number, smc: any, direction?: string): string {
    const isBullish = direction === 'BUY' || (smc.bos?.bullish && !direction);
    const emoji = isBullish ? '' : '🔴';
    const dir = isBullish ? 'صاعد' : 'هابط';

    let text = '🔄 **تنبيه: كسر هيكل (BOS)!**\n\n';
    text += '━━━━━━━━━━━━━━━━━━━\n';
    text += '💱 **الزوج:** ' + symbol + '\n';
    text += '📍 **السعر:** ' + price.toFixed(5) + '\n';
    text += emoji + ' **الاتجاه الجديد:** ' + dir + '\n';
    text += '━━━━━━━━━━━━━━━━━━━\n\n';
    text += ' **التفسير:**\n';
    text += 'تم كسر آخر قمة/قاع مهمة، مما يؤكد استمرار الاتجاه ' + dir + '.\n\n';
    text += '💡 **نصيحة:** ابحث عن فرصة دخول مع اتجاه BOS';
    return text;
  }

  private formatCHOCHAlert(symbol: string, price: number, smc: any, direction?: string): string {
    const isBullish = direction === 'BUY' || (smc.choch?.bullish && !direction);
    const emoji = isBullish ? '🟢' : '🔴';
    const dir = isBullish ? 'صاعد' : 'هابط';

    let text = '⚡ **تنبيه: تغير اتجاه (CHOCH)!**\n\n';
    text += '━━━━━━━━━━━━━━━━━━━\n';
    text += '💱 **الزوج:** ' + symbol + '\n';
    text += '📍 **السعر:** ' + price.toFixed(5) + '\n';
    text += emoji + ' **الاتجاه الجديد:** ' + dir + '\n';
    text += '━━━━━━━━━━━━━━━━━━━\n\n';
    text += '📝 **التفسير:**\n';
    text += 'حدث تغير في هيكل السوق - انعكاس محتمل للاتجاه إلى ' + dir + '.\n\n';
    text += '💡 **نصيحة:** CHOCH أقوى من BOS - فرصة دخول ممتازة';
    return text;
  }

  private formatRSIAlert(symbol: string, price: number, rsi: number, direction?: string): string {
    const isOversold = rsi < 30;
    const emoji = isOversold ? '🟢' : '🔴';
    const zone = isOversold ? 'ذروة بيع' : 'ذروة شراء';

    let text = '📊 **تنبيه: RSI في منطقة متطرفة!**\n\n';
    text += '━━━━━━━━━━━━━━━━━━━\n';
    text += '💱 **الزوج:** ' + symbol + '\n';
    text += '📍 **السعر:** ' + price.toFixed(5) + '\n';
    text += '📈 **RSI:** ' + rsi.toFixed(1) + '\n';
    text += emoji + ' **المنطقة:** ' + zone + '\n';
    text += '━━━━━━━━━━━━━━━━━━━\n\n';
    text += ' **التفسير:**\n';
    text += isOversold 
      ? 'السعر في ذروة البيع - انعكاس صاعد محتمل 📈'
      : 'السعر في ذروة الشراء - تصحيح هابط محتمل 📉';
    text += '\n\n **نصيحة:** انتظر تأكيد الانعكاس قبل الدخول';
    return text;
  }

  private formatPriceAlert(symbol: string, currentPrice: number, target: number): string {
    let text = '🎯 **تم الوصول إلى السعر المستهدف!**\n\n';
    text += '━━━━━━━━━━━━━━━━━━━\n';
    text += '💱 **الزوج:** ' + symbol + '\n';
    text += '📍 **السعر الحالي:** ' + currentPrice.toFixed(5) + '\n';
    text += '🎯 **السعر المستهدف:** ' + target.toFixed(5) + '\n';
    text += '━━━━━━━━━━━━━━━━━━━\n\n';
    text += '✅ تم تحقيق هدفك! راجع صفقتك الآن.';
    return text;
  }

  private formatNewsAlert(symbol: string, news: any[]): string {
    let text = '⚠️ **تنبيه: أخبار عالية التأثير قادمة!**\n\n';
    text += '━━━━━━━━━━━━━━━━━━━\n';
    text += '💱 **الزوج:** ' + symbol + '\n';
    text += '━━━━━━━━━━━━━━━━━━━\n\n';
    
    news.slice(0, 3).forEach((n: any) => {
      text += '🔴 **' + n.title + '**\n';
      text += '    ' + n.time + '\n';
      text += '   💱 ' + n.currency + '\n\n';
    });

    text += '💡 **نصيحة:**\n';
    text += '• أغلق صفقاتك المفتوحة أو وسّع الـ SL\n';
    text += '• تجنب فتح صفقات جديدة قبل الخبر بـ 30 دقيقة\n';
    text += '• انتظر 15 دقيقة بعد الخبر للتداول';
    return text;
  }

  private async sendAlertToUser(alert: TriggeredAlert): Promise<void> {
    try {
      const keyboard = {
        inline_keyboard: [
          [
            { text: '📝 فتح صفقة', callback_data: 'alert_trade_' + alert.rule.id },
            { text: '❌ تجاهل', callback_data: 'alert_ignore_' + alert.rule.id },
          ],
          [{ text: '⏰ ذكّرني بعد ساعة', callback_data: 'alert_snooze_' + alert.rule.id }]
        ]
      };

      await this.bot.telegram.sendMessage(
        alert.rule.userId,
        alert.message,
        { reply_markup: keyboard, parse_mode: 'Markdown' }
      );

      console.log('✅ Alert sent to user ' + alert.rule.userId + ' for ' + alert.rule.symbol);
    } catch (error) {
      console.error('❌ Failed to send alert:', error);
    }
  }

  startMonitoring(intervalMinutes: number = 5): void {
    console.log('🔔 Starting alert monitoring (every ' + intervalMinutes + ' minutes)');
    
    setInterval(async () => {
      try {
        const triggered = await this.checkAllAlerts();
        if (triggered.length > 0) {
          console.log('🔔 Triggered ' + triggered.length + ' alerts');
        }
      } catch (error) {
        console.error('❌ Error in alert monitoring:', error);
      }
    }, intervalMinutes * 60 * 1000);
  }
}