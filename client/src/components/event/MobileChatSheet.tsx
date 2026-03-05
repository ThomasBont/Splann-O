import { useRef } from "react";
import { Sheet, SheetClose, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ChatSidebar } from "@/components/event/ChatSidebar";
import { X } from "lucide-react";

type MobileChatSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: number | null;
  eventName?: string | null;
  location?: string | null;
  dateTime?: Date | string | null;
  participantCount?: number;
  sharedTotal?: number;
  currency?: string;
  onSummaryClick?: () => void;
  currentUser?: { id?: number | null; username?: string | null; avatarUrl?: string | null } | null;
  enabled?: boolean;
};

export function MobileChatSheet({
  open,
  onOpenChange,
  eventId,
  eventName,
  location = null,
  dateTime = null,
  participantCount = 0,
  sharedTotal = 0,
  currency = "EUR",
  onSummaryClick,
  currentUser,
  enabled = true,
}: MobileChatSheetProps) {
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="md:hidden h-[85vh] rounded-t-2xl border-x border-t border-border bg-background p-0 [&>button.absolute]:hidden"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          closeButtonRef.current?.focus();
        }}
      >
        <SheetHeader className="border-b border-border/60 px-4 py-3 text-left">
          <div className="flex items-center justify-between gap-2">
            <SheetTitle className="text-base">Plan chat</SheetTitle>
            <SheetClose asChild>
              <Button
                ref={closeButtonRef}
                type="button"
                variant="ghost"
                size="icon"
                className="h-10 w-10 rounded-full"
                aria-label="Close chat"
              >
                <X className="h-4 w-4" />
              </Button>
            </SheetClose>
          </div>
        </SheetHeader>
        <div className="h-[calc(85vh-57px)] min-h-0">
          <ChatSidebar
            eventId={eventId}
            eventName={eventName}
            location={location}
            dateTime={dateTime}
            participantCount={participantCount}
            sharedTotal={sharedTotal}
            currency={currency}
            onSummaryClick={onSummaryClick}
            currentUser={currentUser}
            enabled={enabled}
            className="h-full min-h-0 rounded-none border-0 bg-transparent"
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default MobileChatSheet;
