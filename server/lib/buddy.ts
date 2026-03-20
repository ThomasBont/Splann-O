import Anthropic from "@anthropic-ai/sdk";
import { createPoll } from "./polls";
import { postSystemChatMessage } from "./systemChat";
import { broadcastEventRealtime } from "./eventRealtime";
import { db } from "../db";
import { barbecues, eventMembers, users, expenses, participants } from "@shared/schema";
import { eq, inArray, desc } from "drizzle-orm";
import { log } from "./logger";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const BUDDY_TOOLS: Anthropic.Tool[] = [
  {
    name: "create_poll",
    description:
      "Create a poll in the group chat for the group to vote on",
    input_schema: {
      type: "object" as const,
      properties: {
        question: { type: "string", description: "The poll question" },
        options: {
          type: "array",
          items: { type: "string" },
          description: "2 to 6 answer options",
        },
      },
      required: ["question", "options"],
    },
  },
  {
    name: "post_suggestion",
    description: "Post a suggestion or tip as a message in the chat",
    input_schema: {
      type: "object" as const,
      properties: {
        text: { type: "string", description: "The message to post" },
      },
      required: ["text"],
    },
  },
  {
    name: "suggest_expense",
    description:
      "Suggest an expense based on a receipt or user question",
    input_schema: {
      type: "object" as const,
      properties: {
        description: {
          type: "string",
          description: "Description of the expense",
        },
        amount: {
          type: "number",
          description: "Amount in the plan currency",
        },
        message: {
          type: "string",
          description: "Accompanying message for the group",
        },
      },
      required: ["description", "amount", "message"],
    },
  },
];

async function getPlanContext(eventId: number) {
  const [plan] = await db
    .select({
      id: barbecues.id,
      name: barbecues.name,
      eventType: barbecues.eventType,
      date: barbecues.date,
      locationName: barbecues.locationName,
      currency: barbecues.currency,
      creatorUserId: barbecues.creatorUserId,
    })
    .from(barbecues)
    .where(eq(barbecues.id, eventId))
    .limit(1);

  if (!plan) return null;

  const memberRows = await db
    .select({ userId: eventMembers.userId })
    .from(eventMembers)
    .where(eq(eventMembers.eventId, eventId));

  const userIds = memberRows
    .map((r) => Number(r.userId))
    .filter((id) => Number.isFinite(id) && id > 0);

  const memberUsers =
    userIds.length > 0
      ? await db
          .select({
            id: users.id,
            username: users.username,
            displayName: users.displayName,
          })
          .from(users)
          .where(inArray(users.id, userIds))
      : [];

  const recentExpenses = await db
    .select({
      item: expenses.item,
      amount: expenses.amount,
    })
    .from(expenses)
    .where(eq(expenses.barbecueId, eventId))
    .orderBy(desc(expenses.createdAt))
    .limit(5);

  return { plan, members: memberUsers, recentExpenses };
}

