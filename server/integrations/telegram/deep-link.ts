import { resolveTelegramBotUsername } from "../../config/env";
import { createTelegramPlanStartPayload } from "./start-payload";

function getTelegramBotUsername() {
  const username = resolveTelegramBotUsername();
  if (!username) {
    throw new Error("Missing TELEGRAM_BOT_USERNAME. Add the public Telegram bot username to your environment.");
  }
  if (!/^[a-zA-Z0-9_]{5,32}$/.test(username)) {
    throw new Error("Invalid TELEGRAM_BOT_USERNAME. Use the public Telegram bot username without the leading @.");
  }
  return username;
}

export function createTelegramPlanDeepLink(planId: number) {
  const username = getTelegramBotUsername();
  const payload = createTelegramPlanStartPayload(planId);
  const privateUrl = new URL(`https://t.me/${username}`);
  privateUrl.searchParams.set("start", payload);
  const groupUrl = new URL(`https://t.me/${username}`);
  groupUrl.searchParams.set("startgroup", payload);
  return {
    username,
    payload,
    url: groupUrl.toString(),
    privateUrl: privateUrl.toString(),
    groupUrl: groupUrl.toString(),
  };
}
