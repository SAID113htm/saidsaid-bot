import { Telegraf, Context } from 'telegraf';
import * as http from 'http';
import { config } from '../config/env';
import { Analyzer } from '../analysis/Analyzer';
import { MarketRegistry } from '../market/MarketRegistry';
import { SignalEngine } from '../signals/SignalEngine';
import { WeeklyReport } from '../reports/WeeklyReport';
import { TradeDatabase } from '../database/TradeDatabase';
import { AlertEngine } from '../alerts/AlertEngine';
import { SmartElliottICT } from '../analysis/SmartElliottICT';
import { LiquidityAnalyzer } from '../smartmoney/LiquidityAnalyzer';
import { TradingEngine } from '../engine/TradingEngine';
import { YahooFinanceClient } from '../providers/YahooFinanceClient';

interface UserState {
  step: 'idle' | 'awaiting_risk_data' | 'awaiting_trade' | 'awaiting_price_alert' | 'awaiting_alert_symbol' | 'awaiting_elliott' | 'awaiting_liquidity' | 'awaiting_institutional' | 'awaiting_pipeline';
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
  private smartElliottICT: SmartElliottICT;
  private liquidityAnalyzer: LiquidityAnalyzer;
  private tradingEngine: TradingEngine;
  private yahoo: YahooFinanceClient;
  private userStates: Map<number, UserState> = new Map();

  constructor() {
    console.log('🔧 Initializing bot...');
    this.bot = new Telegraf(config.bot.token);
    this.analyzer = new Analyzer();
    this.marketRegistry = new MarketRegistry();
    this.signalEngine = new SignalEngine();
    this.weeklyReport = new WeeklyReport();
    this.tradeDb = new TradeDatabase();
    this.smartElliottICT = new SmartElliottICT();
    this.liquidityAnalyzer = new LiquidityAnalyzer();
    this.tradingEngine = new TradingEngine();
    this.yahoo = new YahooFinanceClient();
    this.alertEngine = new AlertEngine(this.bot);
    this.alertEngine.startMonitoring(5);
    this.setupBot();
  }

  private isMarketOpen(): boolean {
    const now = new Date();
    const day = now.getDay();
    return day !== 0 && day !== 6;
  }

  private getMarketStatus(): string {
    const now = new Date();
    const day = now.getDay();
    const days = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
    const today = days[day];

    if (day === 0 || day === 6) {
      return '🔴 **السوق مغلق**\n\n📅 اليوم: ' + today + '\n⏰ يفتح: الاثنين 00:00 GMT';
    }

    return '🟢 **السوق مفتوح**\n\n📅 اليوم: ' + today + '\n⏰ الوقت: ' + now.toLocaleTimeString('ar-SA');
  }

  private mainMenuKeyboard() {
    return {
      inline_keyboard: [
        [{ text: '💱 Forex', callback_data: 'market_forex' }],
        [{ text: '🥇 المعادن', callback_data: 'market_metals' }],
        [{ text: '₿ Crypto', callback_data: 'market_crypto' }],
        [{ text: '📊 المؤشرات', callback_data: 'market_indices' }],
        [{ text: '🔔 الإشارات', callback_data: 'get_signals' }],
        [{ text: '🔬 Pipeline', callback_data: 'pipeline_menu' }],
        [{ text: '🌊 Elliott+ICT', callback_data: 'elliott_menu' }],
        [{ text: '💎 السيولة', callback_data: 'liquidity_menu' }],
        [{ text: '📈 التقرير الأسبوعي', callback_data: 'weekly_report' }],
        [{ text: '📰 الأخبار', callback_data: 'all_news' }],
        [{ text: '🔔 تنبيهاتي', callback_data: 'my_alerts' }],
        [{ text: '📋 صفقاتي', callback_data: 'my_trades' }],
        [{ text: '🏛️ تحليل مؤسسي', callback_data: 'institutional_info' }],
        [{ text: '🧮 المخاطرة', callback_data: 'risk_info' }],
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
        '🏛️ **SaidRaid AI**\n\n' +
        this.getMarketStatus() + '\n\n' +
        'اختر من القائمة:',
        { reply_markup: this.mainMenuKeyboard(), parse_mode: 'Markdown' }
      );
    });

    this.bot.command('market', async (ctx) => {
      await ctx.reply(this.getMarketStatus(), { parse_mode: 'Markdown' });
    });

    this.bot.help((ctx) => {
      ctx.reply(
        '📖 **الأوامر:**\n\n' +
        '/start - القائمة\n' +
        '/market - حالة السوق\n' +
        '/analysis EUR/USD - تحليل\n' +
        '/institutional EUR/USD - مؤسسي\n' +
        '/elliott EUR/USD - Elliott+ICT\n' +
        '/liquidity EUR/USD - سيولة\n' +
        '/pipeline EUR/USD - Pipeline\n' +
        '/signals - إشارات\n' +
        '/weekly - تقرير\n' +
        '/news USD - أخبار\n' +
        '/alert - تنبيه\n' +
        '/newtrade - صفقة\n' +
        '/stats - إحصائيات\n' +
        '/risk - مخاطرة',
        { parse_mode: 'Markdown' }
      );
    });

