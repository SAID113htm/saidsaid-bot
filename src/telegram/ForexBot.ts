import { Telegraf, Context } from 'telegraf';
import { config } from '../config/env';
import { Analyzer } from '../analysis/Analyzer';
import { MarketRegistry } from '../market/MarketRegistry';
import { SignalEngine } from '../signals/SignalEngine';
import { WeeklyReport } from '../reports/WeeklyReport';
import { TradeDatabase } from '../database/TradeDatabase';
import { AlertEngine } from '../alerts/AlertEngine';

interface UserState {
  step: 'idle' | 'awaiting_risk_data' | 'awaiting_trade' | 'awaiting_price_alert' | 'awaiting_alert_symbol';
  alertType?: string;
}

export class ForexBot {
  private bot: Telegraf;
  private analyzer: Analyzer;
  private marketRegistry: MarketRegistry;
  private signalEngine: SignalEngine;
  private weeklyReport: WeeklyReport;
  private tradeDb: TradeDatabase;
  private alertEngine: AlertEngine;
  private userStates: Map<number, UserState> = new Map();

  constructor() {
    console.log('🔧 Initializing bot...');
    this.bot = new Telegraf(config.bot.token);
    this.analyzer = new Analyzer();
    this.marketRegistry = new MarketRegistry();
    this.signalEngine = new SignalEngine();
    this.weeklyReport = new WeeklyReport();
    this.tradeDb = new TradeDatabase();
    this.alertEngine = new AlertEngine(this.bot);
    this.alertEngine.startMonitoring(5);
    this.setupBot();
  }

  private mainMenuKeyboard() {
    return {
      inline_keyboard: [
        [{ text: ' Forex', callback_data: 'market_forex' }],
        [
          { text: ' المعادن', callback_data: 'market_metals' },
          { text: '⚡ الطاقة', callback_data: 'market_energy' },
        ],
        [{ text: '₿ Crypto', callback_data: 'market_crypto' }],
        [{ text: '📊 المؤشرات', callback_data: 'market_indices' }],
        [{ text: '🔔 الإشارات المؤكدة', callback_data: 'get_signals' }],
        [{ text: '📈 التقرير الأسبوعي', callback_data: 'weekly_report' }],
        [{ text: ' التنبيهات', callback_data: 'my_alerts' }],
        [{ text: ' صفقاتي', callback_data: 'my_trades' }],
        [{ text: '️ تحليل مؤسسي', callback_data: 'institutional_info' }],
        [{ text: '🧮 حاسبة المخاطرة', callback_data: 'risk_info' }],
        [{ text: '❓ المساعدة', callback_data: 'help' }],
      ],
    };
  }