export async function handleBuddyMessage(input: {
  eventId: number;
  userId: number;
  username: string;
  avatarUrl?: string | null;
  message: string;
  receiptData?: {
    rawText: string;
    merchant?: string;
    amount?: number;
    date?: string;
  };
}): Promise<void> {
  const context = await getPlanContext(input.eventId);
  if (!context) {
    log("warn", "buddy_plan_not_found", { eventId: input.eventId });
    return;
  }

  const { plan, members, recentExpenses } = context;
  const memberNames = members
    .map((m) => m.displayName || m.username)
    .filter(Boolean)
    .join(", ");

  const receiptSection = input.receiptData
    ? `
## Receipt uploaded by ${input.username}

Raw text: ${input.receiptData.rawText.slice(0, 800)}

${input.receiptData.merchant ? `Merchant: ${input.receiptData.merchant}` : ""}
${input.receiptData.amount ? `Amount: ${input.receiptData.amount} ${plan.currency ?? "EUR"}` : ""}
${input.receiptData.date ? `Date: ${input.receiptData.date}` : ""}
`
    : "";

  const expenseSection =
    recentExpenses.length > 0
      ? `\nRecent expenses: ${recentExpenses.map((e) => `${e.item} (${e.amount})`).join(", ")}`
      : "";

  const systemPrompt = `You are the AI plan buddy for "${plan.name}", a ${plan.eventType ?? "general"} plan on Splann-O.
Date: ${plan.date ?? "not set yet"}
Location: ${plan.locationName ?? "not set yet"}
Currency: ${plan.currency ?? "EUR"}
Group members: ${memberNames || "unknown"}${expenseSection}${receiptSection}

Help the group build the plan via the chat. Use tools to create polls, post messages, or suggest expenses. Be enthusiastic, helpful, and concise. Respond in the same language as the user (EN/NL/ES/IT etc). If a receipt was uploaded, process it as an expense suggestion. Always respond with post_suggestion or create_poll — never respond with text alone.`;

  let response: Anthropic.Message;
  try {
    response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1000,
      system: systemPrompt,
      tools: BUDDY_TOOLS,
      messages: [
        {
          role: "user",
          content: `${input.username}: ${input.message}`,
        },
      ],
    });
  } catch (err) {
    log("error", "buddy_anthropic_error", {
      eventId: input.eventId,
      message: err instanceof Error ? err.message : String(err),
    });
    await postSystemChatMessage(
      input.eventId,
      "Oops, the buddy is unavailable right now. Try again later.",
      { type: "buddy", buddyError: true }
    );
    return;
  }

  log("info", "buddy_response", {
    eventId: input.eventId,
    stopReason: response.stop_reason,
    blockCount: response.content.length,
  });

  for (const block of response.content) {
    if (block.type === "text" && block.text.trim()) {
      // Send buddy response ONLY to AI Assistant panel via WebSocket (not to main chat)
      broadcastEventRealtime(input.eventId, {
        type: "buddy:response",
        eventId: input.eventId,
        content: block.text.trim(),
      });
    }

    if (block.type === "tool_use") {
      await executeTool(block.name, block.input as Record<string, unknown>, {
        eventId: input.eventId,
        userId: input.userId,
        username: input.username,
        avatarUrl: input.avatarUrl,
      });
    }
  }
}

async function executeTool(
  toolName: string,
  toolInput: Record<string, unknown>,
  context: {
    eventId: number;
    userId: number;
    username: string;
    avatarUrl?: string | null;
  }
): Promise<void> {
  log("info", "buddy_tool_call", { eventId: context.eventId, tool: toolName });

  if (toolName === "create_poll") {
    const question = String(toolInput.question ?? "");
    const options = Array.isArray(toolInput.options)
      ? (toolInput.options as string[]).filter(
          (o) => typeof o === "string" && o.trim()
        )
      : [];

    if (!question || options.length < 2) return;

    const { message } = await createPoll({
      eventId: context.eventId,
      userId: context.userId,
      username: "Splann-O",
      avatarUrl: context.avatarUrl ?? null,
      question,
      options,
    });

    broadcastEventRealtime(context.eventId, {
      type: "chat:new",
      eventId: context.eventId,
      message,
    });
  }

  if (toolName === "post_suggestion") {
    const text = String(toolInput.text ?? "").trim();
    if (!text) return;
    // Send to AI Assistant panel only
    broadcastEventRealtime(context.eventId, {
      type: "buddy:response",
      eventId: context.eventId,
      content: text,
    });
  }

  if (toolName === "suggest_expense") {
    const description = String(toolInput.description ?? "").trim();
    const amount = Number(toolInput.amount ?? 0);
    const message = String(toolInput.message ?? "").trim();

    if (!description || !Number.isFinite(amount) || amount <= 0) return;

    const text = message
      ? `${message}\n\n💡 Suggested expense: **${description}** — €${amount.toFixed(2)}`
      : `💡 Suggested expense: **${description}** — €${amount.toFixed(2)}`;

    // Send to AI Assistant panel only
    broadcastEventRealtime(context.eventId, {
      type: "buddy:response",
      eventId: context.eventId,
      content: text,
    });
  }
}
