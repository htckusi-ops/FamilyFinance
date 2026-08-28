const db = require('../db');

// --- Telegram ---
let telegramBot = null;
if (process.env.TELEGRAM_BOT_TOKEN) {
  try {
    const TelegramBot = require('node-telegram-bot-api');
    telegramBot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: false });
  } catch {}
}

// --- Signal (signal-cli-rest-api) ---
// Set SIGNAL_CLI_API_URL (e.g. http://signal-cli:8080) and SIGNAL_SENDER (registered phone number)
const SIGNAL_API = process.env.SIGNAL_CLI_API_URL;
const SIGNAL_SENDER = process.env.SIGNAL_SENDER;

async function sendSignal(recipient, message) {
  if (!SIGNAL_API || !SIGNAL_SENDER) return;
  try {
    await fetch(`${SIGNAL_API}/v2/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, number: SIGNAL_SENDER, recipients: [recipient] }),
    });
  } catch {}
}

// --- Threema Gateway ---
// Set THREEMA_API_SECRET and THREEMA_FROM_ID (8-char Threema gateway ID)
const THREEMA_SECRET = process.env.THREEMA_API_SECRET;
const THREEMA_FROM   = process.env.THREEMA_FROM_ID;

async function sendThreema(toId, message) {
  if (!THREEMA_SECRET || !THREEMA_FROM) return;
  try {
    const params = new URLSearchParams({ from: THREEMA_FROM, to: toId, secret: THREEMA_SECRET, text: message });
    await fetch(`https://msgapi.threema.ch/send_simple?${params.toString()}`, { method: 'POST' });
  } catch {}
}

// ----------------------------------------------------------------

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

function sendNotification(userId, event, data = {}) {
  try {
    const parents = db.prepare("SELECT user_id FROM notification_config WHERE events LIKE ?").all(`%${event}%`);
    for (const p of parents) {
      const cfg = db.prepare('SELECT * FROM notification_config WHERE user_id=?').get(p.user_id);
      if (!cfg) continue;
      const child = db.prepare('SELECT name FROM users WHERE id=?').get(userId);
      const msg = formatMessage(event, child?.name || 'Kind', data);

      if (cfg.telegram_chat_id && telegramBot) {
        telegramBot.sendMessage(cfg.telegram_chat_id, msg).catch(() => {});
      }
      if (cfg.signal_recipient) {
        sendSignal(cfg.signal_recipient, msg);
      }
      if (cfg.threema_to_id) {
        sendThreema(cfg.threema_to_id, msg);
      }
    }
  } catch {}
}

module.exports = { sendNotification };