  private setupBot(): void {
    console.log('📝 Registering handlers...');

    this.bot.start((ctx) => {
      const name = ctx.from?.first_name || 'صديقي';
      ctx.reply(
        '👋 مرحباً ' + name + '!\n\n' +
        '🏛️ **SaidRaid AI - منصة التداول المؤسسية**\n\n' +
        '📊 تحليل ذكي يجمع بين:\n' +
        '• Smart Money Concepts\n' +
        '• Multi-Timeframe Analysis\n' +
        '• Bar Chart Patterns\n' +
        '• الأخبار الاقتصادية\n' +
        '• إشارات عالية الثقة\n' +
        '• تقارير أسبوعية\n' +
        '• 🔔 تنبيهات ذكية 24/7\n' +
        '• 📋 سجل التداول (Trade Journal)\n\n' +
        'اختر من القائمة:',
        { reply_markup: this.mainMenuKeyboard(), parse_mode: 'Markdown' }
      );
    });

    this.bot.help((ctx) => {
      ctx.reply(
        ' **الأوامر المتاحة:**\n\n' +
        '/start - القائمة الرئيسية\n' +
        '/analysis EUR/USD - تحليل عادي\n' +
        '/institutional EUR/USD - تحليل مؤسسي\n' +
        '/signals - إشارات التداول المؤكدة\n' +
        '/weekly - التقرير الأسبوعي\n' +
        '/alert - إنشاء تنبيه ذكي\n' +
        '/newtrade - تسجيل صفقة جديدة\n' +
        '/closetrade - إغلاق صفقة\n' +
        '/stats - إحصائيات التداول\n' +
        '/recent - آخر الصفقات\n' +
        '/risk - حاسبة المخاطرة\n\n' +
        '💡 أو استخدم الأزرار التفاعلية',
        { parse_mode: 'Markdown' }
      );
    });

    this.bot.command('analysis', async (ctx) => {
      const args = (ctx.message?.text || '').split(' ');
      if (args.length < 2) {
        ctx.reply('📊 استخدم: /analysis EUR/USD');
        return;
      }
      await this.performAnalysis(ctx, args[1].toUpperCase());
    });

    this.bot.command('institutional', async (ctx) => {
      const args = (ctx.message?.text || '').split(' ');
      if (args.length < 2) {
        ctx.reply('🏛️ استخدم: /institutional EUR/USD');
        return;
      }
      await this.performInstitutionalAnalysis(ctx, args[1].toUpperCase());
    });

    this.bot.command('signals', async (ctx) => {
      await this.handleSignals(ctx);
    });

    this.bot.command('weekly', async (ctx) => {
      await this.handleWeeklyReport(ctx);
    });

    this.bot.command('stats', async (ctx) => {
      const stats = this.tradeDb.getStatistics(30);
      const text = this.tradeDb.formatStatistics(stats, 30);
      
      const keyboard = {
        inline_keyboard: [
          [
            { text: '7 أيام', callback_data: 'stats_7' },
            { text: '30 يوم', callback_data: 'stats_30' },
            { text: '90 يوم', callback_data: 'stats_90' },
          ],
          [{ text: '🔄 تحديث', callback_data: 'stats_refresh' }]
        ]
      };

      await ctx.reply(text, { reply_markup: keyboard, parse_mode: 'Markdown' });
    });

    this.bot.command('recent', async (ctx) => {
      const trades = this.tradeDb.getRecentTrades(5);
      
      if (trades.length === 0) {
        await ctx.reply('📭 لا توجد صفقات مسجلة');
        return;
      }

      let text = '📋 **آخر 5 صفقات:**\n\n';
      
      trades.forEach(t => {
        const emoji = t.status === 'WIN' ? '🟢' : t.status === 'LOSS' ? '🔴' : t.status === 'OPEN' ? '🟡' : '⚪';
        text += emoji + ' #' + t.id + ' **' + t.symbol + '** ' + t.direction + '\n';
        text += '   💰 ' + (t.status === 'OPEN' ? 'مفتوحة' : '$' + (t.profit || 0).toFixed(2)) + '\n';
        text += '   📅 ' + new Date(t.openTime).toLocaleDateString('ar-SA') + '\n\n';
      });

      await ctx.reply(text, { parse_mode: 'Markdown' });
    });

    this.bot.command('newtrade', async (ctx) => {
      await ctx.reply(
        '📝 **تسجيل صفقة جديدة**\n\n' +
        '📋 أرسل البيانات بالترتيب:\n' +
        '`الزوج, الاتجاه, الدخول, SL, TP, اللوت, نسبة المخاطرة, السبب`\n\n' +
        '**مثال:**\n' +
        '`EUR/USD, BUY, 1.0850, 1.0820, 1.0910, 0.1, 1, BOS صاعد على H4`\n\n' +
        '💡 الاتجاه: BUY أو SELL',
        { parse_mode: 'Markdown' }
      );
      this.userStates.set(ctx.from.id, { step: 'awaiting_trade' });
    });

    this.bot.command('closetrade', async (ctx) => {
      const openTrades = this.tradeDb.getOpenTrades();
      
      if (openTrades.length === 0) {
        await ctx.reply('✅ لا توجد صفقات مفتوحة');
        return;
      }

      const keyboard = {
        inline_keyboard: openTrades.map(t => [{
          text: '#' + t.id + ' ' + t.symbol + ' ' + t.direction,
          callback_data: 'close_trade_' + t.id
        }])
      };

      await ctx.reply(
        '📋 **الصفقات المفتوحة:**\n\nاختر صفقة لإغلاقها:',
        { reply_markup: keyboard, parse_mode: 'Markdown' }
      );
    });

    this.bot.command('alert', async (ctx) => {
      const userId = ctx.from.id;
      
      const keyboard = {
        inline_keyboard: [
          [{ text: '🟢 تنبيه Order Block صاعد', callback_data: 'add_alert_OB_BUY' }],
          [{ text: '🔴 تنبيه Order Block هابط', callback_data: 'add_alert_OB_SELL' }],
          [{ text: ' تنبيه BOS', callback_data: 'add_alert_BOS' }],
          [{ text: '⚡ تنبيه CHOCH', callback_data: 'add_alert_CHOCH' }],
          [{ text: '📊 تنبيه RSI ذروة بيع', callback_data: 'add_alert_RSI_BUY' }],
          [{ text: '📊 تنبيه RSI ذروة شراء', callback_data: 'add_alert_RSI_SELL' }],
          [{ text: '🎯 تنبيه سعر مستهدف', callback_data: 'add_alert_PRICE' }],
          [{ text: '⚠️ تنبيه أخبار', callback_data: 'add_alert_NEWS' }],
          [{ text: '📋 تنبيهاتي', callback_data: 'my_alerts' }],
        ]
      };

      await ctx.reply(
        '🔔 **إعداد تنبيه جديد**\n\n' +
        'اختر نوع التنبيه:',
        { reply_markup: keyboard, parse_mode: 'Markdown' }
      );
    });

    this.bot.command('risk', async (ctx) => {
      await this.showRiskInstructions(ctx);
      this.userStates.set(ctx.from.id, { step: 'awaiting_risk_data' });
    });

    this.bot.action('market_forex', async (ctx) => {
      await ctx.answerCbQuery();
      await ctx.reply(
        '💱 Forex - الأزواج\n\nاختر الفئة:',
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: 'الأزواج الرئيسية', callback_data: 'forex_major' }],
              [{ text: 'الأزواج الفرعية', callback_data: 'forex_minor' }],
              [{ text: ' رجوع', callback_data: 'start_menu' }],
            ],
          },
        }
      );
    });

    this.bot.action('market_metals', async (ctx) => {
      await ctx.answerCbQuery();
      await this.showAssets(ctx, 'metals');
    });

    this.bot.action('market_energy', async (ctx) => {
      await ctx.answerCbQuery();
      await this.showAssets(ctx, 'energy');
    });

    this.bot.action('market_crypto', async (ctx) => {
      await ctx.answerCbQuery();
      await this.showAssets(ctx, 'crypto');
    });

    this.bot.action('market_indices', async (ctx) => {
      await ctx.answerCbQuery();
      await this.showAssets(ctx, 'indices');
    });

    this.bot.action('forex_major', async (ctx) => {
      await ctx.answerCbQuery();
      await this.showAssets(ctx, 'forex_major');
    });

    this.bot.action('forex_minor', async (ctx) => {
      await ctx.answerCbQuery();
      await this.showAssets(ctx, 'forex_minor');
    });

    this.bot.action('get_signals', async (ctx) => {
      await ctx.answerCbQuery();
      await this.handleSignals(ctx);
    });

    this.bot.action('weekly_report', async (ctx) => {
      await ctx.answerCbQuery();
      await this.handleWeeklyReport(ctx);
    });

    this.bot.action('my_trades', async (ctx) => {
      await ctx.answerCbQuery();
      const stats = this.tradeDb.getStatistics(30);
      const text = this.tradeDb.formatStatistics(stats, 30);
      
      const keyboard = {
        inline_keyboard: [
          [{ text: '➕ تسجيل صفقة', callback_data: 'new_trade_btn' }],
          [{ text: '📋 إغلاق صفقة', callback_data: 'close_trade_btn' }],
          [{ text: ' القائمة الرئيسية', callback_data: 'start_menu' }],
        ]
      };

      await ctx.reply(text, { reply_markup: keyboard, parse_mode: 'Markdown' });
    });

    this.bot.action('new_trade_btn', async (ctx) => {
      await ctx.answerCbQuery();
      await ctx.reply(
        '📝 **تسجيل صفقة جديدة**\n\n' +
        '📋 أرسل البيانات بالترتيب:\n' +
        '`الزوج, الاتجاه, الدخول, SL, TP, اللوت, نسبة المخاطرة, السبب`\n\n' +
        '**مثال:**\n' +
        '`EUR/USD, BUY, 1.0850, 1.0820, 1.0910, 0.1, 1, BOS صاعد على H4`',
        { parse_mode: 'Markdown' }
      );
      this.userStates.set(ctx.from.id, { step: 'awaiting_trade' });
    });

    this.bot.action('close_trade_btn', async (ctx) => {
      await ctx.answerCbQuery();
      const openTrades = this.tradeDb.getOpenTrades();
      
      if (openTrades.length === 0) {
        await ctx.reply('✅ لا توجد صفقات مفتوحة');
        return;
      }

      const keyboard = {
        inline_keyboard: openTrades.map(t => [{
          text: '#' + t.id + ' ' + t.symbol + ' ' + t.direction,
          callback_data: 'close_trade_' + t.id
        }])
      };

      await ctx.reply(
        '📋 **الصفقات المفتوحة:**\n\nاختر صفقة لإغلاقها:',
        { reply_markup: keyboard, parse_mode: 'Markdown' }
      );
    });

    this.bot.action('my_alerts', async (ctx) => {
      await ctx.answerCbQuery();
      const userId = ctx.from.id;
      const rules = this.alertEngine.getUserRules(userId);

      if (rules.length === 0) {
        await ctx.reply('📭 لا توجد تنبيهات نشطة\n\nاستخدم /alert لإنشاء تنبيه جديد');
        return;
      }

      let text = '🔔 **تنبيهاتك النشطة (' + rules.length + '):**\n\n';
      
      const keyboard: any[] = [];
      
      rules.forEach(rule => {
        const typeEmoji: any = {
          'ORDER_BLOCK': '',
          'BOS': '🔄',
          'CHOCH': '⚡',
          'RSI': '📊',
          'PRICE_TARGET': '🎯',
          'NEWS': '⚠️',
        };

        text += (typeEmoji[rule.type] || '🔔') + ' **' + rule.symbol + '** - ' + rule.type + '\n';
        text += '   📅 ' + new Date(rule.createdAt).toLocaleDateString('ar-SA') + '\n\n';

        keyboard.push([{
          text: '❌ حذف',
          callback_data: 'delete_alert_' + rule.id
        }]);
      });

      keyboard.push([{ text: '➕ تنبيه جديد', callback_data: 'add_alert_menu' }]);
      keyboard.push([{ text: '🔙 القائمة الرئيسية', callback_data: 'start_menu' }]);

      await ctx.reply(text, { reply_markup: { inline_keyboard: keyboard }, parse_mode: 'Markdown' });
    });

    this.bot.action('add_alert_menu', async (ctx) => {
      await ctx.answerCbQuery();
      await ctx.reply(
        '🔔 **إعداد تنبيه جديد**\n\n' +
        'اختر نوع التنبيه:',
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: '🟢 Order Block صاعد', callback_data: 'add_alert_OB_BUY' }],
              [{ text: ' Order Block هابط', callback_data: 'add_alert_OB_SELL' }],
              [{ text: '🔄 BOS', callback_data: 'add_alert_BOS' }],
              [{ text: '⚡ CHOCH', callback_data: 'add_alert_CHOCH' }],
              [{ text: ' RSI ذروة بيع', callback_data: 'add_alert_RSI_BUY' }],
              [{ text: '📊 RSI ذروة شراء', callback_data: 'add_alert_RSI_SELL' }],
              [{ text: '🎯 سعر مستهدف', callback_data: 'add_alert_PRICE' }],
              [{ text: '⚠️ أخبار', callback_data: 'add_alert_NEWS' }],
              [{ text: '🔙 رجوع', callback_data: 'my_alerts' }],
            ]
          },
          parse_mode: 'Markdown'
        }
      );
    });

    this.bot.action(/^add_alert_(.+)$/, async (ctx) => {
      const alertType = ctx.match[1];
      const userId = ctx.from.id;

      if (alertType === 'PRICE') {
        await ctx.reply(
          '🎯 **تنبيه سعر مستهدف**\n\n' +
          'أرسل البيانات:\n' +
          '`الزوج, السعر المستهدف`\n\n' +
          '**مثال:**\n' +
          '`EUR/USD, 1.0900`',
          { parse_mode: 'Markdown' }
        );
        this.userStates.set(userId, { step: 'awaiting_price_alert' });
        await ctx.answerCbQuery();
        return;
      }

      await ctx.reply(
        '💱 **أدخل رمز الأصل للتنبيه:**\n\n' +
        'مثال: EUR/USD, XAU/USD, BTC/USD',
        { parse_mode: 'Markdown' }
      );
      
      this.userStates.set(userId, { step: 'awaiting_alert_symbol', alertType });
      await ctx.answerCbQuery();
    });

    this.bot.action(/^delete_alert_(.+)$/, async (ctx) => {
      const ruleId = ctx.match[1];
      const userId = ctx.from.id;

      if (this.alertEngine.removeRule(ruleId, userId)) {
        await ctx.reply('✅ تم حذف التنبيه');
      } else {
        await ctx.reply('❌ فشل الحذف');
      }

      await ctx.answerCbQuery();
    });

    this.bot.action(/^alert_trade_(.+)$/, async (ctx) => {
      const ruleId = ctx.match[1];
      const userId = ctx.from.id;
      const rules = this.alertEngine.getUserRules(userId);
      const rule = rules.find(r => r.id === ruleId);

      if (!rule) {
        await ctx.reply(' التنبيه غير موجود');
        await ctx.answerCbQuery();
        return;
      }

      await ctx.reply(
        '📝 **فتح صفقة لـ ' + rule.symbol + '**\n\n' +
        'استخدم /newtrade لتسجيل الصفقة يدوياً\n\n' +
        '💱 الزوج: ' + rule.symbol + '\n' +
        '🎯 النوع: ' + rule.type,
        { parse_mode: 'Markdown' }
      );

      await ctx.answerCbQuery();
    });

    this.bot.action(/^alert_ignore_(.+)$/, async (ctx) => {
      await ctx.reply('✅ تم تجاهل التنبيه');
      await ctx.answerCbQuery();
    });

    this.bot.action(/^alert_snooze_(.+)$/, async (ctx) => {
      await ctx.reply('⏰ سيتم تذكيرك بعد ساعة');
      await ctx.answerCbQuery();
    });

    this.bot.action('institutional_info', async (ctx) => {
      await ctx.answerCbQuery();
      await ctx.reply(
        '️ **التحليل المؤسسي**\n\n' +
        'يجمع بين:\n' +
        '• 5 إطارات زمنية (MN, W1, D1, H4, H1)\n' +
        '• Smart Money Concepts\n' +
        '• Bar Chart Patterns\n' +
        '• الأخبار الاقتصادية\n' +
        '• نظام ثقة احترافي\n\n' +
        '📝 **أدخل رمز الأصل:**\n' +
        'مثال: EUR/USD, XAU/USD, BTC/USD',
        { parse_mode: 'Markdown' }
      );
      this.userStates.set(ctx.from.id, { step: 'awaiting_risk_data' });
    });

    this.bot.action('risk_info', async (ctx) => {
      await ctx.answerCbQuery();
      await this.showRiskInstructions(ctx);
      this.userStates.set(ctx.from.id, { step: 'awaiting_risk_data' });
    });

    this.bot.action('start_menu', async (ctx) => {
      await ctx.answerCbQuery();
      this.userStates.set(ctx.from.id, { step: 'idle' });
      await ctx.reply(
        '📊 SaidRaid AI\n\nاختر نوع السوق:',
        { reply_markup: this.mainMenuKeyboard() }
      );
    });

    this.bot.action('help', async (ctx) => {
      await ctx.answerCbQuery();
      await ctx.reply(
        '📖 **كيفية الاستخدام:**\n\n' +
        '1️⃣ اختر السوق من القائمة\n' +
        '2️⃣ اضغط على الأصل للتحليل\n' +
        '3️⃣ للحصول على إشارات مؤكدة:\n' +
        '   /signals\n' +
        '4️⃣ للتقرير الأسبوعي:\n' +
        '   /weekly\n' +
        '5️⃣ لتنبيهات ذكية:\n' +
        '   /alert\n' +
        '6️⃣ لتسجيل صفقة:\n' +
        '   /newtrade\n' +
        '7️ للإحصائيات:\n' +
        '   /stats\n' +
        '8️ للتحليل المؤسسي:\n' +
        '   /institutional EUR/USD\n' +
        '9️⃣ لحاسبة المخاطرة:\n' +
        '   /risk\n\n' +
        '🔗 **الأوامر:**\n' +
        '/start - القائمة الرئيسية\n' +
        '/analysis SYMBOL - تحليل عادي\n' +
        '/institutional SYMBOL - تحليل مؤسسي\n' +
        '/signals - إشارات التداول\n' +
        '/weekly - التقرير الأسبوعي\n' +
        '/alert - إنشاء تنبيه\n' +
        '/newtrade - تسجيل صفقة\n' +
        '/closetrade - إغلاق صفقة\n' +
        '/stats - إحصائيات\n' +
        '/recent - آخر الصفقات\n' +
        '/risk - حاسبة المخاطرة',
        { parse_mode: 'Markdown' }
      );
    });

    this.bot.action(/^asset_(.+)$/, async (ctx) => {
      const symbol = ctx.match[1];
      await ctx.answerCbQuery('⏳ جاري التحليل...');
      await this.performAnalysis(ctx, symbol);
    });

    this.bot.action(/^inst_(.+)$/, async (ctx) => {
      const symbol = ctx.match[1];
      await ctx.answerCbQuery('🏛️ جاري التحليل المؤسسي...');
      await this.performInstitutionalAnalysis(ctx, symbol);
    });

    this.bot.action(/^close_trade_(\d+)$/, async (ctx) => {
      const tradeId = parseInt(ctx.match[1]);
      const trade = this.tradeDb.getTradeById(tradeId);
      
      if (!trade) {
        await ctx.answerCbQuery('❌ الصفقة غير موجودة');
        return;
      }

      const keyboard = {
        inline_keyboard: [
          [
            { text: '🟢 ربح (TP)', callback_data: 'result_' + tradeId + '_WIN' },
            { text: '🔴 خسارة (SL)', callback_data: 'result_' + tradeId + '_LOSS' },
          ],
          [{ text: '⚪ تعادل', callback_data: 'result_' + tradeId + '_BREAKEVEN' }]
        ]
      };

      await ctx.reply(
        ' **إغلاق صفقة #' + tradeId + '**\n\n' +
        '💱 ' + trade.symbol + ' ' + trade.direction + '\n' +
        '📊 الدخول: ' + trade.entry + '\n\n' +
        'اختر النتيجة:',
        { reply_markup: keyboard, parse_mode: 'Markdown' }
      );
      
      await ctx.answerCbQuery();
    });

    this.bot.action(/^result_(\d+)_(WIN|LOSS|BREAKEVEN)$/, async (ctx) => {
      const tradeId = parseInt(ctx.match[1]);
      const result = ctx.match[2] as 'WIN' | 'LOSS' | 'BREAKEVEN';
      const trade = this.tradeDb.getTradeById(tradeId);
      
      if (!trade) {
        await ctx.answerCbQuery('❌ الصفقة غير موجودة');
        return;
      }

      let exitPrice = trade.entry;
      let profit = 0;
      let pips = 0;

      if (result === 'WIN') {
        exitPrice = trade.takeProfit;
        profit = Math.abs(trade.takeProfit - trade.entry) * trade.lotSize * 100000;
        pips = Math.abs(trade.takeProfit - trade.entry) * 10000;
      } else if (result === 'LOSS') {
        exitPrice = trade.stopLoss;
        profit = -Math.abs(trade.entry - trade.stopLoss) * trade.lotSize * 100000;
        pips = -Math.abs(trade.entry - trade.stopLoss) * 10000;
      }

      this.tradeDb.closeTrade(tradeId, exitPrice, result, profit, pips);

      const emoji = result === 'WIN' ? '🟢' : result === 'LOSS' ? '🔴' : '';
      
      await ctx.reply(
        emoji + ' **تم إغلاق الصفقة #' + tradeId + '**\n\n' +
        '💱 ' + trade.symbol + '\n' +
        '💰 النتيجة: ' + (result === 'WIN' ? 'ربح' : result === 'LOSS' ? 'خسارة' : 'تعادل') + '\n' +
        '💵 الربح/الخسارة: $' + profit.toFixed(2) + '\n' +
        '📊 النقاط: ' + pips.toFixed(1) + ' pips',
        { parse_mode: 'Markdown' }
      );
      
      await ctx.answerCbQuery();
    });

    this.bot.action(/^stats_(\d+|refresh)$/, async (ctx) => {
      const period = ctx.match[1];
      let days = 30;
      
      if (period === '7') days = 7;
      else if (period === '90') days = 90;
      
      const stats = this.tradeDb.getStatistics(days);
      const text = this.tradeDb.formatStatistics(stats, days);
      
      const keyboard = {
        inline_keyboard: [
          [
            { text: '7 أيام', callback_data: 'stats_7' },
            { text: '30 يوم', callback_data: 'stats_30' },
            { text: '90 يوم', callback_data: 'stats_90' },
          ],
          [{ text: '🔄 تحديث', callback_data: 'stats_refresh' }]
        ]
      };

      try {
        await ctx.editMessageText(text, { reply_markup: keyboard, parse_mode: 'Markdown' });
      } catch (error) {
        await ctx.reply(text, { reply_markup: keyboard, parse_mode: 'Markdown' });
      }
      await ctx.answerCbQuery();
    });

    this.bot.on('text', async (ctx) => {
      const text = ctx.message?.text || '';
      const userId = ctx.from.id;
      const state = this.userStates.get(userId);

      // معالجة تسجيل صفقة جديدة
      if (state?.step === 'awaiting_trade') {
        const parts = text.split(',').map(p => p.trim());
        
        if (parts.length < 8) {
          await ctx.reply('❌ البيانات ناقصة. أرسل 8 قيم مفصولة بفاصلة');
          return;
        }

        try {
          const [symbol, direction, entryStr, slStr, tpStr, lotStr, riskStr, reason] = parts;
          
          const tradeId = this.tradeDb.addTrade({
            symbol: symbol.toUpperCase(),
            direction: direction.toUpperCase() as 'BUY' | 'SELL',
            entry: parseFloat(entryStr),
            stopLoss: parseFloat(slStr),
            takeProfit: parseFloat(tpStr),
            lotSize: parseFloat(lotStr),
            riskPercent: parseFloat(riskStr),
            confidence: 75,
            status: 'OPEN',
            reason,
            openTime: new Date().toISOString(),
            strategy: 'Manual'
          });

          await ctx.reply(
            '✅ **تم تسجيل الصفقة!**\n\n' +
            '🔖 ID: #' + tradeId + '\n' +
            '💱 ' + symbol + ' ' + direction + '\n' +
            '📍 الدخول: ' + entryStr + '\n' +
            '🛑 SL: ' + slStr + '\n' +
            ' TP: ' + tpStr + '\n' +
            '📊 اللوت: ' + lotStr + '\n\n' +
            'استخدم /closetrade لإغلاقها عند الوصول للهدف',
            { parse_mode: 'Markdown' }
          );
          
          this.userStates.set(userId, { step: 'idle' });
        } catch (error) {
          await ctx.reply('❌ خطأ في البيانات. تأكد من الصيغة الصحيحة');
        }
        return;
      }

      // معالجة تنبيه السعر المستهدف
      if (state?.step === 'awaiting_price_alert') {
        const parts = text.split(',').map(p => p.trim());
        if (parts.length < 2) {
          await ctx.reply('❌ الصيغة: الزوج, السعر');
          return;
        }

        const [symbol, priceStr] = parts;
        const price = parseFloat(priceStr);

        if (isNaN(price)) {
          await ctx.reply('❌ سعر غير صحيح');
          return;
        }

        this.alertEngine.addRule({
          userId,
          symbol: symbol.toUpperCase(),
          type: 'PRICE_TARGET',
          condition: { priceTarget: price },
        });

        await ctx.reply(
          '✅ **تم إنشاء التنبيه!**\n\n' +
          '💱 ' + symbol.toUpperCase() + '\n' +
          '🎯 السعر المستهدف: ' + price + '\n\n' +
          'سيتم تنبيهك عند وصول السعر',
          { parse_mode: 'Markdown' }
        );

        this.userStates.set(userId, { step: 'idle' });
        return;
      }

      // معالجة إدخال رمز الأصل للتنبيهات الأخرى
      if (state?.step === 'awaiting_alert_symbol') {
        const symbol = text.toUpperCase().trim();
        const alertType = state.alertType;

        let type: any;
        let condition: any = {};

        if (alertType === 'OB_BUY') { type = 'ORDER_BLOCK'; condition.direction = 'BUY'; }
        else if (alertType === 'OB_SELL') { type = 'ORDER_BLOCK'; condition.direction = 'SELL'; }
        else if (alertType === 'BOS') { type = 'BOS'; }
        else if (alertType === 'CHOCH') { type = 'CHOCH'; }
        else if (alertType === 'RSI_BUY') { type = 'RSI'; condition.direction = 'BUY'; condition.rsiThreshold = 30; }
        else if (alertType === 'RSI_SELL') { type = 'RSI'; condition.direction = 'SELL'; condition.rsiThreshold = 30; }
        else if (alertType === 'NEWS') { type = 'NEWS'; }

        this.alertEngine.addRule({
          userId,
          symbol,
          type,
          condition,
        });

        await ctx.reply(
          '✅ **تم إنشاء التنبيه!**\n\n' +
          '💱 ' + symbol + '\n' +
          '🔔 النوع: ' + type + '\n\n' +
          'سيتم مراقبته كل 5 دقائق',
          { parse_mode: 'Markdown' }
        );

        this.userStates.set(userId, { step: 'idle' });
        return;
      }

      // معالجة حاسبة المخاطرة
      if (state?.step === 'awaiting_risk_data') {
        if (text.includes(',') && text.split(',').length >= 6) {
          await this.handleRiskCalculation(ctx, text);
          this.userStates.set(userId, { step: 'idle' });
          return;
        }

        const upperText = text.toUpperCase().trim();
        const validSymbols = this.marketRegistry.getAllSymbols();
        if (validSymbols.includes(upperText)) {
          await this.performInstitutionalAnalysis(ctx, upperText);
          this.userStates.set(userId, { step: 'idle' });
          return;
        }

        await ctx.reply('❌ لم أفهم. استخدم /help للمساعدة');
        this.userStates.set(userId, { step: 'idle' });
        return;
      }

      // الحالة العادية
      const upperText = text.toUpperCase().trim();
      const validSymbols = this.marketRegistry.getAllSymbols();

      if (validSymbols.includes(upperText)) {
        await this.performAnalysis(ctx, upperText);
      }
    });

    this.bot.catch((err) => {
      console.error('❌ Bot Error:', err);
    });

    console.log('✅ All handlers registered!');
  }

  private async handleSignals(ctx: Context): Promise<void> {
    await ctx.reply('⏳ جاري فحص السوق للعثور على إشارات عالية الثقة...\n\n️ قد يستغرق 1-2 دقيقة');

    try {
      const signals = await this.signalEngine.generateSignals();

      if (signals.length === 0) {
        await ctx.reply(
          '📭 **لا توجد إشارات عالية الثقة حالياً**\n\n' +
          'السوق هادئ أو لا توجد فرص مناسبة.\n' +
          'البوت يفحص السوق باستمرار - جرب مرة أخرى لاحقاً.\n\n' +
          '💡 **نصيحة:**\n' +
          'لا تتداول إلا عند وجود إشارات بثقة ≥ 75%\n' +
          'الجودة أهم من الكمية!',
          { parse_mode: 'Markdown' }
        );
        return;
      }

      await ctx.reply(
        '✅ **تم العثور على ' + signals.length + ' إشارة عالية الثقة**\n\n' +
        'سيتم إرسال أفضل الإشارات الآن...',
        { parse_mode: 'Markdown' }
      );

      for (let i = 0; i < Math.min(signals.length, 3); i++) {
        const sig = signals[i];
        await ctx.reply(this.signalEngine.formatSignal(sig), {
          parse_mode: 'Markdown',
        });
        if (i < Math.min(signals.length, 3) - 1) {
          await new Promise((r) => setTimeout(r, 1500));
        }
      }

      const keyboard = {
        inline_keyboard: [
          [{ text: ' فحص مرة أخرى', callback_data: 'get_signals' }],
          [{ text: ' القائمة الرئيسية', callback_data: 'start_menu' }],
        ],
      };

      await ctx.reply('اختر إجراء:', { reply_markup: keyboard });
    } catch (error: any) {
      console.error('❌ Signals error:', error);
      await ctx.reply('❌ خطأ في جلب الإشارات: ' + error.message);
    }
  }

  private async handleWeeklyReport(ctx: Context): Promise<void> {
    await ctx.reply('📊 جاري إعداد التقرير الأسبوعي...\n\n قد يستغرق 2-3 دقائق');

    try {
      const symbols = [
        'EUR/USD', 'GBP/USD', 'USD/JPY',
        'XAU/USD', 'XAG/USD',
        'BTC/USD', 'ETH/USD',
        'WTI/USD',
        'INDEX:SPX', 'INDEX:DJI'
      ];

      const report = await this.weeklyReport.generateReport(symbols);

      const keyboard = {
        inline_keyboard: [
          [{ text: '🔄 تحديث التقرير', callback_data: 'weekly_report' }],
          [{ text: '🔙 القائمة الرئيسية', callback_data: 'start_menu' }],
        ],
      };

      await ctx.reply(report, {
        reply_markup: keyboard,
        parse_mode: 'Markdown',
      });
    } catch (error: any) {
      console.error('❌ Weekly report error:', error);
      await ctx.reply('❌ خطأ في إعداد التقرير: ' + error.message);
    }
  }

  private async showRiskInstructions(ctx: Context): Promise<void> {
    await ctx.reply(
      '🧮 **حاسبة المخاطرة الاحترافية**\n\n' +
      '📝 أرسل البيانات بالترتيب (مفصولة بفاصلة):\n\n' +
      '`الزوج, الدخول, وقف الخسارة, جني الربح, نسبة المخاطرة%, الرصيد`\n\n' +
      '**مثال:**\n' +
      '`EUR/USD, 1.0850, 1.0820, 1.0910, 1, 10000`\n\n' +
      '⚠️ **ملاحظة مهمة:**\n' +
      '• النسبة الموصى بها: 0.5-1% من الرصيد\n' +
      '• الحد الأقصى: 2%\n' +
      '• نسبة R:R المثالية: 1:2 أو أعلى',
      { parse_mode: 'Markdown' }
    );
  }

  private async showAssets(ctx: Context, marketId: string): Promise<void> {
    const market = this.marketRegistry.getMarketById(marketId);

    if (!market) {
      await ctx.reply('❌ السوق غير موجود');
      return;
    }

    const keyboard: any[] = [];

    for (let i = 0; i < market.assets.length; i += 2) {
      const row: any[] = [];

      const asset1 = market.assets[i];
      row.push({
        text: asset1.symbol,
        callback_data: 'asset_' + asset1.symbol,
      });

      if (i + 1 < market.assets.length) {
        const asset2 = market.assets[i + 1];
        row.push({
          text: asset2.symbol,
          callback_data: 'asset_' + asset2.symbol,
        });
      }

      keyboard.push(row);
    }

    keyboard.push([{ text: '🔙 رجوع', callback_data: 'start_menu' }]);

    await ctx.reply(
      market.emoji + ' ' + market.name + '\n\nاختر الأصل للتحليل:',
      { reply_markup: { inline_keyboard: keyboard } }
    );
  }

  private async performAnalysis(ctx: Context, symbol: string): Promise<void> {
    try {
      await ctx.reply(' جاري التحليل...');

      const analysis = await this.analyzer.analyze(symbol);
      const formattedText = this.analyzer.formatAnalysis(analysis);

      const keyboard = {
        inline_keyboard: [
          [{ text: '🔄 تحديث', callback_data: 'asset_' + symbol }],
          [{ text: '🏛️ تحليل مؤسسي', callback_data: 'inst_' + symbol }],
          [{ text: '🔙 القائمة الرئيسية', callback_data: 'start_menu' }],
        ],
      };

      await ctx.reply(formattedText, { reply_markup: keyboard, parse_mode: 'Markdown' });
    } catch (error: any) {
      console.error('❌ Analysis error:', error);
      await ctx.reply('❌ حدث خطأ في تحليل ' + symbol + '\n\n' + error.message);
    }
  }

  private async performInstitutionalAnalysis(ctx: Context, symbol: string): Promise<void> {
    try {
      await ctx.reply('🏛️ جاري التحليل المؤسسي...\n\n⏳ قد يستغرق 1-2 دقيقة');

      const report = await this.analyzer.getInstitutionalAnalysis(symbol);

      const keyboard = {
        inline_keyboard: [
          [{ text: '🔄 تحديث', callback_data: 'inst_' + symbol }],
          [{ text: ' تحليل عادي', callback_data: 'asset_' + symbol }],
          [{ text: ' القائمة الرئيسية', callback_data: 'start_menu' }],
        ],
      };

      await ctx.reply(report, {
        reply_markup: keyboard,
        parse_mode: 'Markdown',
      });
    } catch (error: any) {
      console.error('❌ Institutional analysis error:', error);
      await ctx.reply('❌ حدث خطأ في التحليل المؤسسي:\n' + error.message);
    }
  }

  private async handleRiskCalculation(ctx: Context, text: string): Promise<void> {
    try {
      const parts = text.split(',').map((p) => p.trim());
      const [symbol, entryStr, slStr, tpStr, riskStr, balanceStr] = parts;

      const entry = parseFloat(entryStr);
      const stopLoss = parseFloat(slStr);
      const takeProfit = parseFloat(tpStr);
      const riskPercent = parseFloat(riskStr);
      const accountBalance = parseFloat(balanceStr);

      if (isNaN(entry) || isNaN(stopLoss) || isNaN(takeProfit) || isNaN(riskPercent) || isNaN(accountBalance)) {
        await ctx.reply('❌ بيانات غير صحيحة. تأكد من إدخال الأرقام بشكل صحيح');
        return;
      }

      if (riskPercent > 5) {
        await ctx.reply('⚠️ نسبة المخاطرة عالية جداً! الحد الأقصى الموصى به: 2%');
        return;
      }

      const result = this.analyzer.calculateRisk({
        symbol: symbol.toUpperCase(),
        entry,
        stopLoss,
        takeProfit,
        riskPercent,
        accountBalance,
      });

      await ctx.reply(result, { parse_mode: 'Markdown' });
    } catch (error: any) {
      console.error('Risk calculation error:', error);
      await ctx.reply('❌ حدث خطأ في حساب المخاطرة: ' + error.message);
    }
  }

  public async launch(): Promise<void> {
    try {
      const botInfo = await this.bot.telegram.getMe();
      console.log('✅ Bot started as @' + botInfo.username);

      await this.bot.launch();
      console.log('🤖 Bot is running! Press Ctrl+C to stop.');

      process.once('SIGINT', () => {
        console.log('\n🛑 Shutting down...');
        this.bot.stop('SIGINT');
        this.tradeDb.close();
        process.exit(0);
      });

      process.once('SIGTERM', () => {
        this.bot.stop('SIGTERM');
        this.tradeDb.close();
        process.exit(0);
      });
    } catch (error) {
      console.error('❌ Failed to launch:', error);
      throw error;
    }
  }
}

const bot = new ForexBot();
bot.launch().catch(console.error);