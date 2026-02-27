import type { ReactNode } from "react";
import { EventTabs, EventTabsList, EventTabsTrigger } from "@/components/event/EventTabs";

type PublicEventPageProps = {
  activeTab: string;
  onTabChange: (next: string) => void;
  showInboxTab: boolean;
  children: ReactNode;
};

export function PublicEventPage({
  activeTab,
  onTabChange,
  showInboxTab,
  children,
}: PublicEventPageProps) {
  return (
    <EventTabs value={activeTab} onValueChange={onTabChange}>
      <EventTabsList>
        <EventTabsTrigger value="overview" data-testid="tab-overview">Overview</EventTabsTrigger>
        <EventTabsTrigger value="attendees" data-testid="tab-attendees">Attendees</EventTabsTrigger>
        {showInboxTab && <EventTabsTrigger value="inbox" data-testid="tab-inbox">Inbox</EventTabsTrigger>}
        <EventTabsTrigger value="content" data-testid="tab-content">Content</EventTabsTrigger>
      </EventTabsList>
      {children}
    </EventTabs>
  );
}
