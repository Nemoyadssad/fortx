const TelegramBot = require('node-telegram-bot-api');

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const WEBAPP_URL = process.env.WEBAPP_URL || 'https://www.fortx.world';

const bot = new TelegramBot(TOKEN, { polling: true });

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const firstName = msg.from.first_name || 'трейдер';

  const text =
    `⚡️ ${firstName}, добро пожаловать в FORTX!\n\n` +
    `Здесь предсказания превращаются в деньги. Ставь на реальные события — выборы, крипту, спорт, что угодно — по живым коэффициентам с Polymarket.\n\n` +
    `Плюс казино прямо внутри: Mines, Crash, Roulette, Plinko и джекпот-колесо на всех игроков.\n\n` +
    `🎁 Новым игрокам — $5 на баланс просто за вход.\n\n` +
    `Жми кнопку ниже, чтобы открыть приложение и забрать бонус 👇`;

  bot.sendMessage(chatId, text, {
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: '🚀 Открыть FORTX',
            web_app: { url: WEBAPP_URL },
          },
        ],
      ],
    },
  });
});

console.log('Bot is running...');