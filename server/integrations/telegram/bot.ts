import TelegramBot from "node-telegram-bot-api";
import { log } from "../../lib/logger";
import { linkTelegramGroupToPlan } from "./plan-link-service";
import { createTelegramAppHomeUrl, createTelegramAppLinks } from "./app-links";
import { parseTelegramPlanStartPayload } from "./start-payload";
import {
  createPendingTelegramGroupLinkRequest,
  createTelegramGroupLinkPayload,
  parseTelegramGroupLinkPayload,
  consumePendingTelegramGroupLinkRequest,
} from "./group-link-request-service";
import { resolveTelegramBotUsername } from "../../config/env";
import {
  getExpensesSummary,
  getNextStep,
  getParticipants,
  getPlanStatus,
  getSettlementStatus,
  resolveTelegramPlanFromChat,
} from "./plan-summary-service";
import { ingestTelegramGroupMessage } from "./inbound-sync-service";

type SplannoTelegramBot = TelegramBot;

type TelegramRuntimeState = {
  bot?: SplannoTelegramBot;
  startPromise?: Promise<SplannoTelegramBot>;
};

const TELEGRAM_RUNTIME_KEY = "__splannoTelegramBotRuntime";

function getRuntimeState(): TelegramRuntimeState {
  const host = globalThis as typeof globalThis & {
    [TELEGRAM_RUNTIME_KEY]?: TelegramRuntimeState;
  };
  if (!host[TELEGRAM_RUNTIME_KEY]) {
    host[TELEGRAM_RUNTIME_KEY] = {};
  }
  return host[TELEGRAM_RUNTIME_KEY]!;
}

function getRequiredToken() {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!token) {
    throw new Error("Missing TELEGRAM_BOT_TOKEN. Add it to your environment before starting the Telegram bot.");
  }
  return token;
}

function buildStartReply() {
  return [
    "Hi, I am the first Splann-O Telegram bot.",
    "Use a Splann-O Telegram link from the app to connect a group.",
    "Then run /status, /next, /who, /expenses, or /settle in that group.",
  ].join("\n");
}

function buildUnlinkedReply() {
  return [
    "This chat is not connected to a Splann-O plan yet.",
    "Go back to the app and tap 'Connect Telegram'.",
  ].join("\n");
}

function buildMoney(amount: number, currencyCode: string) {
  const safeAmount = Number.isFinite(amount) ? amount : 0;
  const code = String(currencyCode || "").trim().toUpperCase();
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: code }).format(safeAmount);
  } catch {
    return `${currencyCode || "€"}${safeAmount.toFixed(2)}`;
  }
}

function createOpenAppKeyboard(url: string): TelegramBot.SendMessageOptions["reply_markup"] {
  return {
    inline_keyboard: [[{ text: "Open plan", url }]],
  };
}

function createPlanKeyboard(planId: number, options?: { invite?: boolean; expenses?: boolean; settle?: boolean }): TelegramBot.SendMessageOptions["reply_markup"] {
  const links = createTelegramAppLinks(planId);
  const firstRow = [{ text: "Open plan", url: links.openPlanUrl }];
  const secondRow = [
    options?.invite ? { text: "Invite friends", url: links.inviteFriendsUrl } : null,
    options?.expenses ? { text: "View expenses", url: links.viewExpensesUrl } : null,
    options?.settle ? { text: "Settle up", url: links.settleUrl } : null,
  ].filter((entry): entry is { text: string; url: string } => !!entry);

  return {
    inline_keyboard: secondRow.length > 0 ? [firstRow, secondRow] : [firstRow],
  };
}

function buildStatusReply(status: Awaited<ReturnType<typeof getPlanStatus>>) {
  const lines = [`👥 ${status.joinedCount} ${status.joinedCount === 1 ? "person" : "people"}`];
  if (status.outstandingCount > 0) {
    lines.push(`⏳ ${status.outstandingCount} ${status.outstandingCount === 1 ? "still needs" : "still need"} to join`);
  }
  lines.push(`💸 ${buildMoney(status.totalSpent, status.currency)} total spent`);
  return lines.join("\n");
}

function buildNextReply(nextStep: Awaited<ReturnType<typeof getNextStep>>) {
  return [
    `👉 Next step: ${nextStep.title}`,
    nextStep.detail,
  ].join("\n");
}

function buildWhoReply(summary: Awaited<ReturnType<typeof getParticipants>>) {
  const lines = [
    "👥 Joined:",
    ...(summary.joined.length > 0 ? summary.joined.map((name) => `- ${name}`) : ["- No one yet"]),
  ];
  if (summary.pending.length > 0) {
    lines.push("", "⏳ Pending:", ...summary.pending.map((name) => `- ${name}`));
  }
  return lines.join("\n");
}