    this.bot.command('analysis', async (ctx) => {
      const args = (ctx.message?.text || '').split(' ');
      if (args.length < 2) { ctx.reply('استخدم: /analysis EUR/USD'); return; }
      await this.performAnalysis(ctx, args[1].toUpperCase());
    });

    this.bot.command('institutional', async (ctx) => {
      const args = (ctx.message?.text || '').split(' ');
      if (args.length < 2) { ctx.reply('استخدم: /institutional EUR/USD'); return; }
      await this.performInstitutionalAnalysis(ctx, args[1].toUpperCase());
    });

    this.bot.command('elliott', async (ctx) => {
      const args = (ctx.message?.text || '').split(' ');
      if (args.length < 2) { ctx.reply('استخدم: /elliott EUR/USD'); return; }
      await this.performSmartElliottICTAnalysis(ctx, args[1].toUpperCase());
    });

    this.bot.command('liquidity', async (ctx) => {
      const args = (ctx.message?.text || '').split(' ');
      if (args.length < 2) { ctx.reply('استخدم: /liquidity EUR/USD'); return; }
      await this.performLiquidityAnalysis(ctx, args[1].toUpperCase());
    });

    this.bot.command('pipeline', async (ctx) => {
      const args = (ctx.message?.text || '').split(' ');
      if (args.length < 2) { ctx.reply('استخدم: /pipeline EUR/USD'); return; }
      await this.performPipelineAnalysis(ctx, args[1].toUpperCase());
    });

    this.bot.command('signals', async (ctx) => { await this.handleSignals(ctx); });
    this.bot.command('weekly', async (ctx) => { await this.handleWeeklyReport(ctx); });

    this.bot.command('news', async (ctx) => {
      const args = (ctx.message?.text || '').split(' ');
      const symbol = args.length > 1 ? args[1].toUpperCase() : 'USD';
      await ctx.reply('📰 جاري جلب الأخبار...');
      try {
        const { NewsAnalyzer } = await import('../news/NewsAnalyzer');
        const newsAnalyzer = new NewsAnalyzer();
        const news = await newsAnalyzer.getHighImpactNews(symbol);
        const message = newsAnalyzer.formatNewsAlert(symbol, news);
        await ctx.reply(message, { parse_mode: 'Markdown' });
      } catch (error: any) {
        await ctx.reply('❌ خطأ: ' + error.message);
      }
    });

    this.bot.command('stats', async (ctx) => {
      const stats = this.tradeDb.getStatistics(30);
      await ctx.reply(this.tradeDb.formatStatistics(stats, 30), { parse_mode: 'Markdown' });
    });

    this.bot.command('newtrade', async (ctx) => {
      await ctx.reply('📝 **صفقة جديدة**\n\nأرسل:\n`الزوج, الاتجاه, الدخول, SL, TP, اللوت, المخاطرة%, السبب`', { parse_mode: 'Markdown' });
      this.userStates.set(ctx.from.id, { step: 'awaiting_trade' });
    });

    this.bot.command('risk', async (ctx) => {
      await this.showRiskInstructions(ctx);
      this.userStates.set(ctx.from.id, { step: 'awaiting_risk_data' });
    });

    this.bot.action('pipeline_menu', async (ctx) => {
      await ctx.answerCbQuery();
      await ctx.reply('🔬 **Pipeline**\n\nأدخل الرمز:\nمثال: EUR/USD', { parse_mode: 'Markdown' });
      this.userStates.set(ctx.from.id, { step: 'awaiting_pipeline' });
    });

    this.bot.action('elliott_menu', async (ctx) => {
      await ctx.answerCbQuery();
      await ctx.reply('🌊 **Elliott+ICT**\n\nأدخل الرمز:', { parse_mode: 'Markdown' });
      this.userStates.set(ctx.from.id, { step: 'awaiting_elliott' });
    });

    this.bot.action('liquidity_menu', async (ctx) => {
      await ctx.answerCbQuery();
      await ctx.reply('💎 **السيولة**\n\nأدخل الرمز:', { parse_mode: 'Markdown' });
      this.userStates.set(ctx.from.id, { step: 'awaiting_liquidity' });
    });

    this.bot.action('institutional_info', async (ctx) => {
      await ctx.answerCbQuery();
      await ctx.reply('🏛️ **مؤسسي**\n\nأدخل الرمز:', { parse_mode: 'Markdown' });
      this.userStates.set(ctx.from.id, { step: 'awaiting_institutional' });
    });

