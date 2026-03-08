import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { BarChart3, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAppToast } from "@/hooks/use-app-toast";
import { usePlan, messagesQueryKey } from "@/hooks/use-plan-data";
import { PanelHeader, PanelSection, PanelShell, useActiveEventId } from "@/components/panels/panel-primitives";
import type { ChatMessage, PlanMessagesPage } from "@/hooks/use-event-chat";

export function AddPollPanel({
  source: _source = "polls",
}: {
  source?: "polls" | "overview";
}) {
  const eventId = useActiveEventId();
  const queryClient = useQueryClient();
  const { toastError, toastSuccess } = useAppToast();
  const planQuery = usePlan(eventId);
  const [question, setQuestion] = useState("");
  const [optionFields, setOptionFields] = useState(["", ""]);
  const [optionsError, setOptionsError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const parsedOptions = useMemo(() => {
    return optionFields.map((option) => option.trim()).filter(Boolean);
  }, [optionFields]);

  const updateOptionField = (index: number, value: string) => {
    setOptionFields((current) => current.map((option, currentIndex) => (currentIndex === index ? value : option)));
    if (optionsError) setOptionsError(null);
  };

  const addOptionField = () => {
    setOptionFields((current) => (current.length >= 6 ? current : [...current, ""]));
    if (optionsError) setOptionsError(null);
  };

  const removeOptionField = (index: number) => {
    setOptionFields((current) => (current.length <= 2 ? current : current.filter((_, currentIndex) => currentIndex !== index)));
    if (optionsError) setOptionsError(null);
  };

  const handleCreatePoll = async () => {
    const trimmedQuestion = question.trim();
    const uniqueOptions = parsedOptions.filter((option, index, list) => (
      list.findIndex((candidate) => candidate.toLowerCase() === option.toLowerCase()) === index
    ));
    if (!eventId) {
      toastError("Plan not loaded yet.");
      return;
    }
    if (!trimmedQuestion) {
      toastError("Add a vote question.");
      return;
    }
    if (uniqueOptions.length < 2) {
      setOptionsError("Add at least 2 non-empty options.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/events/${eventId}/polls`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          question: trimmedQuestion,
          options: uniqueOptions,
        }),
      });
      const body = await res.json().catch(() => ({} as Record<string, unknown>));
      if (!res.ok) {
        const errorMessage = typeof body.message === "string" ? body.message : "Failed to create poll";
        throw new Error(errorMessage);
      }
      const createdMessage = (body as { message?: ChatMessage }).message;
      setQuestion("");
      setOptionFields(["", ""]);
      setOptionsError(null);
      if (createdMessage) {
        queryClient.setQueryData<PlanMessagesPage>(messagesQueryKey(eventId), (old) => {
          const previous = old ?? { messages: [], nextCursor: null, locked: false };
          const withoutDuplicate = previous.messages.filter((message) => message.id !== createdMessage.id);
          return {
            ...previous,
            messages: [...withoutDuplicate, createdMessage],
          };
        });
        window.dispatchEvent(new CustomEvent("splanno:chat-message-created", {
          detail: {
            eventId,
            message: createdMessage,
          },
        }));
      } else {
        await queryClient.invalidateQueries({ queryKey: messagesQueryKey(eventId) });
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/polls"] }),
        queryClient.invalidateQueries({ queryKey: messagesQueryKey(eventId) }),
      ]);
      toastSuccess("Vote started");
    } catch (error) {
      toastError(error instanceof Error ? error.message : "Couldn’t start vote.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PanelShell>
      <PanelHeader
        label="Polls"
        title="Add vote"
        meta={(
          <span>
            {planQuery.data?.name ? `Start a new vote for ${planQuery.data.name}` : "Create a poll in the plan chat"}
          </span>
        )}
      />
      <div className="flex-1 overflow-y-auto px-5 py-5">
        <PanelSection title="New vote" variant="workflow" className="min-h-fit">
          <div className="space-y-3">
            <Input
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder="What should we vote on?"
              maxLength={240}
            />
            <div className="space-y-2">
              {optionFields.map((value, index) => (
                <div key={`poll-option-${index}`} className="flex items-center gap-2">
                  <Input
                    value={value}
                    onChange={(event) => updateOptionField(index, event.target.value)}
                    placeholder={`Option ${index + 1}`}
                    maxLength={120}
                  />
                  {optionFields.length > 2 ? (
                    <button
                      type="button"
                      onClick={() => removeOptionField(index)}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition hover:bg-neutral-100 hover:text-foreground"
                      aria-label={`Remove option ${index + 1}`}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  ) : null}
                </div>
              ))}
              {optionFields.length < 6 ? (
                <button
                  type="button"
                  onClick={addOptionField}
                  className="inline-flex text-sm text-muted-foreground transition hover:text-foreground"
                >
                  + Add option
                </button>
              ) : null}
              {optionsError ? (
                <p className="text-xs text-destructive">{optionsError}</p>
              ) : null}
            </div>
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">
                {parsedOptions.length} valid option{parsedOptions.length === 1 ? "" : "s"}.
              </p>
              <Button type="button" onClick={() => void handleCreatePoll()} disabled={submitting}>
                {submitting ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <BarChart3 className="mr-1.5 h-4 w-4" />}
                Start vote
              </Button>
            </div>
          </div>
        </PanelSection>
      </div>
    </PanelShell>
  );
}

export default AddPollPanel;
