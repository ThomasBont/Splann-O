"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { usePublicBarbecues } from "@/hooks/use-bbq-data";
import { useMemberships } from "@/hooks/use-participants";
import { useLanguage } from "@/hooks/use-language";
import { Loader2 } from "lucide-react";
import type { Barbecue } from "@shared/schema";

const EVENT_TYPE_I18N_KEYS: Record<string, string> = {
  default: "otherParty",
  barbecue: "barbecue",
  birthday: "birthday",
  dinner_party: "dinnerNight",
  house_party: "houseParty",
  game_night: "gameNight",
  movie_night: "movieNight",
  pool_party: "poolParty",
  after_party: "afterParty",
  other_party: "otherParty",
  city_trip: "cityTrip",
  vacation: "vacation",
  road_trip: "roadTrip",
  backpacking: "backpacking",
  ski_trip: "skiTrip",
  festival_trip: "festivalTrip",
  bachelor_trip: "bachelorTrip",
  workation: "workation",
  cinema: "cinema",
  theme_park: "themePark",
  day_out: "dayOut",
  other_trip: "otherTrip",
};

export interface DiscoverModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  username: string | null;
  onSelectEvent: (bbq: Barbecue) => void;
  onJoin: (bbq: Barbecue) => void;
}

export function DiscoverModal({
  open,
  onOpenChange,
  username,
  onSelectEvent,
  onJoin,
}: DiscoverModalProps) {
  const { t } = useLanguage();
  const { data: publicEvents = [], isLoading } = usePublicBarbecues();
  const { data: memberships = [] } = useMemberships(username ?? "");

  const getMembershipStatus = (bbqId: number) => {
    const m = memberships.find((m) => m.bbqId === bbqId);
    return m ? { status: m.status, participantId: m.participantId } : null;
  };

  const getEventTypeLabel = (eventType: string) => {
    const key = EVENT_TYPE_I18N_KEYS[eventType] ?? "barbecue";
    return (t.eventTypes as Record<string, string>)[key] ?? eventType;
  };

  const formatDate = (date: string | Date) => {
    const d = typeof date === "string" ? new Date(date) : date;
    return d.toLocaleDateString(undefined, {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const handleView = (bbq: Barbecue) => {
    onSelectEvent(bbq);
    onOpenChange(false);
  };

  const handleJoinClick = (bbq: Barbecue) => {
    if (!username) return;
    onJoin(bbq);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{t.discover.title}</DialogTitle>
        </DialogHeader>
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : publicEvents.length === 0 ? (
          <p className="text-muted-foreground text-sm py-8 text-center">
            {t.discover.empty}
          </p>
        ) : (
          <ScrollArea className="flex-1 -mx-2 px-2 min-h-[200px] max-h-[60vh]">
            <ul className="space-y-2 pr-2">
              {publicEvents.map((bbq) => {
                const membership = getMembershipStatus(bbq.id);
                const isMember = !!membership;

                return (
                  <li
                    key={bbq.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => handleView(bbq)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        handleView(bbq);
                      }
                    }}
                    className="flex flex-col gap-1.5 p-3 rounded-lg border bg-card text-card-foreground hover:bg-muted/50 transition-colors cursor-pointer"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate">{bbq.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {getEventTypeLabel(bbq.eventType ?? "barbecue")} ·{" "}
                          {formatDate(bbq.date)}
                        </p>
                        {bbq.creatorId && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {t.discover.creator} {bbq.creatorId}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-1.5 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                        {isMember ? (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => handleView(bbq)}
                          >
                            {t.discover.view}
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            onClick={() => handleJoinClick(bbq)}
                            disabled={!username}
                            title={!username ? "Log in to join" : undefined}
                          >
                            {t.discover.join}
                          </Button>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}