function buildExpensesReply(summary: Awaited<ReturnType<typeof getExpensesSummary>>) {
  const lines = [
    `💸 Total: ${buildMoney(summary.totalSpent, summary.currency)}`,
    summary.expenseCount > 0
      ? `${summary.expenseCount} ${summary.expenseCount === 1 ? "expense" : "expenses"} tracked`
      : "No expenses yet",
  ];
  if (summary.topSpenders.length > 0) {
    lines.push("Top spenders:", ...summary.topSpenders.map((row) => `- ${row.name} (${buildMoney(row.amount, summary.currency)})`));
  }
  return lines.join("\n");
}

function buildSettleReply(summary: Awaited<ReturnType<typeof getSettlementStatus>>) {
  const icon = summary.state === "completed"
    ? "✅"
    : summary.state === "ready"
      ? "⚖️"
      : summary.state === "in_progress"
        ? "⏳"
        : "⚖️";
  return [
    `${icon} ${summary.title}`,
    summary.detail,
  ].join("\n");
}

function buildHelpReply() {
  return [
    "I can help you keep your plan on track.",
    "",
    "Try:",
    "- /status",
    "- /next",
    "- /who",
    "- /expenses",
    "- /settle",
  ].join("\n");
}

function buildPlanMissingReply() {
  return "I could not find that Splann-O plan anymore. Open a fresh Telegram link from the app and try again.";
}

function buildLinkSuccessReply(result: Awaited<ReturnType<typeof linkTelegramGroupToPlan>>) {
  const chatTitle = result.telegramChatTitle ? ` "${result.telegramChatTitle}"` : "";
  if (result.outcome === "linked") {
    return `This Telegram group${chatTitle} is now connected to "${result.planName}" (#${result.planId}).`;
  }
  if (result.outcome === "relinked") {
    return `This Telegram group${chatTitle} was re-linked and now points to "${result.planName}" (#${result.planId}).`;
  }
  return `This Telegram group${chatTitle} is already connected to "${result.planName}" (#${result.planId}).`;
}

function getGroupLinkUrl(payload: string) {
  const username = resolveTelegramBotUsername();
  if (!username) throw new Error("Missing TELEGRAM_BOT_USERNAME");
  const url = new URL(`https://t.me/${username}`);
  url.searchParams.set("startgroup", payload);
  return url.toString();
}

function isGroupChat(type: TelegramBot.Chat["type"]) {
  return type === "group" || type === "supergroup";
}

function buildPrivateStartWithPlanReply(planName: string) {
  return [
    `Almost done. We need to finish linking in your Telegram group for "${planName}".`,
    "Tap the button below, pick your group, and send the auto-filled /start message there.",
  ].join("\n");
}

function buildGroupFinalizeIntro(planName: string) {
  return `Linking this group to "${planName}"...`;
}

async function withLinkedPlan(
  bot: SplannoTelegramBot,
  chatId: number,
  handler: (linkedPlan: NonNullable<Awaited<ReturnType<typeof resolveTelegramPlanFromChat>>>) => Promise<{
    text: string;
    replyMarkup?: TelegramBot.SendMessageOptions["reply_markup"];
  }>,
) {
  const linkedPlan = await resolveTelegramPlanFromChat(chatId);
  if (!linkedPlan) {
    await bot.sendMessage(chatId, buildUnlinkedReply(), {
      reply_markup: createOpenAppKeyboard(createTelegramAppHomeUrl()),
    });
    return;
  }

  try {
    const result = await handler(linkedPlan);
    await bot.sendMessage(chatId, result.text, result.replyMarkup ? { reply_markup: result.replyMarkup } : undefined);
  } catch (error) {
    log("warn", "telegram_command_failed", {
      chatId: String(chatId),
      planId: linkedPlan.planId,
      message: error instanceof Error ? error.message : String(error),
    });
    await bot.sendMessage(
      chatId,
      error instanceof Error && /plan not found/i.test(error.message)
        ? buildPlanMissingReply()
        : "I could not load that plan right now. Please try again in a moment.",
      {
        reply_markup: createOpenAppKeyboard(createTelegramAppHomeUrl()),
      },
    );
  }
}

