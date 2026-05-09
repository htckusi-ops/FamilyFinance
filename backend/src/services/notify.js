const db = require('../db');

let bot = null;

if (process.env.TELEGRAM_BOT_TOKEN) {
  try {
    const TelegramBot = require('node-telegram-bot-api');
    bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: false });
  } catch {}
}

function sendNotification(userId, event, data = {}) {
  if (!bot) return;
  try {
    const parents = db.prepare("SELECT user_id FROM notification_config WHERE events LIKE ?").all(`%${event}%`);
    for (const p of parents) {
      const cfg = db.prepare('SELECT * FROM notification_config WHERE user_id=?').get(p.user_id);
      if (!cfg?.telegram_chat_id) continue;
      const child = db.prepare('SELECT name FROM users WHERE id=?').get(userId);
      const msg = formatMessage(event, child?.name || 'Kind', data);
      bot.sendMessage(cfg.telegram_chat_id, msg).catch(() => {});
    }
  } catch {}
}

function formatMessage(event, childName, data) {
  switch (event) {
    case 'points_received':
      return `⭐ ${childName} hat ${data.delta} Punkte erhalten: ${data.description || ''}`;
    case 'reward_claimed':
      return `🎁 ${childName} möchte "${data.reward_name}" einlösen!`;
    case 'allowance_paid':
      return `💰 Taschengeld für ${childName} wurde ausgezahlt: CHF ${data.amount}`;
    default:
      return `FamilyFinance: ${event} für ${childName}`;
  }
}

module.exports = { sendNotification };
