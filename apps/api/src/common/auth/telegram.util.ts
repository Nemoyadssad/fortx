import * as crypto from 'crypto';

export interface TelegramUserPayload {
  id: number;
  first_name?: string;
  username?: string;
}

/**
 * Validates Telegram WebApp initData against the bot token.
 * https://core.telegram.org/bots/webapps#validating-data-received-via-the-web-app
 */
export function verifyTelegramInitData(
  initData: string,
  botToken: string,
  maxAgeSeconds = 86400,
): TelegramUserPayload {
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) throw new Error('Missing hash in initData');
  params.delete('hash');

  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');

  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const computedHash = crypto
    .createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex');

  if (computedHash !== hash) {
    throw new Error('Invalid initData signature');
  }

  const authDate = Number(params.get('auth_date'));
  if (!authDate || Date.now() / 1000 - authDate > maxAgeSeconds) {
    throw new Error('initData is expired');
  }

  const userRaw = params.get('user');
  if (!userRaw) throw new Error('Missing user in initData');

  return JSON.parse(userRaw) as TelegramUserPayload;
}