    this.bot.action(/^pipeline_(.+)$/, async (ctx) => {
      await ctx.answerCbQuery();
      await this.performPipelineAnalysis(ctx, ctx.match[1]);
    });

    this.bot.action(/^elliott_(.+)$/, async (ctx) => {
      await ctx.answerCbQuery();
      await this.performSmartElliottICTAnalysis(ctx, ctx.match[1]);
    });

    this.bot.action(/^liquidity_(.+)$/, async (ctx) => {
      await ctx.answerCbQuery();
      await this.performLiquidityAnalysis(ctx, ctx.match[1]);
    });

    this.bot.action(/^inst_(.+)$/, async (ctx) => {
      await ctx.answerCbQuery();
      await this.performInstitutionalAnalysis(ctx, ctx.match[1]);
    });

    this.bot.action(/^asset_(.+)$/, async (ctx) => {
      await ctx.answerCbQuery();
      await this.performAnalysis(ctx, ctx.match[1]);
    });

    this.bot.action('start_menu', async (ctx) => {
      await ctx.answerCbQuery();
      this.userStates.set(ctx.from.id, { step: 'idle' });
      await ctx.reply('📊 SaidRaid AI\n\n' + this.getMarketStatus(), { reply_markup: this.mainMenuKeyboard() });
    });

