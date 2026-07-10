require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const WEBAPP_URL = process.env.WEBAPP_URL || 'https://www.fortx.world';
const BANNER_URL = process.env.BANNER_URL || ''; // необязательно — см. пояснение ниже

if (!TOKEN) {
  console.error('TELEGRAM_BOT_TOKEN is not set. Exiting.');
  process.exit(1);
}

const bot = new TelegramBot(TOKEN, { polling: true });

// ---------- Меню команд (видно при нажатии на "/" в чате) ----------
bot.setMyCommands([
  { command: 'start', description: '🚀 Запустить FORTX' },
  { command: 'app', description: '🎯 Открыть приложение' },
  { command: 'help', description: 'ℹ️ Что умеет бот' },
]);

function openAppKeyboard(url) {
  return {
    inline_keyboard: [
      [{ text: '🚀 Открыть FORTX', web_app: { url } }],
    ],
  };
}

// ---------- /start ----------
// Поддерживает реферальные диплинки: t.me/YourBot?start=REFCODE
bot.onText(/\/start(?:\s+(.+))?/, (msg, match) => {
  const chatId = msg.chat.id;
  const firstName = msg.from.first_name || 'трейдер';
  const refCode = match?.[1]?.trim();

  const text =
    `⚡️ *${firstName}, добро пожаловать в FORTX\\!*\n\n` +
    `Здесь предсказания превращаются в деньги\\. Ставь на реальные события — выборы, крипту, спорт — по живым коэффициентам с Polymarket\\.\n\n` +
    `Плюс казино прямо внутри: Mines, Crash, Roulette, Plinko и джекпот на всех игроков сразу\\.\n\n` +
    `🎁 Новым игрокам — *$5 на баланс* просто за вход\\.\n\n` +
    `Жми кнопку ниже, чтобы открыть приложение и забрать бонус 👇`;

  // Реферальный код прокидываем в URL мини-аппа как query-параметр —
  // фронт подхватит его и активирует промо/реферал при первом заходе.
  const appUrl = refCode
    ? `${WEBAPP_URL}?ref=${encodeURIComponent(refCode)}`
    : WEBAPP_URL;

  const opts = {
    parse_mode: 'MarkdownV2',
    reply_markup: openAppKeyboard(appUrl),
  };

  if (BANNER_URL) {
    bot.sendPhoto(chatId, BANNER_URL, { caption: text, ...opts });
  } else {
    bot.sendMessage(chatId, text, opts);
  }
});

// ---------- /app — быстро переоткрыть приложение ----------
bot.onText(/\/app/, (msg) => {
  bot.sendMessage(msg.chat.id, '🎯 Твоё приложение готово:', {
    reply_markup: openAppKeyboard(WEBAPP_URL),
  });
});

// ---------- /help ----------
bot.onText(/\/help/, (msg) => {
  const text =
    `*Что умеет FORTX* 🔮\n\n` +
    `📈 *Предсказания* — ставь на исход реальных событий с живыми коэффициентами\n` +
    `🎰 *Казино* — Mines, Crash, Roulette, Plinko, Dice, Coinflip\n` +
    `🎡 *Джекпот* — общий пот, крутит колесо, выигрывает один\n` +
    `👥 *Рефералы* — приглашай друзей и получай % с их ставок\n` +
    `🎁 *Ежедневные бонусы* — заходи каждый день за награду\n\n` +
    `Команды:\n` +
    `/app — открыть приложение\n` +
    `/help — это сообщение`;

  bot.sendMessage(msg.chat.id, text, {
    parse_mode: 'Markdown',
    reply_markup: openAppKeyboard(WEBAPP_URL),
  });
});

// ---------- На любое другое сообщение — мягкая подсказка с кнопкой ----------
bot.on('message', (msg) => {
  if (msg.text && msg.text.startsWith('/')) return; // команды уже обработаны выше
  bot.sendMessage(msg.chat.id, 'Открой приложение, чтобы начать 👇', {
    reply_markup: openAppKeyboard(WEBAPP_URL),
  });
});

// ---------- Аккуратное логирование ошибок, без падения процесса ----------
bot.on('polling_error', (err) => console.error('Polling error:', err.message));

console.log('🤖 FORTX bot is running...');