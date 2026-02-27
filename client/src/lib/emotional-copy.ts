export const EMPTY_COPY = {
  privateExpensesTitle: "No expenses yet",
  privateExpensesBody: "No expenses yet — someone always starts with snacks 🙂",
  privateNotesBody: "Drop links, ideas, or inside jokes here.",
  privatePeopleBody: "Invite your circle to get this plan moving.",
  privateListTitle: "No private events yet",
  privateListBody: "No plans yet. Start a small plan and make a big moment.",
  publicListDraftTitle: "No drafts yet",
  publicListDraftBody: "Create a public event in minutes, then publish when you're ready.",
  publicListListedTitle: "No listed events yet",
  publicListListedBody: "Publish an event to make it discoverable on Explore.",
  recentEventsTitle: "No events yet",
  recentEventsBody: "Create your first event and bring people together.",
  exploreNoResultsTitle: "No events match your search",
  exploreNoResultsBody: "Try another city, organizer, or date.",
  publicNoRsvp: "No RSVP yet — be the first to join.",
  publicNoDetails: "Details coming soon.",
  publicNoMessages: "No messages yet. Start the conversation.",
} as const;

export const UI_COPY = {
  actions: {
    addExpense: "Add expense",
    invite: "Invite",
    share: "Share",
    settings: "Settings",
    addToCalendar: "Add to Calendar",
    newEvent: "New event",
  },
  toasts: {
    copied: "Link copied",
    copiedManual: "Copy failed — select and copy manually.",
    genericError: "Something went wrong. Try again.",
  },
} as const;