    this.bot.on('text', async (ctx) => {
      const text = ctx.message?.text || '';
      const userId = ctx.from?.id;
      if (!userId) return;
      
      const state = this.userStates.get(userId);

      if (state?.step === 'awaiting_pipeline') {
        const symbol = text.toUpperCase().trim();
        await this.performPipelineAnalysis(ctx, symbol);
        this.userStates.set(userId, { step: 'idle' });
        return;
      }

      if (state?.step === 'awaiting_elliott') {
        const symbol = text.toUpperCase().trim();
        await this.performSmartElliottICTAnalysis(ctx, symbol);
        this.userStates.set(userId, { step: 'idle' });
        return;
      }

      if (state?.step === 'awaiting_liquidity') {
        const symbol = text.toUpperCase().trim();
        await this.performLiquidityAnalysis(ctx, symbol);
        this.userStates.set(userId, { step: 'idle' });
        return;
      }

      if (state?.step === 'awaiting_institutional') {
        const symbol = text.toUpperCase().trim();
        await this.performInstitutionalAnalysis(ctx, symbol);
        this.userStates.set(userId, { step: 'idle' });
        return;
      }

      if (state?.step === 'awaiting_risk_data') {
        if (text.includes(',') && text.split(',').length >= 6) {
          await this.handleRiskCalculation(ctx, text);
          this.userStates.set(userId, { step: 'idle' });
          return;
        }
      }

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

  private async getCandlesForAnalysis(symbol: string): Promise<any[]> {
    const data = await this.yahoo.getTimeSeries(symbol, '1day', 100);
    return data.values.map((c: any) => ({
      time: c.datetime,
      open: parseFloat(c.open),
      high: parseFloat(c.high),
      low: parseFloat(c.low),
      close: parseFloat(c.close),
      volume: parseFloat(c.volume),
    }));
  }

  private async performPipelineAnalysis(ctx: Context, symbol: string): Promise<void> {
    try {
      await ctx.reply('🔬 جاري تحليل Pipeline...');
      const candles = await this.getCandlesForAnalysis(symbol);
      const signal = await this.tradingEngine.analyze(symbol, candles);
      const formattedText = this.tradingEngine.formatSignal(signal, symbol);
      await ctx.reply(formattedText, { parse_mode: 'Markdown' });
    } catch (error: any) {
      console.error('❌ Pipeline error:', error);
      await ctx.reply('❌ خطأ: ' + error.message);
    }
  }

  private async performLiquidityAnalysis(ctx: Context, symbol: string): Promise<void> {
    try {
      await ctx.reply('💎 جاري تحليل السيولة...');
      const candles = await this.getCandlesForAnalysis(symbol);
      const analysis = this.liquidityAnalyzer.analyze(candles);
      const formattedText = this.liquidityAnalyzer.formatAnalysis(analysis, symbol);
      await ctx.reply(formattedText, { parse_mode: 'Markdown' });
    } catch (error: any) {
      console.error('❌ Liquidity error:', error);
      await ctx.reply('❌ خطأ: ' + error.message);
    }
  }

  private async performSmartElliottICTAnalysis(ctx: Context, symbol: string): Promise<void> {
    try {
      await ctx.reply('🌊 جاري التحليل المدمج...');
      const candles = await this.getCandlesForAnalysis(symbol);
      const analysis = await this.smartElliottICT.analyze(symbol, candles);
      const formattedText = this.smartElliottICT.formatAnalysis(analysis);
      await ctx.reply(formattedText, { parse_mode: 'Markdown' });
    } catch (error: any) {
      console.error('❌ Elliott error:', error);
      await ctx.reply('❌ خطأ: ' + error.message);
    }
  }

  private async performInstitutionalAnalysis(ctx: Context, symbol: string): Promise<void> {
    try {
      await ctx.reply('🏛️ جاري التحليل المؤسسي...');
      const report = await this.analyzer.getInstitutionalAnalysis(symbol);
      await ctx.reply(report, { parse_mode: 'Markdown' });
    } catch (error: any) {
      console.error('❌ Institutional error:', error);
      await ctx.reply('❌ خطأ: ' + error.message);
    }
  }

  private async performAnalysis(ctx: Context, symbol: string): Promise<void> {
    try {
      await ctx.reply('⏳ جاري التحليل...');
      const analysis = await this.analyzer.analyze(symbol);
      const formattedText = this.analyzer.formatAnalysis(analysis);
      await ctx.reply(formattedText, { parse_mode: 'Markdown' });
    } catch (error: any) {
      console.error('❌ Analysis error:', error);
      await ctx.reply('❌ خطأ: ' + error.message);
    }
  }

  private async handleSignals(ctx: Context): Promise<void> {
    try {
      await ctx.reply('⏳ جاري البحث عن إشارات...');
      const signals = await this.signalEngine.generateSignals();
      if (signals.length === 0) {
        await ctx.reply('📭 لا توجد إشارات حالياً');
        return;
      }
      for (const sig of signals.slice(0, 3)) {
        await ctx.reply(this.signalEngine.formatSignal(sig), { parse_mode: 'Markdown' });
      }
    } catch (error: any) {
      await ctx.reply('❌ خطأ: ' + error.message);
    }
  }

  private async handleWeeklyReport(ctx: Context): Promise<void> {
    try {
      await ctx.reply('📊 جاري إعداد التقرير...');
      const symbols = ['EUR/USD', 'GBP/USD', 'XAU/USD', 'BTC/USD'];
      const report = await this.weeklyReport.generateReport(symbols);
      await ctx.reply(report, { parse_mode: 'Markdown' });
    } catch (error: any) {
      await ctx.reply('❌ خطأ: ' + error.message);
    }
  }

  private async showRiskInstructions(ctx: Context): Promise<void> {
    await ctx.reply(
      '🧮 **حاسبة المخاطرة**\n\n' +
      'أرسل:\n`الزوج, الدخول, SL, TP, المخاطرة%, الرصيد`\n\n' +
      'مثال:\n`EUR/USD, 1.0850, 1.0820, 1.0910, 1, 10000`',
      { parse_mode: 'Markdown' }
    );
  }

  private async handleRiskCalculation(ctx: Context, text: string): Promise<void> {
    try {
      const parts = text.split(',').map(p => p.trim());
      const [symbol, entryStr, slStr, tpStr, riskStr, balanceStr] = parts;
      const result = this.analyzer.calculateRisk({
        symbol: symbol.toUpperCase(),
        entry: parseFloat(entryStr),
        stopLoss: parseFloat(slStr),
        takeProfit: parseFloat(tpStr),
        riskPercent: parseFloat(riskStr),
        accountBalance: parseFloat(balanceStr),
      });
      await ctx.reply(result, { parse_mode: 'Markdown' });
    } catch (error: any) {
      await ctx.reply('❌ خطأ في البيانات');
    }
  }

  private async showAssets(ctx: Context, marketId: string): Promise<void> {
    const market = this.marketRegistry.getMarketById(marketId);
    if (!market) { await ctx.reply('❌ غير موجود'); return; }
    const keyboard: any[] = [];
    for (let i = 0; i < market.assets.length; i += 2) {
      const row: any[] = [];
      row.push({ text: market.assets[i].symbol, callback_data: 'asset_' + market.assets[i].symbol });
      if (i + 1 < market.assets.length) {
        row.push({ text: market.assets[i + 1].symbol, callback_data: 'asset_' + market.assets[i + 1].symbol });
      }
      keyboard.push(row);
    }
    await ctx.reply(market.emoji + ' ' + market.name, { reply_markup: { inline_keyboard: keyboard } });
  }

  public async launch(): Promise<void> {
    try {
      const botInfo = await this.bot.telegram.getMe();
      console.log('✅ Bot started as @' + botInfo.username);
      await this.bot.launch();
      console.log('🤖 Bot is running!');
      process.once('SIGINT', () => {
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

// ==========================================
// تشغيل البوت
// ==========================================
const bot = new ForexBot();
bot.launch().catch(console.error);

// ==========================================
// خدعة لجعل Render يعمل 24/7
// باستخدام http المدمج في Node.js (لا يحتاج تثبيت!)
// ==========================================
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('SaidRaid Bot is running! 🟢');
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`✅ Server is alive on port ${PORT}`);
});