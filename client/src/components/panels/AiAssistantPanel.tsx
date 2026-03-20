import { useCallback, useRef, useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Send, AlertCircle, CheckCircle, Clock, DollarSign, Users, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { PanelShell, PanelHeader, useActiveEventId } from "@/components/panels/panel-primitives";
import { usePanel } from "@/state/panel";
import { usePlan, usePlanExpenses, usePlanCrew } from "@/hooks/use-plan-data";
import { useIsMobile } from "@/hooks/use-mobile";
import { apiRequest } from "@/lib/api";
import { getClientPlanStatus } from "@/lib/plan-lifecycle";
import { useEventRealtime } from "@/lib/event-realtime";

type BuddyMessage = {
  id: string;
  role: "user" | "buddy";
  text: string;
  timestamp: Date;
};

function formatMoneyForSystem(amount: number, currencyCode: string): string {
  const safeAmount = typeof amount === "number" && Number.isFinite(amount) ? amount : 0;
  const code = String(currencyCode || "").trim().toUpperCase();
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: code }).format(safeAmount);
  } catch {
    return `${currencyCode || "€"}${safeAmount.toFixed(2)}`;
  }
}

export default function AiAssistantPanel() {
  const eventId = useActiveEventId();
  const { replacePanel, closePanel } = usePanel();
  const isMobile = useIsMobile();
  const [buddyMessages, setBuddyMessages] = useState<BuddyMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [buddyLoading, setBuddyLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const planQuery = usePlan(eventId);
  const crewQuery = usePlanCrew(eventId);
  const expensesQuery = usePlanExpenses(eventId);

  const plan = planQuery.data;
  const crew = crewQuery.data?.members ?? [];
  const expenses = expensesQuery.data ?? [];

  const planStatus = plan ? getClientPlanStatus(plan.status) : null;

  // Auto-scroll to latest message
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  // Send message to buddy
  const sendToBuddy = useCallback(async (message: string) => {
    if (!eventId || !message.trim()) return;

    console.log("[AiAssistantPanel] Sending message to buddy:", message);

    // Add user message to local state
    const userMsg: BuddyMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      text: message.trim(),
      timestamp: new Date(),
    };
    setBuddyMessages((prev) => [...prev, userMsg]);
    setInputValue("");
    setBuddyLoading(true);

    try {
      console.log("[AiAssistantPanel] Making API request to /api/plans/" + eventId + "/chat/buddy");
      const response = await apiRequest(`/api/plans/${eventId}/chat/buddy`, {
        method: "POST",
        body: { message: message.trim() },
      });
      console.log("[AiAssistantPanel] API response:", response);

      // Add buddy message placeholder (will be updated via WebSocket)
      const buddyMsg: BuddyMessage = {
        id: `buddy-${Date.now()}`,
        role: "buddy",
        text: "Processing...",
        timestamp: new Date(),
      };
      setBuddyMessages((prev) => [...prev, buddyMsg]);
      scrollToBottom();
    } catch (err) {
      console.error("[AiAssistantPanel] Buddy error:", err);
      setBuddyMessages((prev) => [
        ...prev,
        {
          id: `error-${Date.now()}`,
          role: "buddy",
          text: "Sorry, something went wrong. Check the browser console for details.",
          timestamp: new Date(),
        },
      ]);
    } finally {
      setBuddyLoading(false);
    }
  }, [eventId, scrollToBottom]);

  // Listen for buddy responses via WebSocket
  const handleWebSocketMessage = useCallback((payload: unknown) => {
    if (typeof payload !== "object" || !payload) return;
    const data = payload as Record<string, unknown>;

    // Handle chat:new events
    if (data.type === "chat:new" && data.message) {
      const msg = data.message as Record<string, unknown>;
      if (msg.type === "buddy" || msg.type === "buddy_expense_suggestion") {
        // Check if we have a "Processing..." placeholder to replace
        setBuddyMessages((prev) => {
          const lastMsg = prev[prev.length - 1];
          if (lastMsg?.role === "buddy" && lastMsg.text === "Processing...") {
            // Replace the placeholder with actual message
            return [
              ...prev.slice(0, -1),
              {
                id: `buddy-${Date.now()}`,
                role: "buddy",
                text: String(msg.content ?? ""),
                timestamp: new Date(),
              },
            ];
          }
          return prev;
        });
      }
    }
  }, []);

  useEventRealtime(eventId || null, true, handleWebSocketMessage);

  // Calculate insights
  const insights = useMemo(() => {
    if (!plan || !expenses) return null;

    const totalSpent = expenses.reduce((sum: number, e: any) => {
      const amount = typeof e.amount === "string" ? parseFloat(e.amount) : e.amount;
      return sum + (isNaN(amount) ? 0 : amount);
    }, 0);

    const pendingMembers = crew.filter((m: any) => !m.joinedAt) || [];
    const confirmed = crew.length > 0 ? crew.length - pendingMembers.length : 0;
    const attendanceStatus =
      crew.length > 0
        ? `${confirmed}/${crew.length} confirmed`
        : "No members yet";

    return { totalSpent, pendingMembers, attendanceStatus, confirmed };
  }, [plan, expenses, crew]);

  // Smart suggestions based on plan state
  const suggestions = useMemo(() => {
    const sugg: Array<{ priority: "high" | "medium" | "low"; text: string; action?: string }> = [];

    if (insights) {
      if (insights.pendingMembers.length > 0) {
        sugg.push({
          priority: "high",
          text: `${insights.pendingMembers.length} member${insights.pendingMembers.length !== 1 ? "s" : ""} haven't confirmed yet`,
          action: "remind",
        });
      }

      if (insights.totalSpent === 0 && crew.length > 0) {
        sugg.push({
          priority: "medium",
          text: "No expenses recorded yet. Ready to add the first one?",
          action: "add-expense",
        });
      }
    }

    if (planStatus === "active") {
      sugg.push({
        priority: "medium",
        text: "Plan is active. You can create polls to coordinate with the group.",
        action: "create-poll",
      });
    }

    return sugg.slice(0, 3);
  }, [insights, crew.length, planStatus]);

  if (!plan) {
    return (
      <PanelShell>
        <PanelHeader title="Loading..." />
        <div className="flex items-center justify-center h-full text-muted-foreground">
          <span>Loading plan...</span>
        </div>
      </PanelShell>
    );
  }

  return (
    <PanelShell>
      <PanelHeader title="✨ Splann-O AI Assistant" />

      <div className={cn("flex flex-col h-full overflow-hidden", isMobile ? "px-3 py-4" : "px-5 py-5")}>
        {/* BUDDY CHAT SECTION */}
        <div
          className={cn(
            "flex-1 flex flex-col border border-border/60 rounded-lg mb-4 overflow-hidden bg-muted/20",
            isMobile ? "min-h-[200px]" : "min-h-[280px]",
          )}
        >
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {buddyMessages.length === 0 ? (
              <div className="flex items-center justify-center h-full text-center text-muted-foreground text-sm">
                <div>
                  <p className="font-medium mb-1">👋 Hey! I'm your Splann-O buddy</p>
                  <p className="text-xs">Ask me anything about your plan</p>
                </div>
              </div>
            ) : (
              <>
                {buddyMessages.map((msg) => (
                  <div key={msg.id} className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}>
                    <div
                      className={cn(
                        "max-w-[80%] px-3 py-2 rounded-lg text-sm",
                        msg.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-background border border-border/70 text-foreground",
                      )}
                    >
                      {msg.text}
                    </div>
                  </div>
                ))}
                {buddyLoading && (
                  <div className="flex justify-start">
                    <div className="bg-background border border-border/70 px-3 py-2 rounded-lg">
                      <div className="flex gap-1">
                        <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" />
                        <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce delay-100" />
                        <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce delay-200" />
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </>
            )}
          </div>

          {/* Input */}
          <div className="border-t border-border/60 p-2 flex gap-2">
            <Input
              placeholder="Ask the buddy..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !buddyLoading) {
                  e.preventDefault();
                  sendToBuddy(inputValue);
                }
              }}
              disabled={buddyLoading}
              className="h-8 text-sm"
            />
            <Button
              size="sm"
              disabled={!inputValue.trim() || buddyLoading}
              onClick={() => sendToBuddy(inputValue)}
              className="h-8 w-8 p-0"
            >
              {buddyLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        {/* SMART SUGGESTIONS */}
        {suggestions.length > 0 && (
          <div className="mb-4 border border-border/60 rounded-lg p-3 bg-muted/20">
            <h3 className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1">
              <Zap className="h-3.5 w-3.5" />
              Smart Suggestions
            </h3>
            <div className="space-y-2">
              {suggestions.map((suggestion, idx) => (
                <div
                  key={idx}
                  className={cn(
                    "flex items-start gap-2 text-xs p-2 rounded",
                    suggestion.priority === "high" && "bg-red-500/10 border border-red-500/20",
                    suggestion.priority === "medium" && "bg-amber-500/10 border border-amber-500/20",
                    suggestion.priority === "low" && "bg-blue-500/10 border border-blue-500/20",
                  )}
                >
                  <div className="mt-0.5">
                    {suggestion.priority === "high" && <AlertCircle className="h-3.5 w-3.5 text-red-600" />}
                    {suggestion.priority === "medium" && <Clock className="h-3.5 w-3.5 text-amber-600" />}
                    {suggestion.priority === "low" && <CheckCircle className="h-3.5 w-3.5 text-blue-600" />}
                  </div>
                  <div className="flex-1">
                    <p className="text-foreground/90">{suggestion.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* QUICK ACTIONS */}
        <div className="mb-4 border border-border/60 rounded-lg p-3 bg-muted/20">
          <h3 className="text-xs font-semibold text-foreground mb-2">Quick Actions</h3>
          <div className="grid grid-cols-2 gap-2">
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs"
              onClick={() => replacePanel({ type: "add-poll" })}
              disabled={planStatus !== "active"}
            >
              Create Poll
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs"
              onClick={() => replacePanel({ type: "add-expense" })}
              disabled={planStatus !== "active"}
            >
              Add Expense
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs"
              onClick={() => replacePanel({ type: "crew" })}
            >
              View Members
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs"
              onClick={() => replacePanel({ type: "overview" })}
            >
              Overview
            </Button>
          </div>
        </div>

        {/* PLAN INSIGHTS */}
        {insights && (
          <div className="border border-border/60 rounded-lg p-3 bg-muted/20">
            <h3 className="text-xs font-semibold text-foreground mb-3">Plan Insights</h3>
            <div className="space-y-3">
              {/* Budget */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <DollarSign className="h-3.5 w-3.5" />
                    Spent
                  </span>
                  <span className="text-xs font-semibold">
                    {formatMoneyForSystem(insights.totalSpent, plan.currency ?? "EUR")}
                  </span>
                </div>
                <div className="w-full bg-muted h-1.5 rounded-full overflow-hidden">
                  <div className="bg-primary h-full" style={{ width: `${Math.min(100, (insights.totalSpent / 200) * 100)}%` }} />
                </div>
              </div>

              {/* Attendance */}
              <div className="flex items-center justify-between p-2 bg-background/50 rounded text-xs">
                <span className="text-muted-foreground flex items-center gap-1">
                  <Users className="h-3.5 w-3.5" />
                  Attendance
                </span>
                <span className="font-semibold">{insights.attendanceStatus}</span>
              </div>

              {/* Status */}
              <div className="flex items-center justify-between p-2 bg-background/50 rounded text-xs">
                <span className="text-muted-foreground">Status</span>
                <span className="font-semibold capitalize text-primary">{planStatus}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </PanelShell>
  );
}
