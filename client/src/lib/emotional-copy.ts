export const EMPTY_COPY = {
  privateExpensesTitle: "No expenses yet",
  privateExpensesBody: "No expenses yet — someone always starts with snacks 🙂",
  privateNotesBody: "Drop links, ideas, or inside jokes here.",
  privatePeopleBody: "Invite your crew to get this plan moving.",
  privateListTitle: "No friends plans yet",
  privateListBody: "No plans yet. Start a small plan and make a big moment.",
  publicListDraftTitle: "No drafts yet",
  publicListDraftBody: "Create a public plan in minutes, then publish when you're ready.",
  publicListListedTitle: "No listed plans yet",
  publicListListedBody: "Publish a plan to make it discoverable on Explore.",
  recentEventsTitle: "No plans yet",
  recentEventsBody: "Start a plan with your friends and figure it out together.",
  exploreNoResultsTitle: "No plans match your search",
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
    newEvent: "New plan",
  },
  toasts: {
    copied: "Link copied",
    copiedManual: "Copy failed — select and copy manually.",
    genericError: "Something went wrong. Try again.",
  },
} as const;
