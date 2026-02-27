import type { ReactNode } from "react";
import { EventTabs, EventTabsList, EventTabsTrigger } from "@/components/event/EventTabs";

type PrivateEventPageProps = {
  activeTab: string;
  onTabChange: (next: string) => void;
  showChatTab: boolean;
  labels: {
    expenses: string;
    people: string;
    split: string;
    notes: string;
    chat: string;
  };
  children: ReactNode;
};

export function PrivateEventPage({
  activeTab,
  onTabChange,
  showChatTab,
  labels,
  children,
}: PrivateEventPageProps) {
  return (
    <EventTabs value={activeTab} onValueChange={onTabChange}>
      <EventTabsList>
        <EventTabsTrigger value="expenses" data-testid="tab-expenses">{labels.expenses}</EventTabsTrigger>
        <EventTabsTrigger value="people" data-testid="tab-people">{labels.people}</EventTabsTrigger>
        <EventTabsTrigger value="split" data-testid="tab-split">{labels.split}</EventTabsTrigger>
        <EventTabsTrigger value="notes" data-testid="tab-notes">{labels.notes}</EventTabsTrigger>
        {showChatTab && <EventTabsTrigger value="chat" data-testid="tab-chat">{labels.chat}</EventTabsTrigger>}
      </EventTabsList>
      {children}
    </EventTabs>
  );
}
