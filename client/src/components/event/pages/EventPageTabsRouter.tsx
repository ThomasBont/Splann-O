import type { ReactNode } from "react";
import { PrivateEventPage } from "@/components/event/pages/PrivateEventPage";
import { PublicEventPage } from "@/components/event/pages/PublicEventPage";

type EventPageTabsRouterProps = {
  isPublicEvent: boolean;
  activeTab: string;
  onTabChange: (next: string) => void;
  isCreator: boolean;
  showPrivateChatTab: boolean;
  labels: {
    expenses: string;
    people: string;
    split: string;
    notes: string;
    chat: string;
  };
  children: ReactNode;
};

export function EventPageTabsRouter({
  isPublicEvent,
  activeTab,
  onTabChange,
  isCreator,
  showPrivateChatTab,
  labels,
  children,
}: EventPageTabsRouterProps) {
  if (isPublicEvent) {
    return (
      <PublicEventPage activeTab={activeTab} onTabChange={onTabChange} showInboxTab={isCreator}>
        {children}
      </PublicEventPage>
    );
  }

  return (
    <PrivateEventPage
      activeTab={activeTab}
      onTabChange={onTabChange}
      showChatTab={showPrivateChatTab}
      labels={labels}
    >
      {children}
    </PrivateEventPage>
  );
}