function registerCommandHandlers(bot: SplannoTelegramBot) {
  bot.onText(/^\/start(?:@\w+)?(?:\s+(.+))?$/i, async (message, match) => {
    const rawPayload = match?.[1]?.trim() ?? "";
    log("info", "telegram_start_received", {
      chatId: String(message.chat.id),
      hasPayload: !!rawPayload,
      payloadPreview: rawPayload ? rawPayload.slice(0, 48) : null,
    });

    const planPayload = parseTelegramPlanStartPayload(rawPayload);
    const pendingPayload = parseTelegramGroupLinkPayload(rawPayload);
    if (!planPayload && !pendingPayload) {
      await bot.sendMessage(message.chat.id, buildStartReply());
      return;
    }

    try {
      if (planPayload) {
        log("info", "telegram_start_payload_parsed", {
          chatId: String(message.chat.id),
          chatType: message.chat.type,
          planId: planPayload.planId,
        });

        if (isGroupChat(message.chat.type)) {
          const result = await linkTelegramGroupToPlan({
            chatId: message.chat.id,
            planId: planPayload.planId,
            telegramChatTitle: message.chat.title ?? null,
            telegramChatType: message.chat.type ?? null,
          });
          await bot.sendMessage(message.chat.id, buildLinkSuccessReply(result), {
            reply_markup: createPlanKeyboard(result.planId, { expenses: true, invite: true }),
          });
          return;
        }

        const request = await createPendingTelegramGroupLinkRequest({
          planId: planPayload.planId,
          requestedByTelegramUserId: message.from?.id ?? null,
        });
        const groupPayload = createTelegramGroupLinkPayload(request.token);
        await bot.sendMessage(message.chat.id, buildPrivateStartWithPlanReply(request.planName), {
          reply_markup: {
            inline_keyboard: [[
              { text: "Add bot to group", url: getGroupLinkUrl(groupPayload) },
            ]],
          },
        });
        return;
      }

      if (!pendingPayload) {
        await bot.sendMessage(message.chat.id, buildStartReply());
        return;
      }

      if (!isGroupChat(message.chat.type)) {
        await bot.sendMessage(message.chat.id, "This step must be finished in a Telegram group. Add the bot to your group and run the start link there.");
        return;
      }

      const request = await consumePendingTelegramGroupLinkRequest({
        token: pendingPayload.token,
        chatId: message.chat.id,
        telegramUserId: message.from?.id ?? null,
      });
      if (request.code === "not_found" || request.code === "expired") {
        await bot.sendMessage(message.chat.id, "This link has expired. Go back to Splann-O and tap Connect Telegram again.");
        return;
      }
      if (request.code === "already_used") {
        await bot.sendMessage(message.chat.id, `This link was already used for "${request.planName}". If needed, start a new connect flow from the app.`);
        return;
      }
      if (request.code === "wrong_user") {
        await bot.sendMessage(message.chat.id, "This link was created by another Telegram user. Ask that user to finish the link, or create a new one from Splann-O.");
        return;
      }

      await bot.sendMessage(message.chat.id, buildGroupFinalizeIntro(request.planName));
      const result = await linkTelegramGroupToPlan({
        chatId: message.chat.id,
        planId: request.planId,
        telegramChatTitle: message.chat.title ?? null,
        telegramChatType: message.chat.type ?? null,
      });
      await bot.sendMessage(message.chat.id, buildLinkSuccessReply(result), {
        reply_markup: createPlanKeyboard(result.planId, { expenses: true, invite: true }),
      });
    } catch (error) {
      log("warn", "telegram_plan_link_failed", {
        chatId: String(message.chat.id),
        chatType: message.chat.type,
        payloadPreview: rawPayload ? rawPayload.slice(0, 48) : null,
        message: error instanceof Error ? error.message : String(error),
      });
      await bot.sendMessage(
        message.chat.id,
        error instanceof Error && /plan not found/i.test(error.message)
          ? "I could not find that Splann-O plan anymore. Open a fresh Telegram link from the app and try again."
          : "I could not connect this Telegram chat right now. Please try the Telegram link from the app again in a moment.",
      );
    }
  });

  bot.onText(/^\/status(?:@\w+)?$/, async (message) => {
    await withLinkedPlan(bot, message.chat.id, async (linkedPlan) => {
      const status = await getPlanStatus(linkedPlan.planId);
      return {
        text: buildStatusReply(status),
        replyMarkup: createPlanKeyboard(linkedPlan.planId, { invite: status.outstandingCount > 0, expenses: true }),
      };
    });
  });

  bot.onText(/^\/next(?:@\w+)?$/, async (message) => {
    await withLinkedPlan(bot, message.chat.id, async (linkedPlan) => {
      const nextStep = await getNextStep(linkedPlan.planId);
      return {
        text: buildNextReply(nextStep),
        replyMarkup: createPlanKeyboard(linkedPlan.planId, {
          invite: nextStep.ctaLabel === "Invite friends",
          expenses: nextStep.ctaLabel === "View expenses",
          settle: nextStep.ctaLabel === "Settle up",
        }),
      };
    });
  });

  bot.onText(/^\/who(?:@\w+)?$/, async (message) => {
    await withLinkedPlan(bot, message.chat.id, async (linkedPlan) => {
      const participants = await getParticipants(linkedPlan.planId);
      return {
        text: buildWhoReply(participants),
        replyMarkup: createPlanKeyboard(linkedPlan.planId, { invite: participants.pending.length > 0 }),
      };
    });
  });

  bot.onText(/^\/expenses(?:@\w+)?$/, async (message) => {
    await withLinkedPlan(bot, message.chat.id, async (linkedPlan) => {
      const summary = await getExpensesSummary(linkedPlan.planId);
      return {
        text: buildExpensesReply(summary),
        replyMarkup: createPlanKeyboard(linkedPlan.planId, { expenses: true, settle: summary.totalSpent > 0 }),
      };
    });
  });

  bot.onText(/^\/settle(?:@\w+)?$/, async (message) => {
    await withLinkedPlan(bot, message.chat.id, async (linkedPlan) => {
      const settlement = await getSettlementStatus(linkedPlan.planId);
      return {
        text: buildSettleReply(settlement),
        replyMarkup: createPlanKeyboard(linkedPlan.planId, {
          settle: settlement.state === "ready" || settlement.state === "in_progress",
          invite: settlement.state === "not_ready",
        }),
      };
    });
  });

  bot.onText(/^\/help(?:@\w+)?$/, async (message) => {
    const linkedPlan = await resolveTelegramPlanFromChat(message.chat.id);
    await bot.sendMessage(message.chat.id, buildHelpReply(), {
      reply_markup: linkedPlan
        ? createPlanKeyboard(linkedPlan.planId, { invite: true, expenses: true, settle: true })
        : createOpenAppKeyboard(createTelegramAppHomeUrl()),
    });
  });

  bot.on("message", async (message) => {
    try {
      const result = await ingestTelegramGroupMessage(message);
      if (result.status === "synced") {
        log("info", "telegram_inbound_message_synced", {
          chatId: String(message.chat.id),
          eventId: result.eventId,
          inserted: result.inserted,
          messageId: result.messageId,
        });
      }
    } catch (error) {
      log("warn", "telegram_inbound_message_failed", {
        chatId: String(message.chat.id),
        messageId: Number(message.message_id) || null,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });
}

function attachBotLogging(bot: SplannoTelegramBot) {
  bot.on("polling_error", (error) => {
    log("error", "telegram_polling_error", {
      message: error instanceof Error ? error.message : String(error),
    });
  });

  bot.on("webhook_error", (error) => {
    log("error", "telegram_webhook_error", {
      message: error instanceof Error ? error.message : String(error),
    });
  });

  bot.on("error", (error) => {
    log("error", "telegram_bot_error", {
      message: error instanceof Error ? error.message : String(error),
    });
  });
}

async function configureBot(bot: SplannoTelegramBot) {
  await bot.setMyCommands([
    { command: "start", description: "Start de Splann-O bot" },
    { command: "status", description: "Bekijk de huidige planstatus" },
    { command: "next", description: "Bekijk de volgende stap" },
    { command: "who", description: "Bekijk wie joined of pending is" },
    { command: "expenses", description: "Bekijk het expense-overzicht" },
    { command: "settle", description: "Bekijk of settlement klaar is" },
    { command: "help", description: "Bekijk wat ik kan doen" },
  ]);
}

export async function sendTelegramGroupTextMessage(chatId: number | string, text: string) {
  const state = getRuntimeState();
  const bot = state.bot;
  if (!bot) {
    throw new Error("Telegram bot is not running");
  }
  const targetChatId = Number(chatId);
  if (!Number.isFinite(targetChatId)) {
    throw new Error("Invalid Telegram chat id");
  }
  const payload = String(text ?? "").trim();
  if (!payload) {
    throw new Error("Message text is required");
  }
  return bot.sendMessage(targetChatId, payload);
}

export async function startTelegramBot(): Promise<SplannoTelegramBot> {
  const state = getRuntimeState();
  if (state.bot) return state.bot;
  if (state.startPromise) return state.startPromise;

  state.startPromise = (async () => {
    const token = getRequiredToken();
    const bot = new TelegramBot(token, {
      polling: {
        autoStart: false,
        params: {
          timeout: 20,
        },
      },
    });

    registerCommandHandlers(bot);
    attachBotLogging(bot);
    await configureBot(bot);
    await bot.startPolling();

    log("info", "telegram_bot_started", {
      mode: "polling",
    });

    state.bot = bot;
    return bot;
  })();

  try {
    return await state.startPromise;
  } catch (error) {
    state.startPromise = undefined;
    throw error;
  }
}

export async function stopTelegramBot(): Promise<void> {
  const state = getRuntimeState();
  const bot = state.bot;
  state.bot = undefined;
  state.startPromise = undefined;
  if (!bot) return;

  try {
    await bot.stopPolling();
    log("info", "telegram_bot_stopped");
  } catch (error) {
    log("warn", "telegram_bot_stop_failed", {
      message: error instanceof Error ? error.message : String(error),
    });
  }
}
