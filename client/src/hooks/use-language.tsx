/**
 * Language strategy:
 * - Production: English and Spanish only (keeps the UI simple).
 * - Italian and Dutch are supported but hidden from the language switcher.
 * - To enable all languages in development, set:
 *   VITE_ENABLE_ALL_LANGUAGES=true
 * This supports future expansion while limiting options in production.
 */
import { createContext, useContext, useState, ReactNode } from "react";

export type Language = "en" | "es" | "it" | "nl";

/** Currency code (ISO 4217). Use string for any code; legacy union kept for compat. */
export type CurrencyCode = string;

export { getCurrency, getCurrencyLabel, getCurrencyLabelShort, getCurrencySymbol, CoreCurrencies, AllCurrencies } from "@/lib/currencies";
import { CoreCurrencies } from "@/lib/currencies";

/** Legacy compatibility. Use CoreCurrencies from @/lib/currencies for full list. */
export const CURRENCIES = CoreCurrencies;

export const LANGUAGES: { code: Language; label: string }[] = [
  { code: "en", label: "EN" },
  { code: "es", label: "ES" },
  { code: "it", label: "IT" },
  { code: "nl", label: "NL" },
];

/**
 * Languages currently selectable in the UI.
 * Default: en, es only. In dev, set VITE_ENABLE_ALL_LANGUAGES=true to allow all.
 */
export const ENABLED_LANGUAGES: readonly Language[] =
  import.meta.env.DEV && import.meta.env.VITE_ENABLE_ALL_LANGUAGES === "true"
    ? (["en", "es", "it", "nl"] as const)
    : (["en", "es"] as const);

/** Languages shown in the language switcher. Other languages remain in translations but are hidden. */
export const SELECTABLE_LANGUAGES = LANGUAGES.filter((l) =>
  (ENABLED_LANGUAGES as readonly string[]).includes(l.code)
);

/** Approximate rates to EUR. Unknown codes fall back to 1. */
export const EUR_RATES: Record<string, number> = {
  EUR: 1,
  USD: 1.08,
  ARS: 1050,
  GBP: 0.85,
  MXN: 18.0,
  CHF: 0.95,
  JPY: 165,
  CAD: 1.47,
  AUD: 1.65,
  CNY: 7.8,
  BRL: 5.4,
  INR: 90,
  KRW: 1450,
  SEK: 11.3,
  NOK: 11.5,
  DKK: 7.45,
};

export function convertCurrency(amount: number, from: CurrencyCode, to: CurrencyCode): number {
  const fromRate = EUR_RATES[from] ?? 1;
  const toRate = EUR_RATES[to] ?? 1;
  const inEUR = amount / fromRate;
  return inEUR * toRate;
}

interface Translations {
  title: string;
  subtitle: string;
  addPerson: string;
  addExpense: string;
  totalSpent: string;
  participants: string;
  expenses: string;
  fairShare: string;
  tabs: {
    expenses: string;
    people: string;
    split: string;
    notes: string;
    chat: string;
  };
  activity: {
    recentActivity: string;
    chatComingSoon: string;
    chatSubtitle: string;
    enableChat: string;
    soon: string;
  };
  emptyState: {
    title: string;
    subtitle: string;
  };
  categories: {
    Meat: string;
    Bread: string;
    Drinks: string;
    Charcoal: string;
    Transportation: string;
    Other: string;
    Food: string;
    Transport: string;
    Tickets: string;
    Accommodation: string;
    Activities: string;
    Groceries: string;
    Snacks: string;
    Supplies: string;
    Parking: string;
    Tips: string;
    Entertainment: string;
  };
  placeholders: {
    meat: string;
    bread: string;
    drinks: string;
    charcoal: string;
    transport: string;
    food: string;
    tickets: string;
    accommodation: string;
    activities: string;
    groceries: string;
    snacks: string;
    supplies: string;
    parking: string;
    tips: string;
    entertainment: string;
    other: string;
    transportCity: string;
    accommodationCity: string;
    foodCity: string;
    foodDinner: string;
    foodMovie: string;
    streaming: string;
    decor: string;
    transportRoad: string;
    ticketsCity: string;
    ticketsFestival: string;
  };
  modals: {
    addPersonTitle: string;
    addExpenseTitle: string;
    editExpenseTitle: string;
    nameLabel: string;
    paidByLabel: string;
    categoryLabel: string;
    itemLabel: string;
    amountLabel: string;
    cancel: string;
    add: string;
    save: string;
    createCustomCategory: string;
    expenseAdded: string;
    expenseUpdated: string;
    expenseAddFailed: string;
    profileSaved: string;
    linkCopied: string;
    addNoteTitle: string;
    editNoteTitle: string;
    noteTitlePlaceholder: string;
    noteBodyPlaceholder: string;
    noteBodyRequired: string;
    pinNote: string;
    noteAdded: string;
    noteUpdated: string;
    noteDeleted: string;
  };
  notes: {
    pinnedNote: string;
    emptyTitle: string;
    emptySubtitle: string;
    addNoteCta: string;
    justNow: string;
    minutesAgo: string;
    hoursAgo: string;
    daysAgo: string;
    by: string;
    deleteConfirm: string;
  };
  split: {
    contributions: string;
    settlement: string;
    owes: string;
    allSettled: string;
    allSettledStillFriends: string;
    overpaid: string;
    underpaid: string;
    shareImage: string;
    copyImage: string;
    download: string;
    shareSummary: string;
    share: string;
    shareWhatsApp: string;
    shareMore: string;
    downloadPng: string;
    copyImageUnsupported: string;
    copyShareLink: string;
    toastDownloaded: string;
    toastShared: string;
    toastError: string;
  };
  settleUp: {
    cta: string;
    ctaShort: string;
    modalTitle: string;
    modalBody1: string;
    modalBody2: string;
    modalBody3: string;
    cancel: string;
    sendSummary: string;
    toastSuccess: string;
    statusSettling: string;
    statusSettled: string;
    statusActive: string;
    statusDraft: string;
    participantBanner: string;
    tapToSettle: string;
    updatedAfterSummary: string;
    markAsSettled: string;
    markAsSettledButton: string;
    everyonePaid: string;
  };
  bbq: {
    allBarbecues: string;
    newBarbecue: string;
    bbqName: string;
    date: string;
    currency: string;
    create: string;
    delete: string;
    selectBbq: string;
    noBbqs: string;
    noBbqsSubtitle: string;
    breakdown: string;
    hostedBy: string;
    you: string;
    visibility: string;
    publicEvent: string;
    privateEvent: string;
    publicDesc: string;
    privateDesc: string;
    inviteUser: string;
    inviteUsernamePlaceholder: string;
    invite: string;
    inviteSent: string;
    alreadyMember: string;
    invited: string;
    acceptInvite: string;
    declineInvite: string;
    pendingInvites: string;
    inviteLink: string;
    copy: string;
    copySuccess: string;
    share: string;
    currencyConversion: string;
    approxRates: string;
    yourShare: string;
    allowOptInExpenses: string;
    allowOptInExpensesDesc: string;
    advancedOptions: string;
    flexibleSplit: string;
    flexibleSplitDesc: string;
    eventBasics: string;
    splitBehavior: string;
    privacy: string;
    imIn: string;
    imOut: string;
    optInExpenseLabel: string;
    optInExpenseHintOn: string;
    optInExpenseHintOff: string;
    optInChipTooltip: string;
  };
  auth: {
    login: string;
    register: string;
    logout: string;
    username: string;
    email: string;
    displayName: string;
    displayNamePlaceholder: string;
    password: string;
    confirmPassword: string;
    loginTitle: string;
    registerTitle: string;
    welcomeBack: string;
    createAccount: string;
    alreadyHaveAccount: string;
    dontHaveAccount: string;
    usernameTaken: string;
    emailTaken: string;
    invalidCredentials: string;
    passwordsNoMatch: string;
    loggedInAs: string;
    profile: string;
    bio: string;
    profilePictureUrl: string;
    editProfile: string;
    usernameHint: string;
    passwordHint: string;
    forgotPassword: string;
    forgotPasswordTitle: string;
    forgotPasswordSubtitle: string;
    sendResetLink: string;
    checkEmail: string;
    checkEmailDesc: string;
    emailNotSentHint: string;
    welcomeEmailNotSent: string;
    newPassword: string;
    resetPasswordBtn: string;
    passwordResetSuccess: string;
    backToLogin: string;
    tokenInvalid: string;
  };
  user: {
    setupTitle: string;
    setupSubtitle: string;
    usernamePlaceholder: string;
    confirm: string;
    joinBbq: string;
    pending: string;
    joined: string;
    pendingRequests: string;
    accept: string;
    reject: string;
    leave: string;
    hi: string;
    changeUsername: string;
    editNameInBbq: string;
    host: string;
    deleteAccount: string;
    deleteAccountConfirm: string;
    typeUsernameToConfirm: string;
    cannotBeUndone: string;
    preferredCurrencies: string;
  };
  friends: {
    title: string;
    addFriend: string;
    searchPlaceholder: string;
    sendRequest: string;
    requestSent: string;
    friendRequests: string;
    noFriends: string;
    noRequests: string;
    removeFriend: string;
    alreadyFriends: string;
    userNotFound: string;
    cannotFriendSelf: string;
    friendshipExists: string;
    profile: string;
    inviteFromFriends: string;
  };
  notifications: {
    joinRequest: string;
    wantsToJoin: string;
    newFriendRequest: string;
    fromUser: string;
  };
  landing: {
    heading: string;
    subheading: string;
    basicTitle: string;
    basicDesc: string;
    fullTitle: string;
    fullDesc: string;
    tryBasic: string;
    logInFull: string;
    heroTitle: string;
    heroSubtitle: string;
    ctaStartFree: string;
    ctaTryDemo: string;
    socialProofTagline: string;
    eventsSplit: string;
    sharedCosts: string;
    countries: string;
    useCasesTitle: string;
    useCaseTrips: string;
    useCaseTripsDesc: string;
    useCaseParties: string;
    useCasePartiesDesc: string;
    useCaseFestivals: string;
    useCaseFestivalsDesc: string;
    useCaseRoommates: string;
    useCaseRoommatesDesc: string;
    featuresTitle: string;
    featureSmartSplit: string;
    featureSmartSplitDesc: string;
    featureOptIn: string;
    featureOptInDesc: string;
    featureThemes: string;
    featureThemesDesc: string;
    featureMultiCurrency: string;
    featureMultiCurrencyDesc: string;
    viralTitle: string;
    viralCopy: string;
    viralMicroCopy: string;
    viralCta: string;
    trustNoAds: string;
    trustNoTracking: string;
    trustFairSplits: string;
    faqFreeQ: string;
    faqFreeA: string;
    faqAccountsQ: string;
    faqAccountsA: string;
    faqCurrenciesQ: string;
    faqCurrenciesA: string;
    footerTagline: string;
    footerProduct: string;
    footerFeatures: string;
    footerAbout: string;
    footerLogin: string;
    footerTryDemo: string;
    footerDescription: string;
    shareHook: string;
  };
  welcome: {
    title: string;
    description: string;
    getStarted: string;
  };
  basic: {
    backToLanding: string;
    pageTitle: string;
    adPlaceholder: string;
    demoBadge: string;
    whosIn: string;
    whoPaidWhat: string;
    whoOwesWho: string;
    tryAnotherScenario: string;
    shareThisSplit: string;
    shareSummary: string;
    allSettledStillFriends: string;
    readyToUseCta: string;
    continueWithout: string;
    unlockFull: string;
    availableInFull: string;
    scenarioBarcelona: string;
    scenarioBBQ: string;
    scenarioSki: string;
    scenarioBirthday: string;
    scenarioRoadtrip: string;
    lockedTrips: string;
    lockedFriends: string;
    lockedThemes: string;
    lockedHistory: string;
  };
  nav: {
    parties: string;
    trips: string;
  };
  events: {
    event: string;
    newEvent: string;
    noEventsYet: string;
    noEventsSubtitle: string;
    selectEvent: string;
  };
  eventTypes: {
    barbecue: string;
    dinnerParty: string;
    dinnerNight: string;
    birthday: string;
    houseParty: string;
    gameNight: string;
    movieNight: string;
    poolParty: string;
    afterParty: string;
    otherParty: string;
    cityTrip: string;
    roadTrip: string;
    beachTrip: string;
    skiTrip: string;
    festivalTrip: string;
    hikingTrip: string;
    camping: string;
    weekendGetaway: string;
    businessTrip: string;
    otherTrip: string;
    vacation: string;
    backpacking: string;
    bachelorTrip: string;
    workation: string;
    cinema: string;
    themePark: string;
    dayOut: string;
  };
  discover: {
    title: string;
    empty: string;
    creator: string;
    view: string;
    join: string;
  };
  profileStats: {
    events: string;
    friends: string;
    totalSpent: string;
  };
  profileTabs: {
    profile: string;
    friends: string;
    activity: string;
    settings: string;
  };
  profileActivity: {
    comingSoon: string;
  };
  tripsComingSoon: string;
}

const translations: Record<Language, Translations> = {
  en: {
    title: "Splanno",
    subtitle: "Split costs, stay friends",
    addPerson: "Add Person",
    addExpense: "Add Expense",
    totalSpent: "Total Spent",
    participants: "Participants",
    expenses: "Expenses",
    fairShare: "Fair Share",
    tabs: { expenses: "Expenses", people: "People", split: "Split Check", notes: "Notes", chat: "Chat" },
    activity: {
      recentActivity: "Recent activity",
      chatComingSoon: "Chat is coming soon",
      chatSubtitle: "We're building a lightweight group chat for each event.",
      enableChat: "Enable chat",
      soon: "Soon",
    },
    emptyState: {
      title: "Create an event",
      subtitle: "Add participants and log expenses to split costs.",
    },
    categories: {
      Meat: "Meat", Bread: "Bread", Drinks: "Drinks",
      Charcoal: "Charcoal", Transportation: "Transportation", Other: "Other",
      Food: "Food", Transport: "Transport", Tickets: "Tickets", Accommodation: "Accommodation",
      Activities: "Activities", Groceries: "Groceries", Snacks: "Snacks", Supplies: "Supplies",
      Parking: "Parking", Tips: "Tips", Entertainment: "Entertainment",
    },
    placeholders: {
      meat: "e.g. Ribeye steaks, chorizo, sausages",
      bread: "e.g. Baguette, ciabatta, rolls",
      drinks: "e.g. Beer, wine, cocktails, soft drinks",
      charcoal: "e.g. Charcoal, firelighters, wood",
      transport: "e.g. Uber, fuel, metro tickets, parking",
      food: "e.g. Restaurant, takeaway, groceries",
      tickets: "e.g. Museum, concert, entry pass",
      accommodation: "e.g. Hotel, Airbnb, camping",
      activities: "e.g. Tour, workshop, activity",
      groceries: "e.g. Supermarket run, staples",
      snacks: "e.g. Chips, nuts, cookies",
      supplies: "e.g. Plates, napkins, utensils",
      parking: "e.g. Parking meter, garage",
      tips: "e.g. Waiter, driver, guide",
      entertainment: "e.g. Cinema, bowling, games",
      other: "e.g. Miscellaneous",
      transportCity: "e.g. Uber, Metro tickets",
      accommodationCity: "e.g. Airbnb, Hotel night",
      foodCity: "e.g. Tapas night, Restaurant",
      foodDinner: "e.g. Tapas night, Ribeye steaks",
      foodMovie: "e.g. Popcorn, Snacks",
      streaming: "e.g. Netflix rental, Movie ticket",
      decor: "e.g. Balloons, Candles",
      transportRoad: "e.g. Fuel, Toll, Parking",
      ticketsCity: "e.g. Museum entry, Attraction pass",
      ticketsFestival: "e.g. Festival pass, Day ticket",
    },
    modals: {
      addPersonTitle: "Add Participant", addExpenseTitle: "Record Expense",
      editExpenseTitle: "Edit Expense", nameLabel: "Name", paidByLabel: "Paid By",
      categoryLabel: "Category", itemLabel: "Item Description", amountLabel: "Amount",
      cancel: "Cancel", add: "Add", save: "Save Changes",
      createCustomCategory: "+ Create custom category…",
      expenseAdded: "Expense added", expenseUpdated: "Expense updated", expenseAddFailed: "Couldn't add expense", profileSaved: "Profile saved", linkCopied: "Link copied",
      addNoteTitle: "Add Note", editNoteTitle: "Edit Note", noteTitlePlaceholder: "Title (optional)", noteBodyPlaceholder: "Write your note…",
      noteBodyRequired: "Note body is required", pinNote: "Pin to top", noteAdded: "Note added", noteUpdated: "Note updated", noteDeleted: "Note deleted",
    },
    notes: {
      pinnedNote: "Pinned note", emptyTitle: "No notes yet", emptySubtitle: "Add reminders, ideas, or shared info for your event.",
      addNoteCta: "Add note", justNow: "Just now", minutesAgo: "{{n}} min ago", hoursAgo: "{{n}} hr ago", daysAgo: "{{n}} days ago", by: "by",
      deleteConfirm: "Delete this note?",
    },
    split: {
      contributions: "Individual Contributions", settlement: "Settlement Plan",
      owes: "owes", allSettled: "All settled up!", allSettledStillFriends: "All settled. Friendship intact 🎉", overpaid: "Overpaid", underpaid: "Underpaid",
      shareImage: "Share image", copyImage: "Copy image", download: "Download", shareSummary: "Share summary",
      share: "Share", shareWhatsApp: "WhatsApp", shareMore: "More…", downloadPng: "Download PNG",
      copyImageUnsupported: "Not supported in this browser, use Download.", copyShareLink: "Copy share link",
      toastDownloaded: "Downloaded!", toastShared: "Shared!", toastError: "Something went wrong",
    },
    settleUp: {
      cta: "Ready to settle?",
      ctaShort: "Settle up",
      modalTitle: "Ready to settle up?",
      modalBody1: "Freeze totals",
      modalBody2: "Notify everyone",
      modalBody3: "Let people pay you back",
      cancel: "Cancel",
      sendSummary: "Send summary",
      toastSuccess: "Summary sent. Time to settle",
      statusSettling: "Settling up",
      statusSettled: "All settled",
      statusActive: "Active",
      statusDraft: "Draft",
      participantBanner: "finalized the trip",
      tapToSettle: "You owe",
      updatedAfterSummary: "Updated after summary sent",
      markAsSettled: "Everyone paid? Mark event as settled",
      markAsSettledButton: "Mark as settled",
      everyonePaid: "Everyone paid?",
    },
    bbq: {
      allBarbecues: "Barbecues", newBarbecue: "New Barbecue", bbqName: "Event name",
      date: "Date", currency: "Currency", create: "Create", delete: "Delete",
      selectBbq: "Select or create an event to get started", noBbqs: "No events yet",
      noBbqsSubtitle: "Create your first event to start tracking expenses.",
      breakdown: "Breakdown", hostedBy: "Hosted by", you: "you",
      visibility: "Visibility", publicEvent: "Public", privateEvent: "Private",
      publicDesc: "Anyone can see and request to join",
      privateDesc: "Only invited people can see this event",
      inviteUser: "Invite People", inviteUsernamePlaceholder: "Username to invite",
      invite: "Invite", inviteSent: "Invite sent!", alreadyMember: "Already a member",
      invited: "Invited", acceptInvite: "Accept", declineInvite: "Decline",
      pendingInvites: "Pending Invites",
      inviteLink: "Invite link", copy: "Copy", copySuccess: "Copied!", share: "Share",
      currencyConversion: "In Other Currencies", approxRates: "Approximate rates",
      yourShare: "Your share",
      allowOptInExpenses: "Allow participants to choose which expenses they pay for",
      allowOptInExpensesDesc: "Participants can opt in or out per expense (e.g. skip meat or transport).",
      advancedOptions: "Advanced options",
      flexibleSplit: "Flexible split",
      flexibleSplitDesc: "Participants can choose which expenses they join",
      eventBasics: "Event basics",
      splitBehavior: "Split behavior",
      privacy: "Privacy",
      imIn: "I'm in",
      imOut: "I'm out",
      optInExpenseLabel: "Participants opt in",
      optInExpenseHintOn: "Only those who join pay",
      optInExpenseHintOff: "Shared among everyone",
      optInChipTooltip: "Participants can opt in/out for this expense.",
    },
    auth: {
      login: "Log In", register: "Sign Up", logout: "Log Out",
      username: "Username", email: "Email address", displayName: "Your name",
      displayNamePlaceholder: "e.g. Carlos (optional)",
      password: "Password", confirmPassword: "Confirm Password",
      loginTitle: "Welcome back", registerTitle: "Create account",
      welcomeBack: "Sign in to continue", createAccount: "Get started",
      alreadyHaveAccount: "Already have an account?", dontHaveAccount: "Don't have an account?",
      usernameTaken: "That username is already taken",
      emailTaken: "An account with that email already exists",
      invalidCredentials: "Invalid username or password",
      passwordsNoMatch: "Passwords do not match",
      loggedInAs: "Signed in as", profile: "Profile",
      bio: "Bio", profilePictureUrl: "Profile picture URL", editProfile: "Edit profile",
      usernameHint: "2–30 characters, letters/numbers/_/-",
      passwordHint: "At least 8 characters",
      forgotPassword: "Forgot password?",
      forgotPasswordTitle: "Reset your password",
      forgotPasswordSubtitle: "Enter your email and we'll send you a reset link",
      sendResetLink: "Send reset link",
      checkEmail: "Check your email",
      checkEmailDesc: "We've sent a password reset link to your email address.",
      emailNotSentHint: "We couldn't send the email right now. Check your address or try again later.",
      welcomeEmailNotSent: "We couldn't send the welcome email. Your account was created — you can log in.",
      newPassword: "New password",
      resetPasswordBtn: "Reset password",
      passwordResetSuccess: "Password reset! You can now log in.",
      backToLogin: "Back to login",
      tokenInvalid: "This reset link is invalid or has expired.",
    },
    user: {
      setupTitle: "Welcome! Pick a username", setupSubtitle: "Your name identifies you in shared events.",
      usernamePlaceholder: "e.g. Carlos", confirm: "Let's Go!",
      joinBbq: "Join", pending: "Pending", joined: "Joined",
      pendingRequests: "Join Requests", accept: "Accept", reject: "Reject",
      leave: "Leave", hi: "Hi", changeUsername: "Change name", editNameInBbq: "Edit name", host: "Host",
      deleteAccount: "Delete account", deleteAccountConfirm: "Permanently delete your account",
      typeUsernameToConfirm: "Type your username to confirm", cannotBeUndone: "This cannot be undone.",
      preferredCurrencies: "Currencies to show",
    },
    friends: {
      title: "Friends",
      addFriend: "Add Friend",
      searchPlaceholder: "Search by username...",
      sendRequest: "Send Request",
      requestSent: "Request Sent",
      friendRequests: "Friend Requests",
      noFriends: "No friends yet",
      noRequests: "No pending requests",
      removeFriend: "Remove Friend",
      alreadyFriends: "Already friends",
      userNotFound: "User not found",
      cannotFriendSelf: "You can't add yourself",
      friendshipExists: "Request already exists",
      profile: "Profile",
      inviteFromFriends: "Invite from friends",
    },
    notifications: {
      joinRequest: "Join Request",
      wantsToJoin: "wants to join",
      newFriendRequest: "New friend request",
      fromUser: "from",
    },
    landing: {
      heading: "Split costs, stay friends",
      subheading: "Choose how you want to use the app",
      basicTitle: "Basic (no account)",
      basicDesc: "Simple expense split. No sign-up. Try it now.",
      fullTitle: "Full version",
      fullDesc: "Parties, trips, events. Save and share with friends.",
      tryBasic: "Try without account",
      logInFull: "Log in for full features",
      heroTitle: "Split costs. Stay friends.",
      heroSubtitle: "The easiest way to split trips, parties, and shared moments.",
      ctaStartFree: "Start free",
      ctaTryDemo: "Try demo",
      socialProofTagline: "Loved by friends worldwide",
      eventsSplit: "1,200+",
      sharedCosts: "€85k+",
      countries: "40+",
      useCasesTitle: "Built for how you split",
      useCaseTrips: "Trips",
      useCaseTripsDesc: "Split hotels, food, and transport without the awkward math.",
      useCaseParties: "Parties",
      useCasePartiesDesc: "Birthday, BBQ, or dinner party — track who paid for what, fair and simple.",
      useCaseFestivals: "Festivals",
      useCaseFestivalsDesc: "Shared tents, tickets, and drinks. One link, everyone's in.",
      useCaseRoommates: "Roommates",
      useCaseRoommatesDesc: "Rent, utilities, groceries. No more IOU spreadsheets.",
      featuresTitle: "Smart splitting, simple setup",
      featureSmartSplit: "Smart splitting",
      featureSmartSplitDesc: "Automatic settlement plans. See who owes whom in one tap.",
      featureOptIn: "Opt-in expenses",
      featureOptInDesc: "Split only what you share. Skip the steak if you're vegetarian.",
      featureThemes: "Event themes",
      featureThemesDesc: "Trips, parties, festivals — templates that fit the occasion.",
      featureMultiCurrency: "Multi-currency",
      featureMultiCurrencyDesc: "EUR, USD, GBP and more. Approximate conversions built in.",
      viralTitle: "Built for groups, not spreadsheets",
      viralCopy: "Inviting friends creates instant value. One link, everyone's in.",
      viralMicroCopy: "Send one link. Everyone's in.",
      viralCta: "Create your first event",
      trustNoAds: "No ads",
      trustNoTracking: "No tracking",
      trustFairSplits: "Just fair splits",
      faqFreeQ: "Is it free?",
      faqFreeA: "Yes. Splanno is free to use. Create events, add expenses, and split costs with friends — no hidden fees.",
      faqAccountsQ: "Do friends need accounts?",
      faqAccountsA: "For the demo, no. For the full app, friends can join with a quick sign-up to save their events and split history.",
      faqCurrenciesQ: "Can I use multiple currencies?",
      faqCurrenciesA: "Yes. Each event has a base currency, and we support EUR, USD, GBP, ARS, MXN with approximate conversion rates.",
      footerTagline: "Split costs, stay friends.",
      footerProduct: "Product",
      footerFeatures: "Features",
      footerAbout: "About",
      footerLogin: "Log in",
      footerTryDemo: "Try demo",
      footerDescription: "The easiest way to split trips, parties, and shared moments.",
      shareHook: "See how Splanno looks with friends",
    },
    welcome: {
      title: "Welcome, {name}!",
      description: "Create parties and trips, add events, invite friends, and split expenses in a snap.",
      getStarted: "Get Started",
    },
    basic: {
      backToLanding: "Back",
      pageTitle: "Basic split",
      adPlaceholder: "Advertisement",
      demoBadge: "Demo mode — nothing is saved",
      whosIn: "Who's in?",
      whoPaidWhat: "Who paid what?",
      whoOwesWho: "Who owes who?",
      tryAnotherScenario: "Try another scenario",
      shareThisSplit: "Share this split",
      shareSummary: "Share summary",
      allSettledStillFriends: "All settled. Friendship intact 🎉",
      readyToUseCta: "Ready to use this with real friends?",
      continueWithout: "Continue without account",
      unlockFull: "Unlock full version",
      availableInFull: "Available in the full version",
      scenarioBarcelona: "Weekend Barcelona",
      scenarioBBQ: "BBQ Night",
      scenarioSki: "Ski Trip",
      scenarioBirthday: "Birthday Party",
      scenarioRoadtrip: "Roadtrip Europe",
      lockedTrips: "Trips",
      lockedFriends: "Friends",
      lockedThemes: "Smart themes",
      lockedHistory: "History",
    },
    nav: {
      parties: "Parties",
      trips: "Trips",
    },
    events: {
      event: "Event",
      newEvent: "New event",
      noEventsYet: "No events yet",
      noEventsSubtitle: "Create your first event to start tracking expenses.",
      selectEvent: "Select or create an event to get started",
    },
    eventTypes: {
      barbecue: "Barbecue",
      dinnerParty: "Dinner party",
      dinnerNight: "Dinner Night",
      birthday: "Birthday",
      houseParty: "House Party",
      gameNight: "Game Night",
      movieNight: "Movie Night",
      poolParty: "Pool Party",
      afterParty: "Afterparty",
      otherParty: "Other",
      cityTrip: "City trip",
      roadTrip: "Road trip",
      beachTrip: "Beach trip",
      skiTrip: "Ski trip",
      festivalTrip: "Festival trip",
      hikingTrip: "Hiking trip",
      camping: "Camping",
      weekendGetaway: "Weekend Getaway",
      businessTrip: "Business trip",
      otherTrip: "Other",
      vacation: "Vacation",
      backpacking: "Backpacking",
      bachelorTrip: "Bachelor trip",
      workation: "Workation",
      cinema: "Cinema",
      themePark: "Theme park",
      dayOut: "Day out",
    },
    discover: {
      title: "Discover",
      empty: "No public events yet.",
      creator: "by",
      view: "View",
      join: "Join",
    },
    profileStats: { events: "Events", friends: "Friends", totalSpent: "Total spent" },
    profileTabs: { profile: "Profile", friends: "Friends", activity: "Activity", settings: "Settings" },
    profileActivity: { comingSoon: "Activity coming soon." },
    tripsComingSoon: "Trips coming soon. Create events under Parties for now.",
  },
  es: {
    title: "Splanno",
    subtitle: "Cuentas claras, conservan la amistad!",
    addPerson: "Agregar Persona",
    addExpense: "Agregar Gasto",
    totalSpent: "Total Gastado",
    participants: "Participantes",
    expenses: "Gastos",
    fairShare: "Cuota Justa",
    tabs: { expenses: "Gastos", people: "Personas", split: "Dividir Cuenta", notes: "Notas", chat: "Chat" },
    activity: {
      recentActivity: "Actividad reciente",
      chatComingSoon: "El chat llegará pronto",
      chatSubtitle: "Estamos construyendo un chat grupal ligero para cada evento.",
      enableChat: "Activar chat",
      soon: "Pronto",
    },
    emptyState: {
      title: "Crear un evento",
      subtitle: "Agregá participantes y cargá gastos para repartir costos.",
    },
    categories: {
      Meat: "Carne", Bread: "Pan", Drinks: "Bebidas",
      Charcoal: "Carbón", Transportation: "Transporte", Other: "Otros",
      Food: "Comida", Transport: "Transporte", Tickets: "Entradas", Accommodation: "Alojamiento",
      Activities: "Actividades", Groceries: "Compras", Snacks: "Snacks", Supplies: "Insumos",
      Parking: "Estacionamiento", Tips: "Propinas", Entertainment: "Entretenimiento",
    },
    placeholders: {
      meat: "ej. Chorizo, costilla, achuras",
      bread: "ej. Pan, facturas, criollos",
      drinks: "ej. Cerveza, vino, gaseosas",
      charcoal: "ej. Carbón, encendedor, leña",
      transport: "ej. Uber, nafta, subte, estacionamiento",
      food: "ej. Restaurante, delivery, supermercado",
      tickets: "ej. Museo, recital, entrada",
      accommodation: "ej. Hotel, Airbnb, camping",
      activities: "ej. Paseo, taller, actividad",
      groceries: "ej. Supermercado, almacén",
      snacks: "ej. Papas, galletas, frutos secos",
      supplies: "ej. Platos, servilletas, cubiertos",
      parking: "ej. Playa, garage",
      tips: "ej. Mozo, chofer, guía",
      entertainment: "ej. Cine, bolos, juegos",
      other: "ej. Varios",
      transportCity: "ej. Uber, Metro",
      accommodationCity: "ej. Airbnb, Hotel",
      foodCity: "ej. Tapas, Restaurante",
      foodDinner: "ej. Tapas, Bife",
      foodMovie: "ej. Palomitas, Snacks",
      streaming: "ej. Netflix, Entrada cine",
      decor: "ej. Globos, Velas",
      transportRoad: "ej. Nafta, Peaje, Estacionamiento",
      ticketsCity: "ej. Museo, Atracción",
      ticketsFestival: "ej. Pase festival, Día",
    },
    modals: {
      addPersonTitle: "Agregar Participante", addExpenseTitle: "Registrar Gasto",
      editExpenseTitle: "Editar Gasto", nameLabel: "Nombre", paidByLabel: "Pagado Por",
      categoryLabel: "Categoría", itemLabel: "Descripción del Ítem", amountLabel: "Monto",
      cancel: "Cancelar", add: "Agregar", save: "Guardar Cambios",
      createCustomCategory: "+ Crear categoría personalizada…",
      expenseAdded: "Gasto agregado", expenseUpdated: "Gasto actualizado", expenseAddFailed: "No se pudo agregar el gasto", profileSaved: "Perfil guardado", linkCopied: "Enlace copiado",
      addNoteTitle: "Agregar Nota", editNoteTitle: "Editar Nota", noteTitlePlaceholder: "Título (opcional)", noteBodyPlaceholder: "Escribe tu nota…",
      noteBodyRequired: "El contenido es obligatorio", pinNote: "Fijar arriba", noteAdded: "Nota agregada", noteUpdated: "Nota actualizada", noteDeleted: "Nota eliminada",
    },
    notes: {
      pinnedNote: "Nota fijada", emptyTitle: "Sin notas aún", emptySubtitle: "Agrega recordatorios, ideas o información compartida.",
      addNoteCta: "Agregar nota", justNow: "Ahora mismo", minutesAgo: "Hace {{n}} min", hoursAgo: "Hace {{n}} h", daysAgo: "Hace {{n}} días", by: "por",
      deleteConfirm: "¿Eliminar esta nota?",
    },
    split: {
      contributions: "Contribuciones Individuales", settlement: "Plan de Pagos",
      owes: "le debe a", allSettled: "¡Todo saldado!", allSettledStillFriends: "Todo saldado. Amistad preservada.", overpaid: "Pagó de más", underpaid: "Debe",
      shareImage: "Compartir imagen", copyImage: "Copiar imagen", download: "Descargar", shareSummary: "Compartir resumen",
      share: "Compartir", shareWhatsApp: "WhatsApp", shareMore: "Más…", downloadPng: "Descargar PNG",
      copyImageUnsupported: "No soportado en este navegador, usa Descargar.", copyShareLink: "Copiar link",
      toastDownloaded: "¡Descargado!", toastShared: "¡Compartido!", toastError: "Algo salió mal",
    },
    settleUp: {
      cta: "¿Listo para saldar?",
      ctaShort: "Saldar",
      modalTitle: "¿Listo para saldar?",
      modalBody1: "Congelar totales",
      modalBody2: "Avisar a todos",
      modalBody3: "Dejar que te paguen",
      cancel: "Cancelar",
      sendSummary: "Enviar resumen",
      toastSuccess: "Resumen enviado. Hora de saldar",
      statusSettling: "Saldando",
      statusSettled: "Todo saldado",
      statusActive: "Activo",
      statusDraft: "Borrador",
      participantBanner: "finalizó el viaje",
      tapToSettle: "Debes",
      updatedAfterSummary: "Actualizado después del resumen",
      markAsSettled: "¿Todos pagaron? Marcar como saldado",
      markAsSettledButton: "Marcar como saldado",
      everyonePaid: "¿Todos pagaron?",
    },
    bbq: {
      allBarbecues: "Asados", newBarbecue: "Nuevo Asado", bbqName: "Nombre del evento",
      date: "Fecha", currency: "Moneda", create: "Crear", delete: "Eliminar",
      selectBbq: "Seleccioná o creá un evento para empezar", noBbqs: "No hay eventos todavía",
      noBbqsSubtitle: "Creá tu primer evento para empezar a registrar gastos.",
      breakdown: "Desglose", hostedBy: "Organizado por", you: "vos",
      visibility: "Visibilidad", publicEvent: "Público", privateEvent: "Privado",
      publicDesc: "Cualquiera puede ver y solicitar unirse",
      privateDesc: "Solo los invitados pueden ver este evento",
      inviteUser: "Invitar Personas", inviteUsernamePlaceholder: "Nombre de usuario a invitar",
      invite: "Invitar", inviteSent: "¡Invitación enviada!", alreadyMember: "Ya es miembro",
      invited: "Invitado", acceptInvite: "Aceptar", declineInvite: "Rechazar",
      pendingInvites: "Invitaciones Pendientes",
      inviteLink: "Enlace de invitación", copy: "Copiar", copySuccess: "¡Copiado!", share: "Compartir",
      currencyConversion: "En Otras Monedas", approxRates: "Tasas aproximadas",
      yourShare: "Tu cuota",
      allowOptInExpenses: "Permitir que los participantes elijan en qué gastos participan",
      allowOptInExpensesDesc: "Cada participante puede sumarse o no a cada gasto (ej. carne o transporte).",
      advancedOptions: "Opciones avanzadas",
      flexibleSplit: "Reparto flexible",
      flexibleSplitDesc: "Los participantes pueden elegir en qué gastos participan",
      eventBasics: "Datos del evento",
      splitBehavior: "Reparto",
      privacy: "Privacidad",
      imIn: "Me sumo",
      imOut: "No me sumo",
      optInExpenseLabel: "Los participantes se suman",
      optInExpenseHintOn: "Solo pagan quienes se suman",
      optInExpenseHintOff: "Compartido entre todos",
      optInChipTooltip: "Los participantes pueden sumarse o no a este gasto.",
    },
    auth: {
      login: "Iniciar Sesión", register: "Registrarse", logout: "Cerrar Sesión",
      username: "Usuario", email: "Correo electrónico", displayName: "Tu nombre",
      displayNamePlaceholder: "ej. Carlos (opcional)",
      password: "Contraseña", confirmPassword: "Confirmar Contraseña",
      loginTitle: "Bienvenido de vuelta", registerTitle: "Crear cuenta",
      welcomeBack: "Iniciá sesión para continuar", createAccount: "Crear cuenta",
      alreadyHaveAccount: "¿Ya tenés cuenta?", dontHaveAccount: "¿No tenés cuenta?",
      usernameTaken: "Ese nombre de usuario ya está en uso",
      emailTaken: "Ya existe una cuenta con ese correo",
      invalidCredentials: "Usuario o contraseña inválidos",
      passwordsNoMatch: "Las contraseñas no coinciden",
      loggedInAs: "Sesión iniciada como", profile: "Perfil",
      bio: "Biografía", profilePictureUrl: "URL de foto de perfil", editProfile: "Editar perfil",
      usernameHint: "2–30 caracteres, letras/números/_/-",
      passwordHint: "Al menos 8 caracteres",
      forgotPassword: "¿Olvidaste tu contraseña?",
      forgotPasswordTitle: "Recuperar contraseña",
      forgotPasswordSubtitle: "Ingresá tu email y te enviaremos un enlace",
      sendResetLink: "Enviar enlace",
      checkEmail: "Revisá tu email",
      checkEmailDesc: "Te enviamos un enlace para restablecer tu contraseña.",
      emailNotSentHint: "No pudimos enviar el correo. Revisá la dirección o intentá más tarde.",
      welcomeEmailNotSent: "No pudimos enviar el correo de bienvenida. Tu cuenta fue creada — podés iniciar sesión.",
      newPassword: "Nueva contraseña",
      resetPasswordBtn: "Restablecer contraseña",
      passwordResetSuccess: "¡Contraseña restablecida! Ya podés iniciar sesión.",
      backToLogin: "Volver al inicio",
      tokenInvalid: "Este enlace es inválido o expiró.",
    },
    user: {
      setupTitle: "¡Bienvenido! Elegí un nombre", setupSubtitle: "Tu nombre te identifica en eventos compartidos.",
      usernamePlaceholder: "ej. Carlos", confirm: "¡Vamos!",
      joinBbq: "Unirse", pending: "Pendiente", joined: "Unido",
      pendingRequests: "Solicitudes", accept: "Aceptar", reject: "Rechazar",
      leave: "Salir", hi: "Hola", changeUsername: "Cambiar nombre", editNameInBbq: "Editar nombre", host: "Anfitrión",
      deleteAccount: "Eliminar cuenta", deleteAccountConfirm: "Eliminar tu cuenta permanentemente",
      typeUsernameToConfirm: "Escribí tu usuario para confirmar", cannotBeUndone: "Esto no se puede deshacer.",
      preferredCurrencies: "Monedas a mostrar",
    },
    friends: {
      title: "Amigos",
      addFriend: "Agregar Amigo",
      searchPlaceholder: "Buscar por usuario...",
      sendRequest: "Enviar Solicitud",
      requestSent: "Solicitud Enviada",
      friendRequests: "Solicitudes de Amistad",
      noFriends: "Aún no tenés amigos",
      noRequests: "Sin solicitudes pendientes",
      removeFriend: "Eliminar Amigo",
      alreadyFriends: "Ya son amigos",
      userNotFound: "Usuario no encontrado",
      cannotFriendSelf: "No podés agregarte a vos mismo",
      friendshipExists: "La solicitud ya existe",
      profile: "Perfil",
      inviteFromFriends: "Invitar amigos",
    },
    notifications: {
      joinRequest: "Solicitud de Unión",
      wantsToJoin: "quiere unirse a",
      newFriendRequest: "Nueva solicitud de amistad",
      fromUser: "de",
    },
    landing: {
      heading: "Cuentas claras, conservan la amistad",
      subheading: "Elegí cómo querés usar la app",
      basicTitle: "Básico (sin cuenta)",
      basicDesc: "Reparto simple de gastos. Sin registro.",
      fullTitle: "Versión completa",
      fullDesc: "Fiestas, viajes, eventos. Guardá y compartí con amigos.",
      tryBasic: "Probar sin cuenta",
      logInFull: "Entrar para todas las funciones",
      heroTitle: "Cuentas claras. Amistad intacta.",
      heroSubtitle: "La forma más fácil de dividir viajes, fiestas y momentos compartidos.",
      ctaStartFree: "Empezar gratis",
      ctaTryDemo: "Probar demo",
      socialProofTagline: "Querido por amigos en todo el mundo",
      eventsSplit: "1.200+",
      sharedCosts: "€85k+",
      countries: "40+",
      useCasesTitle: "Hecho para cómo dividís",
      useCaseTrips: "Viajes",
      useCaseTripsDesc: "Dividí hoteles, comida y transporte sin la matemática incómoda.",
      useCaseParties: "Fiestas",
      useCasePartiesDesc: "Cumpleaños, asado o cena — registrá quién pagó qué, justo y simple.",
      useCaseFestivals: "Festivales",
      useCaseFestivalsDesc: "Carpas, entradas y tragos compartidos. Un link, todos adentro.",
      useCaseRoommates: "Compañeros de piso",
      useCaseRoommatesDesc: "Alquiler, servicios, compras. Sin más hojas de cálculo de deudas.",
      featuresTitle: "División inteligente, configuración simple",
      featureSmartSplit: "División inteligente",
      featureSmartSplitDesc: "Planes de pago automáticos. Ver quién le debe a quién en un toque.",
      featureOptIn: "Gastos optativos",
      featureOptInDesc: "Dividí solo lo que compartís. Saltá el bife si sos vegetariano.",
      featureThemes: "Temas de eventos",
      featureThemesDesc: "Viajes, fiestas, festivales — plantillas que se ajustan a la ocasión.",
      featureMultiCurrency: "Multi-moneda",
      featureMultiCurrencyDesc: "EUR, USD, GBP y más. Conversiones aproximadas incluidas.",
      viralTitle: "Hecho para grupos, no hojas de cálculo",
      viralCopy: "Invitando amigos se crea valor instantáneo. Un link, todos adentro.",
      viralMicroCopy: "Enviá un link. Todos adentro.",
      viralCta: "Crear tu primer evento",
      trustNoAds: "Sin anuncios",
      trustNoTracking: "Sin rastreo",
      trustFairSplits: "Solo divisiones justas",
      faqFreeQ: "¿Es gratis?",
      faqFreeA: "Sí. Splanno es gratis. Creá eventos, agregá gastos y dividí con amigos — sin costos ocultos.",
      faqAccountsQ: "¿Los amigos necesitan cuentas?",
      faqAccountsA: "Para el demo, no. Para la app completa, pueden registrarse rápido para guardar eventos e historial.",
      faqCurrenciesQ: "¿Puedo usar varias monedas?",
      faqCurrenciesA: "Sí. Cada evento tiene una moneda base. Soportamos EUR, USD, GBP, ARS, MXN con tasas aproximadas.",
      footerTagline: "Cuentas claras, amistad intacta.",
      footerProduct: "Producto",
      footerFeatures: "Funciones",
      footerAbout: "Acerca",
      footerLogin: "Entrar",
      footerTryDemo: "Probar demo",
      footerDescription: "La forma más fácil de dividir viajes, fiestas y momentos compartidos.",
      shareHook: "Mirá cómo Splanno se ve con amigos",
    },
    welcome: {
      title: "¡Bienvenido, {name}!",
      description: "Creá fiestas y viajes, agregá eventos, invitá amigos y repartí gastos en un toque.",
      getStarted: "Empezar",
    },
    basic: {
      backToLanding: "Volver",
      pageTitle: "Reparto básico",
      adPlaceholder: "Publicidad",
      demoBadge: "Modo demo — no se guarda nada",
      whosIn: "¿Quiénes están?",
      whoPaidWhat: "¿Quién pagó qué?",
      whoOwesWho: "¿Quién le debe a quién?",
      tryAnotherScenario: "Probar otro escenario",
      shareThisSplit: "Compartir este reparto",
      shareSummary: "Compartir resumen",
      allSettledStillFriends: "Todo saldado. Siguen amigos",
      readyToUseCta: "¿Listo para usarlo con amigos de verdad?",
      continueWithout: "Seguir sin cuenta",
      unlockFull: "Desbloquear versión completa",
      availableInFull: "Disponible en la versión completa",
      scenarioBarcelona: "Finde Barcelona",
      scenarioBBQ: "Noche de BBQ",
      scenarioSki: "Viaje de esquí",
      scenarioBirthday: "Fiesta de cumpleaños",
      scenarioRoadtrip: "Roadtrip Europa",
      lockedTrips: "Viajes",
      lockedFriends: "Amigos",
      lockedThemes: "Temas inteligentes",
      lockedHistory: "Historial",
    },
    nav: {
      parties: "Fiestas",
      trips: "Viajes",
    },
    events: {
      event: "Evento",
      newEvent: "Nuevo evento",
      noEventsYet: "No hay eventos todavía",
      noEventsSubtitle: "Creá tu primer evento para registrar gastos.",
      selectEvent: "Seleccioná o creá un evento para empezar",
    },
    eventTypes: {
      barbecue: "Asado",
      dinnerParty: "Cena",
      dinnerNight: "Noche de cena",
      birthday: "Cumpleaños",
      houseParty: "Fiesta en casa",
      gameNight: "Noche de juegos",
      movieNight: "Noche de película",
      poolParty: "Fiesta de piscina",
      afterParty: "After party",
      otherParty: "Otro",
      cityTrip: "Viaje ciudad",
      roadTrip: "Road trip",
      beachTrip: "Playa",
      skiTrip: "Esquí",
      festivalTrip: "Festival",
      hikingTrip: "Senderismo",
      camping: "Camping",
      weekendGetaway: "Escapada de fin de semana",
      businessTrip: "Viaje de trabajo",
      otherTrip: "Otro",
      vacation: "Vacaciones",
      backpacking: "Mochilero",
      bachelorTrip: "Despedida",
      workation: "Workation",
      cinema: "Cine",
      themePark: "Parque de diversiones",
      dayOut: "Día afuera",
    },
    discover: {
      title: "Descubrir",
      empty: "Aún no hay eventos públicos.",
      creator: "por",
      view: "Ver",
      join: "Unirse",
    },
    profileStats: { events: "Eventos", friends: "Amigos", totalSpent: "Total gastado" },
    profileTabs: { profile: "Perfil", friends: "Amigos", activity: "Actividad", settings: "Configuración" },
    profileActivity: { comingSoon: "Actividad próximamente." },
    tripsComingSoon: "Viajes próximamente. Por ahora creá eventos en Fiestas.",
  },
  it: {
    title: "Splanno",
    subtitle: "Dividi il conto, goditi il momento",
    addPerson: "Aggiungi Persona",
    addExpense: "Aggiungi Spesa",
    totalSpent: "Totale Speso",
    participants: "Partecipanti",
    expenses: "Spese",
    fairShare: "Quota Equa",
    tabs: { expenses: "Spese", people: "Persone", split: "Divisione", notes: "Note", chat: "Chat" },
    activity: {
      recentActivity: "Attività recente",
      chatComingSoon: "La chat arriverà presto",
      chatSubtitle: "Stiamo creando una chat di gruppo leggera per ogni evento.",
      enableChat: "Abilita chat",
      soon: "Prossimamente",
    },
    emptyState: {
      title: "Crea un evento",
      subtitle: "Aggiungi partecipanti e registra le spese per dividere i costi.",
    },
    categories: {
      Meat: "Carne", Bread: "Pane", Drinks: "Bevande",
      Charcoal: "Carbone", Transportation: "Trasporto", Other: "Altro",
      Food: "Cibo", Transport: "Trasporto", Tickets: "Biglietti", Accommodation: "Alloggio",
      Activities: "Attività", Groceries: "Spesa", Snacks: "Snack", Supplies: "Forniture",
      Parking: "Parcheggio", Tips: "Mance", Entertainment: "Intrattenimento",
    },
    placeholders: {
      meat: "es. Bistecca, salsicce, costolette",
      bread: "es. Pane, focaccia, grissini",
      drinks: "es. Birra, vino, cocktail",
      charcoal: "es. Carbone, accendifuoco, legna",
      transport: "es. Uber, benzina, biglietti metro",
      food: "es. Ristorante, takeaway, spesa",
      tickets: "es. Museo, concerto, ingresso",
      accommodation: "es. Hotel, Airbnb, campeggio",
      activities: "es. Tour, workshop, attività",
      groceries: "es. Supermercato, spesa",
      snacks: "es. Patatine, biscotti, noccioline",
      supplies: "es. Piatti, tovaglioli, posate",
      parking: "es. Parcheggio, garage",
      tips: "es. Cameriere, autista, guida",
      entertainment: "es. Cinema, bowling, giochi",
      other: "es. Varie",
      transportCity: "es. Uber, Biglietti metro",
      accommodationCity: "es. Airbnb, Notte hotel",
      foodCity: "es. Tapas, Ristorante",
      foodDinner: "es. Tapas, Bistecca",
      foodMovie: "es. Popcorn, Snack",
      streaming: "es. Noleggio Netflix, Biglietto cinema",
      decor: "es. Palloncini, Candele",
      transportRoad: "es. Benzina, Pedaggio, Parcheggio",
      ticketsCity: "es. Ingresso museo, Attrazione",
      ticketsFestival: "es. Pass festival, Giornaliero",
    },
    modals: {
      addPersonTitle: "Aggiungi Partecipante", addExpenseTitle: "Registra Spesa",
      editExpenseTitle: "Modifica Spesa", nameLabel: "Nome", paidByLabel: "Pagato Da",
      categoryLabel: "Categoria", itemLabel: "Descrizione", amountLabel: "Importo",
      cancel: "Annulla", add: "Aggiungi", save: "Salva",
      createCustomCategory: "+ Crea categoria personalizzata…",
      expenseAdded: "Spesa aggiunta", expenseUpdated: "Spesa aggiornata", expenseAddFailed: "Impossibile aggiungere la spesa", profileSaved: "Profilo salvato", linkCopied: "Link copiato",
      addNoteTitle: "Aggiungi Nota", editNoteTitle: "Modifica Nota", noteTitlePlaceholder: "Titolo (opzionale)", noteBodyPlaceholder: "Scrivi la tua nota…",
      noteBodyRequired: "Il contenuto è obbligatorio", pinNote: "Fissa in alto", noteAdded: "Nota aggiunta", noteUpdated: "Nota aggiornata", noteDeleted: "Nota eliminata",
    },
    notes: {
      pinnedNote: "Nota fissa", emptyTitle: "Nessuna nota", emptySubtitle: "Aggiungi promemoria, idee o informazioni condivise.",
      addNoteCta: "Aggiungi nota", justNow: "Adesso", minutesAgo: "{{n}} min fa", hoursAgo: "{{n}} ore fa", daysAgo: "{{n}} giorni fa", by: "di",
      deleteConfirm: "Eliminare questa nota?",
    },
    split: {
      contributions: "Contributi Individuali", settlement: "Piano di Rimborso",
      owes: "deve a", allSettled: "Tutto saldato!", allSettledStillFriends: "Tutto saldato. Amicizia preservata.", overpaid: "Eccedenza", underpaid: "Debito",
      shareImage: "Condividi immagine", copyImage: "Copia immagine", download: "Scarica", shareSummary: "Condividi riepilogo",
      share: "Condividi", shareWhatsApp: "WhatsApp", shareMore: "Altro…", downloadPng: "Scarica PNG",
      copyImageUnsupported: "Non supportato in questo browser, usa Scarica.", copyShareLink: "Copia link",
      toastDownloaded: "Scaricato!", toastShared: "Condiviso!", toastError: "Qualcosa è andato storto",
    },
    settleUp: {
      cta: "Pronto a saldare?",
      ctaShort: "Saldare",
      modalTitle: "Pronto a saldare?",
      modalBody1: "Congela i totali",
      modalBody2: "Notifica tutti",
      modalBody3: "Lascia che ti ripaghino",
      cancel: "Annulla",
      sendSummary: "Invia riepilogo",
      toastSuccess: "Riepilogo inviato. È ora di saldare",
      statusSettling: "In saldo",
      statusSettled: "Tutto saldato",
      statusActive: "Attivo",
      statusDraft: "Bozza",
      participantBanner: "ha finalizzato il viaggio",
      tapToSettle: "Devi",
      updatedAfterSummary: "Aggiornato dopo l'invio del riepilogo",
      markAsSettled: "Tutti hanno pagato? Segna come saldato",
      markAsSettledButton: "Segna come saldato",
      everyonePaid: "Tutti hanno pagato?",
    },
    bbq: {
      allBarbecues: "Barbecue", newBarbecue: "Nuovo BBQ", bbqName: "Nome evento",
      date: "Data", currency: "Valuta", create: "Crea", delete: "Elimina",
      selectBbq: "Seleziona o crea un evento per iniziare", noBbqs: "Nessun evento ancora",
      noBbqsSubtitle: "Crea il tuo primo evento per tracciare le spese.",
      breakdown: "Riepilogo", hostedBy: "Organizzato da", you: "tu",
      visibility: "Visibilità", publicEvent: "Pubblico", privateEvent: "Privato",
      publicDesc: "Chiunque può vedere e richiedere di partecipare",
      privateDesc: "Solo gli invitati possono vedere questo evento",
      inviteUser: "Invita Persone", inviteUsernamePlaceholder: "Nome utente da invitare",
      invite: "Invita", inviteSent: "Invito inviato!", alreadyMember: "Già membro",
      invited: "Invitato", acceptInvite: "Accetta", declineInvite: "Rifiuta",
      pendingInvites: "Inviti in Sospeso",
      inviteLink: "Link invito", copy: "Copia", copySuccess: "Copiato!", share: "Condividi",
      currencyConversion: "In Altre Valute", approxRates: "Tassi approssimativi",
      yourShare: "La tua quota",
      allowOptInExpenses: "Permetti ai partecipanti di scegliere per quali spese pagare",
      allowOptInExpensesDesc: "Ogni partecipante può optare per ogni spesa (es. carne o trasporto).",
      advancedOptions: "Opzioni avanzate",
      flexibleSplit: "Split flessibile",
      flexibleSplitDesc: "I partecipanti possono scegliere a quali spese partecipare",
      eventBasics: "Dati dell'evento",
      splitBehavior: "Divisione",
      privacy: "Privacy",
      imIn: "Partecipo",
      imOut: "Non partecipo",
      optInExpenseLabel: "I partecipanti si uniscono",
      optInExpenseHintOn: "Pagano solo chi si unisce",
      optInExpenseHintOff: "Diviso tra tutti",
      optInChipTooltip: "I partecipanti possono unirsi o meno a questa spesa.",
    },
    auth: {
      login: "Accedi", register: "Registrati", logout: "Esci",
      username: "Nome utente", email: "Indirizzo email", displayName: "Il tuo nome",
      displayNamePlaceholder: "es. Carlo (opzionale)",
      password: "Password", confirmPassword: "Conferma Password",
      loginTitle: "Bentornato", registerTitle: "Crea account",
      welcomeBack: "Accedi per continuare", createAccount: "Registrati",
      alreadyHaveAccount: "Hai già un account?", dontHaveAccount: "Non hai un account?",
      usernameTaken: "Questo nome utente è già in uso",
      emailTaken: "Esiste già un account con questa email",
      invalidCredentials: "Nome utente o password non validi",
      passwordsNoMatch: "Le password non corrispondono",
      loggedInAs: "Connesso come", profile: "Profilo",
      bio: "Bio", profilePictureUrl: "URL foto profilo", editProfile: "Modifica profilo",
      usernameHint: "2–30 caratteri, lettere/numeri/_/-",
      passwordHint: "Almeno 8 caratteri",
      forgotPassword: "Password dimenticata?",
      forgotPasswordTitle: "Reimposta la password",
      forgotPasswordSubtitle: "Inserisci la tua email e ti invieremo un link",
      sendResetLink: "Invia link",
      checkEmail: "Controlla la tua email",
      checkEmailDesc: "Abbiamo inviato un link per reimpostare la password.",
      emailNotSentHint: "Non siamo riusciti a inviare l'email. Controlla l'indirizzo o riprova più tardi.",
      welcomeEmailNotSent: "Non siamo riusciti a inviare l'email di benvenuto. L'account è stato creato — puoi accedere.",
      newPassword: "Nuova password",
      resetPasswordBtn: "Reimposta password",
      passwordResetSuccess: "Password reimpostata! Ora puoi accedere.",
      backToLogin: "Torna al login",
      tokenInvalid: "Questo link non è valido o è scaduto.",
    },
    user: {
      setupTitle: "Benvenuto! Scegli un nome", setupSubtitle: "Il tuo nome ti identifica negli eventi condivisi.",
      usernamePlaceholder: "es. Carlo", confirm: "Andiamo!",
      joinBbq: "Unisciti", pending: "In attesa", joined: "Unito",
      pendingRequests: "Richieste", accept: "Accetta", reject: "Rifiuta",
      leave: "Esci", hi: "Ciao", changeUsername: "Cambia nome", editNameInBbq: "Modifica nome", host: "Organizzatore",
      deleteAccount: "Elimina account", deleteAccountConfirm: "Elimina definitivamente il tuo account",
      typeUsernameToConfirm: "Digita il tuo username per confermare", cannotBeUndone: "Questa azione non può essere annullata.",
      preferredCurrencies: "Valute da mostrare",
    },
    friends: {
      title: "Amici",
      addFriend: "Aggiungi Amico",
      searchPlaceholder: "Cerca per username...",
      sendRequest: "Invia Richiesta",
      requestSent: "Richiesta Inviata",
      friendRequests: "Richieste di Amicizia",
      noFriends: "Nessun amico ancora",
      noRequests: "Nessuna richiesta",
      removeFriend: "Rimuovi Amico",
      alreadyFriends: "Già amici",
      userNotFound: "Utente non trovato",
      cannotFriendSelf: "Non puoi aggiungere te stesso",
      friendshipExists: "Richiesta già inviata",
      profile: "Profilo",
      inviteFromFriends: "Invita amici",
    },
    notifications: {
      joinRequest: "Richiesta di Partecipazione",
      wantsToJoin: "vuole unirsi a",
      newFriendRequest: "Nuova richiesta di amicizia",
      fromUser: "da",
    },
    landing: {
      heading: "Split costs, stay friends",
      subheading: "Scegli come usare l'app",
      basicTitle: "Base (senza account)",
      basicDesc: "Split spese semplice. Nessuna registrazione.",
      fullTitle: "Versione completa",
      fullDesc: "Feste, viaggi, eventi. Salva e condividi con amici.",
      tryBasic: "Prova senza account",
      logInFull: "Accedi per tutte le funzioni",
      heroTitle: "Split costs. Stay friends.",
      heroSubtitle: "Il modo più semplice per dividere viaggi, feste e momenti condivisi.",
      ctaStartFree: "Inizia gratis",
      ctaTryDemo: "Prova demo",
      socialProofTagline: "Amato da amici in tutto il mondo",
      eventsSplit: "1.200+",
      sharedCosts: "€85k+",
      countries: "40+",
      useCasesTitle: "Fatto per come dividi",
      useCaseTrips: "Viaggi",
      useCaseTripsDesc: "Dividi hotel, cibo e trasporti senza la matematica imbarazzante.",
      useCaseParties: "Feste",
      useCasePartiesDesc: "Compleanno, BBQ o cena — traccia chi ha pagato cosa, giusto e semplice.",
      useCaseFestivals: "Festival",
      useCaseFestivalsDesc: "Tende, biglietti e drink condivisi. Un link, tutti dentro.",
      useCaseRoommates: "Coinquilini",
      useCaseRoommatesDesc: "Affitto, bollette, spesa. Basta con i fogli di calcolo IO.",
      featuresTitle: "Split intelligente, setup semplice",
      featureSmartSplit: "Split intelligente",
      featureSmartSplitDesc: "Piani di saldo automatici. Vedi chi deve a chi in un tap.",
      featureOptIn: "Spese opt-in",
      featureOptInDesc: "Dividi solo ciò che condividi. Salta la bistecca se sei vegetariano.",
      featureThemes: "Temi eventi",
      featureThemesDesc: "Viaggi, feste, festival — template adatti all'occasione.",
      featureMultiCurrency: "Multi-valuta",
      featureMultiCurrencyDesc: "EUR, USD, GBP e altri. Conversioni approssimative integrate.",
      viralTitle: "Fatto per gruppi, non fogli di calcolo",
      viralCopy: "Invitare amici crea valore istantaneo. Un link, tutti dentro.",
      viralMicroCopy: "Invia un link. Tutti dentro.",
      viralCta: "Crea il tuo primo evento",
      trustNoAds: "Nessuna pubblicità",
      trustNoTracking: "Nessun tracking",
      trustFairSplits: "Solo split equi",
      faqFreeQ: "È gratis?",
      faqFreeA: "Sì. Splanno è gratuito. Crea eventi, aggiungi spese e dividi con amici — niente costi nascosti.",
      faqAccountsQ: "Gli amici devono registrarsi?",
      faqAccountsA: "Per il demo, no. Per l'app completa possono registrarsi rapidamente per salvare eventi e cronologia.",
      faqCurrenciesQ: "Posso usare più valute?",
      faqCurrenciesA: "Sì. Ogni evento ha una valuta base. Supportiamo EUR, USD, GBP, ARS, MXN con tassi approssimativi.",
      footerTagline: "Split costs, stay friends.",
      footerProduct: "Prodotto",
      footerFeatures: "Funzionalità",
      footerAbout: "Chi siamo",
      footerLogin: "Accedi",
      footerTryDemo: "Prova demo",
      footerDescription: "Il modo più semplice per dividere viaggi, feste e momenti condivisi.",
      shareHook: "Scopri come Splanno funziona con gli amici",
    },
    welcome: {
      title: "Benvenuto, {name}!",
      description: "Crea feste e viaggi, aggiungi eventi, invita amici e dividi le spese in un attimo.",
      getStarted: "Inizia",
    },
    basic: {
      backToLanding: "Indietro",
      pageTitle: "Split base",
      adPlaceholder: "Pubblicità",
      demoBadge: "Modalità demo — nulla viene salvato",
      whosIn: "Chi c'è?",
      whoPaidWhat: "Chi ha pagato cosa?",
      whoOwesWho: "Chi deve a chi?",
      tryAnotherScenario: "Prova un altro scenario",
      shareThisSplit: "Condividi questo split",
      shareSummary: "Condividi riepilogo",
      allSettledStillFriends: "Tutto saldato. Ancora amici",
      readyToUseCta: "Pronto ad usarlo con amici veri?",
      continueWithout: "Continua senza account",
      unlockFull: "Sblocca versione completa",
      availableInFull: "Disponibile nella versione completa",
      scenarioBarcelona: "Weekend Barcellona",
      scenarioBBQ: "Serata BBQ",
      scenarioSki: "Gita sci",
      scenarioBirthday: "Festa di compleanno",
      scenarioRoadtrip: "Roadtrip Europa",
      lockedTrips: "Viaggi",
      lockedFriends: "Amici",
      lockedThemes: "Temi smart",
      lockedHistory: "Cronologia",
    },
    nav: {
      parties: "Feste",
      trips: "Viaggi",
    },
    events: {
      event: "Evento",
      newEvent: "Nuovo evento",
      noEventsYet: "Nessun evento ancora",
      noEventsSubtitle: "Crea il tuo primo evento per tracciare le spese.",
      selectEvent: "Seleziona o crea un evento per iniziare",
    },
    eventTypes: {
      barbecue: "Barbecue",
      dinnerParty: "Cena",
      dinnerNight: "Cena a casa",
      birthday: "Compleanno",
      houseParty: "Festa a casa",
      gameNight: "Serata giochi",
      movieNight: "Serata cinema",
      poolParty: "Festa in piscina",
      afterParty: "After party",
      otherParty: "Altro",
      cityTrip: "Viaggio città",
      roadTrip: "Road trip",
      beachTrip: "Spiaggia",
      skiTrip: "Sci",
      festivalTrip: "Festival",
      hikingTrip: "Escursione",
      camping: "Campeggio",
      weekendGetaway: "Weekend fuori",
      businessTrip: "Viaggio di lavoro",
      otherTrip: "Altro",
      vacation: "Vacanza",
      backpacking: "Zaino in spalla",
      bachelorTrip: "Addio al celibato",
      workation: "Workation",
      cinema: "Cinema",
      themePark: "Parco divertimenti",
      dayOut: "Gita",
    },
    discover: {
      title: "Scopri",
      empty: "Nessun evento pubblico ancora.",
      creator: "da",
      view: "Apri",
      join: "Unisciti",
    },
    profileStats: { events: "Eventi", friends: "Amici", totalSpent: "Totale speso" },
    profileTabs: { profile: "Profilo", friends: "Amici", activity: "Attività", settings: "Impostazioni" },
    profileActivity: { comingSoon: "Attività in arrivo." },
    tripsComingSoon: "I viaggi sono in arrivo. Per ora crea eventi in Feste.",
  },
  nl: {
    title: "Splanno",
    subtitle: "Deel de rekening, geniet van het moment",
    addPerson: "Persoon Toevoegen",
    addExpense: "Uitgave Toevoegen",
    totalSpent: "Totaal Besteed",
    participants: "Deelnemers",
    expenses: "Uitgaven",
    fairShare: "Eerlijk Aandeel",
    tabs: { expenses: "Uitgaven", people: "Mensen", split: "Verdeling", notes: "Notities", chat: "Chat" },
    activity: {
      recentActivity: "Recente activiteit",
      chatComingSoon: "Chat komt binnenkort",
      chatSubtitle: "We bouwen een lichte groeps-chat voor elk evenement.",
      enableChat: "Chat inschakelen",
      soon: "Binnenkort",
    },
    emptyState: {
      title: "Maak een evenement",
      subtitle: "Voeg deelnemers toe en log uitgaven om kosten te verdelen.",
    },
    categories: {
      Meat: "Vlees", Bread: "Brood", Drinks: "Drankjes",
      Charcoal: "Houtskool", Transportation: "Transport", Other: "Overig",
      Food: "Eten", Transport: "Vervoer", Tickets: "Tickets", Accommodation: "Accommodatie",
      Activities: "Activiteiten", Groceries: "Boodschappen", Snacks: "Snacks", Supplies: "Benodigdheden",
      Parking: "Parkeren", Tips: "Fooien", Entertainment: "Ontspanning",
    },
    placeholders: {
      meat: "bijv. Biefstuk, chorizo, worsten",
      bread: "bijv. Stokbrood, ciabatta",
      drinks: "bijv. Bier, wijn, cocktails",
      charcoal: "bijv. Houtskool, aanmaakblokjes",
      transport: "bijv. Uber, brandstof, OV",
      food: "bijv. Restaurant, afhaal, boodschappen",
      tickets: "bijv. Museum, concert, entree",
      accommodation: "bijv. Hotel, Airbnb, camping",
      activities: "bijv. Rondleiding, workshop",
      groceries: "bijv. Supermarkt, boodschappen",
      snacks: "bijv. Chips, noten, koekjes",
      supplies: "bijv. Borden, servetten, bestek",
      parking: "bijv. Parkeermeter, garage",
      tips: "bijv. Ober, chauffeur, gids",
      entertainment: "bijv. Bioscoop, bowling",
      other: "bijv. Diversen",
      transportCity: "bijv. Uber, Metrokaartjes",
      accommodationCity: "bijv. Airbnb, Hotelovernachting",
      foodCity: "bijv. Tapas, Restaurant",
      foodDinner: "bijv. Tapas, Biefstuk",
      foodMovie: "bijv. Popcorn, Snacks",
      streaming: "bijv. Netflix huur, Bioscoopkaartje",
      decor: "bijv. Ballonnen, Kaarsen",
      transportRoad: "bijv. Brandstof, Tol, Parkeren",
      ticketsCity: "bijv. Museumentree, Attractie",
      ticketsFestival: "bijv. Festivalpas, Dagkaart",
    },
    modals: {
      addPersonTitle: "Deelnemer Toevoegen", addExpenseTitle: "Uitgave Registreren",
      editExpenseTitle: "Uitgave Bewerken", nameLabel: "Naam", paidByLabel: "Betaald Door",
      categoryLabel: "Categorie", itemLabel: "Omschrijving", amountLabel: "Bedrag",
      cancel: "Annuleren", add: "Toevoegen", save: "Opslaan",
      createCustomCategory: "+ Aangepaste categorie aanmaken…",
      expenseAdded: "Uitgave toegevoegd", expenseUpdated: "Uitgave bijgewerkt", expenseAddFailed: "Kon uitgave niet toevoegen", profileSaved: "Profiel opgeslagen", linkCopied: "Link gekopieerd",
      addNoteTitle: "Notitie Toevoegen", editNoteTitle: "Notitie Bewerken", noteTitlePlaceholder: "Titel (optioneel)", noteBodyPlaceholder: "Schrijf je notitie…",
      noteBodyRequired: "Inhoud is verplicht", pinNote: "Vastzetten", noteAdded: "Notitie toegevoegd", noteUpdated: "Notitie bijgewerkt", noteDeleted: "Notitie verwijderd",
    },
    notes: {
      pinnedNote: "Vastgezette notitie", emptyTitle: "Nog geen notities", emptySubtitle: "Voeg herinneringen, ideeën of gedeelde info toe.",
      addNoteCta: "Notitie toevoegen", justNow: "Zojuist", minutesAgo: "{{n}} min geleden", hoursAgo: "{{n}} uur geleden", daysAgo: "{{n}} dagen geleden", by: "door",
      deleteConfirm: "Deze notitie verwijderen?",
    },
    split: {
      contributions: "Individuele Bijdragen", settlement: "Betaalplan",
      owes: "is verschuldigd aan", allSettled: "Alles verrekend!", allSettledStillFriends: "Alles verrekend. Vriendschap behouden.", overpaid: "Te veel betaald", underpaid: "Te weinig betaald",
      shareImage: "Deel afbeelding", copyImage: "Kopieer afbeelding", download: "Downloaden", shareSummary: "Deel samenvatting",
      share: "Delen", shareWhatsApp: "WhatsApp", shareMore: "Meer…", downloadPng: "Download PNG",
      copyImageUnsupported: "Niet ondersteund in deze browser, gebruik Download.", copyShareLink: "Kopieer link",
      toastDownloaded: "Gedownload!", toastShared: "Gedeeld!", toastError: "Er is iets misgegaan",
    },
    settleUp: {
      cta: "Klaar om af te rekenen?",
      ctaShort: "Afrekenen",
      modalTitle: "Klaar om af te rekenen?",
      modalBody1: "Totalen vastzetten",
      modalBody2: "Iedereen informeren",
      modalBody3: "Laat mensen je terugbetalen",
      cancel: "Annuleren",
      sendSummary: "Samenvatting versturen",
      toastSuccess: "Samenvatting verstuurd. Tijd om af te rekenen",
      statusSettling: "Aan het afrekenen",
      statusSettled: "Alles verrekend",
      statusActive: "Actief",
      statusDraft: "Concept",
      participantBanner: "heeft de trip afgerond",
      tapToSettle: "Te betalen",
      updatedAfterSummary: "Bijgewerkt na verzending samenvatting",
      markAsSettled: "Heeft iedereen betaald? Markeer als verrekend",
      markAsSettledButton: "Markeer als verrekend",
      everyonePaid: "Heeft iedereen betaald?",
    },
    bbq: {
      allBarbecues: "Barbecues", newBarbecue: "Nieuwe BBQ", bbqName: "Naam van het evenement",
      date: "Datum", currency: "Valuta", create: "Aanmaken", delete: "Verwijderen",
      selectBbq: "Selecteer of maak een evenement om te beginnen", noBbqs: "Nog geen evenementen",
      noBbqsSubtitle: "Maak je eerste evenement aan om uitgaven bij te houden.",
      breakdown: "Overzicht", hostedBy: "Georganiseerd door", you: "jij",
      visibility: "Zichtbaarheid", publicEvent: "Openbaar", privateEvent: "Privé",
      publicDesc: "Iedereen kan zien en deelname aanvragen",
      privateDesc: "Alleen uitgenodigde personen kunnen dit zien",
      inviteUser: "Personen Uitnodigen", inviteUsernamePlaceholder: "Gebruikersnaam uitnodigen",
      invite: "Uitnodigen", inviteSent: "Uitnodiging verstuurd!", alreadyMember: "Al lid",
      invited: "Uitgenodigd", acceptInvite: "Accepteren", declineInvite: "Afwijzen",
      pendingInvites: "Openstaande Uitnodigingen",
      inviteLink: "Uitnodigingslink", copy: "Kopiëren", copySuccess: "Gekopieerd!", share: "Delen",
      currencyConversion: "In Andere Valuta's", approxRates: "Geschatte koersen",
      yourShare: "Jouw aandeel",
      allowOptInExpenses: "Laat deelnemers kiezen voor welke uitgaven ze betalen",
      allowOptInExpensesDesc: "Deelnemers kunnen per uitgave opt-in of opt-out (bijv. vlees of vervoer).",
      advancedOptions: "Geavanceerde opties",
      flexibleSplit: "Flexibele verdeling",
      flexibleSplitDesc: "Deelnemers kunnen kiezen aan welke uitgaven ze deelnemen",
      eventBasics: "Evenementgegevens",
      splitBehavior: "Verdeling",
      privacy: "Privacy",
      imIn: "Ik doe mee",
      imOut: "Ik doe niet mee",
      optInExpenseLabel: "Deelnemers doen mee",
      optInExpenseHintOn: "Alleen deelnemers betalen",
      optInExpenseHintOff: "Gedeeld door iedereen",
      optInChipTooltip: "Deelnemers kunnen meedoen of niet voor deze uitgave.",
    },
    auth: {
      login: "Inloggen", register: "Registreren", logout: "Uitloggen",
      username: "Gebruikersnaam", email: "E-mailadres", displayName: "Jouw naam",
      displayNamePlaceholder: "bijv. Carlos (optioneel)",
      password: "Wachtwoord", confirmPassword: "Bevestig Wachtwoord",
      loginTitle: "Welkom terug", registerTitle: "Account aanmaken",
      welcomeBack: "Log in om verder te gaan", createAccount: "Account aanmaken",
      alreadyHaveAccount: "Heb je al een account?", dontHaveAccount: "Heb je geen account?",
      usernameTaken: "Die gebruikersnaam is al in gebruik",
      emailTaken: "Er bestaat al een account met dat e-mailadres",
      invalidCredentials: "Ongeldige gebruikersnaam of wachtwoord",
      passwordsNoMatch: "Wachtwoorden komen niet overeen",
      loggedInAs: "Ingelogd als", profile: "Profiel",
      bio: "Bio", profilePictureUrl: "URL profielfoto", editProfile: "Profiel bewerken",
      usernameHint: "2–30 tekens, letters/cijfers/_/-",
      passwordHint: "Minimaal 8 tekens",
      forgotPassword: "Wachtwoord vergeten?",
      forgotPasswordTitle: "Wachtwoord herstellen",
      forgotPasswordSubtitle: "Vul je e-mail in en we sturen je een link",
      sendResetLink: "Link versturen",
      checkEmail: "Controleer je e-mail",
      checkEmailDesc: "We hebben een herstelkoppeling naar je e-mailadres gestuurd.",
      emailNotSentHint: "We konden de e-mail nu niet versturen. Controleer je adres of probeer het later opnieuw.",
      welcomeEmailNotSent: "We konden de welkomstmail niet versturen. Je account is aangemaakt — je kunt inloggen.",
      newPassword: "Nieuw wachtwoord",
      resetPasswordBtn: "Wachtwoord herstellen",
      passwordResetSuccess: "Wachtwoord hersteld! Je kunt nu inloggen.",
      backToLogin: "Terug naar inloggen",
      tokenInvalid: "Deze link is ongeldig of verlopen.",
    },
    user: {
      setupTitle: "Welkom! Kies een gebruikersnaam", setupSubtitle: "Je naam identificeert je bij gedeelde evenementen.",
      usernamePlaceholder: "bijv. Carlos", confirm: "Let's Go!",
      joinBbq: "Deelnemen", pending: "In behandeling", joined: "Deelnemer",
      pendingRequests: "Aanvragen", accept: "Accepteren", reject: "Afwijzen",
      leave: "Verlaten", hi: "Hoi", changeUsername: "Naam wijzigen", editNameInBbq: "Naam bewerken", host: "Gastheer",
      deleteAccount: "Account verwijderen", deleteAccountConfirm: "Verwijder je account permanent",
      typeUsernameToConfirm: "Typ je gebruikersnaam om te bevestigen", cannotBeUndone: "Dit kan niet ongedaan worden gemaakt.",
      preferredCurrencies: "Te tonen valuta",
    },
    friends: {
      title: "Vrienden",
      addFriend: "Vriend Toevoegen",
      searchPlaceholder: "Zoek op gebruikersnaam...",
      sendRequest: "Verzoek Versturen",
      requestSent: "Verzoek Verstuurd",
      friendRequests: "Vriendschapsverzoeken",
      noFriends: "Nog geen vrienden",
      noRequests: "Geen verzoeken",
      removeFriend: "Vriend Verwijderen",
      alreadyFriends: "Al bevriend",
      userNotFound: "Gebruiker niet gevonden",
      cannotFriendSelf: "Je kunt jezelf niet toevoegen",
      friendshipExists: "Verzoek bestaat al",
      profile: "Profiel",
      inviteFromFriends: "Vrienden uitnodigen",
    },
    notifications: {
      joinRequest: "Deelnameverzoek",
      wantsToJoin: "wil deelnemen aan",
      newFriendRequest: "Nieuw vriendschapsverzoek",
      fromUser: "van",
    },
    landing: {
      heading: "Deel de rekening, blijf vrienden",
      subheading: "Kies hoe je de app wilt gebruiken",
      basicTitle: "Basis (zonder account)",
      basicDesc: "Eenvoudige kostenverdeling. Geen aanmelding.",
      fullTitle: "Volledige versie",
      fullDesc: "Feesten, trips, evenementen. Bewaar en deel met vrienden.",
      tryBasic: "Probeer zonder account",
      logInFull: "Log in voor alle functies",
      heroTitle: "Deel de rekening. Blijf vrienden.",
      heroSubtitle: "De makkelijkste manier om trips, feesten en gedeelde momenten te verdelen.",
      ctaStartFree: "Start gratis",
      ctaTryDemo: "Probeer demo",
      socialProofTagline: "Geliefd door vrienden wereldwijd",
      eventsSplit: "1.200+",
      sharedCosts: "€85k+",
      countries: "40+",
      useCasesTitle: "Gebouwd voor hoe jij deelt",
      useCaseTrips: "Trips",
      useCaseTripsDesc: "Deel hotels, eten en vervoer zonder de ongemakkelijke wiskunde.",
      useCaseParties: "Feesten",
      useCasePartiesDesc: "Verjaardag, BBQ of etentje — volg wie wat betaalde, eerlijk en simpel.",
      useCaseFestivals: "Festivals",
      useCaseFestivalsDesc: "Gedeelde tenten, tickets en drankjes. Eén link, iedereen doet mee.",
      useCaseRoommates: "Huisgenoten",
      useCaseRoommatesDesc: "Huur, nuts, boodschappen. Geen IOU-spreadsheets meer.",
      featuresTitle: "Slim verdelen, simpele setup",
      featureSmartSplit: "Slim verdelen",
      featureSmartSplitDesc: "Automatische afrekenplannen. Zie wie wie verschuldigd is in één tik.",
      featureOptIn: "Opt-in uitgaven",
      featureOptInDesc: "Deel alleen wat jij deelt. Sla het vlees over als je vegetariër bent.",
      featureThemes: "Eventthema's",
      featureThemesDesc: "Trips, feesten, festivals — sjablonen die bij de gelegenheid passen.",
      featureMultiCurrency: "Multi-valuta",
      featureMultiCurrencyDesc: "EUR, USD, GBP en meer. Geschatte conversies ingebouwd.",
      viralTitle: "Gebouwd voor groepen, niet spreadsheets",
      viralCopy: "Vrienden uitnodigen creëert directe waarde. Eén link, iedereen doet mee.",
      viralMicroCopy: "Stuur één link. Iedereen doet mee.",
      viralCta: "Maak je eerste evenement",
      trustNoAds: "Geen advertenties",
      trustNoTracking: "Geen tracking",
      trustFairSplits: "Gewoon eerlijke verdeling",
      faqFreeQ: "Is het gratis?",
      faqFreeA: "Ja. Splanno is gratis. Maak evenementen, voeg uitgaven toe en deel met vrienden — geen verborgen kosten.",
      faqAccountsQ: "Moeten vrienden accounts aanmaken?",
      faqAccountsA: "Voor de demo niet. Voor de volledige app kunnen ze zich snel registreren om evenementen en geschiedenis op te slaan.",
      faqCurrenciesQ: "Kan ik meerdere valuta's gebruiken?",
      faqCurrenciesA: "Ja. Elk evenement heeft een basisvaluta. We ondersteunen EUR, USD, GBP, ARS, MXN met geschatte koersen.",
      footerTagline: "Deel de rekening, blijf vrienden.",
      footerProduct: "Product",
      footerFeatures: "Functies",
      footerAbout: "Over",
      footerLogin: "Log in",
      footerTryDemo: "Probeer demo",
      footerDescription: "De makkelijkste manier om trips, feesten en gedeelde momenten te verdelen.",
      shareHook: "Bekijk hoe Splanno eruitziet met vrienden",
    },
    welcome: {
      title: "Welkom, {name}!",
      description: "Maak feesten en trips, voeg evenementen toe, nodig vrienden uit en deel kosten eenvoudig.",
      getStarted: "Aan de slag",
    },
    basic: {
      backToLanding: "Terug",
      pageTitle: "Eenvoudige verdeling",
      adPlaceholder: "Advertentie",
      demoBadge: "Demomodus — er wordt niets opgeslagen",
      whosIn: "Wie doen mee?",
      whoPaidWhat: "Wie betaalde wat?",
      whoOwesWho: "Wie is wie verschuldigd?",
      tryAnotherScenario: "Probeer een ander scenario",
      shareThisSplit: "Deel deze verdeling",
      shareSummary: "Deel samenvatting",
      allSettledStillFriends: "Alles verrekend. Nog steeds vrienden",
      readyToUseCta: "Klaar om dit te gebruiken met echte vrienden?",
      continueWithout: "Doorgaan zonder account",
      unlockFull: "Volledige versie ontgrendelen",
      availableInFull: "Beschikbaar in de volledige versie",
      scenarioBarcelona: "Weekend Barcelona",
      scenarioBBQ: "BBQ-avond",
      scenarioSki: "Skivakantie",
      scenarioBirthday: "Verjaardagsfeest",
      scenarioRoadtrip: "Roadtrip Europa",
      lockedTrips: "Trips",
      lockedFriends: "Vrienden",
      lockedThemes: "Slimme thema's",
      lockedHistory: "Geschiedenis",
    },
    nav: {
      parties: "Feesten",
      trips: "Trips",
    },
    events: {
      event: "Evenement",
      newEvent: "Nieuw evenement",
      noEventsYet: "Nog geen evenementen",
      noEventsSubtitle: "Maak je eerste evenement om uitgaven bij te houden.",
      selectEvent: "Selecteer of maak een evenement om te beginnen",
    },
    eventTypes: {
      barbecue: "Barbecue",
      dinnerParty: "Diner",
      dinnerNight: "Diner avond",
      birthday: "Verjaardag",
      houseParty: "Houseparty",
      gameNight: "Spelavond",
      movieNight: "Filmavond",
      poolParty: "Zwemfeest",
      afterParty: "Afterparty",
      otherParty: "Anders",
      cityTrip: "Stedentrip",
      roadTrip: "Roadtrip",
      beachTrip: "Strandvakantie",
      skiTrip: "Skivakantie",
      festivalTrip: "Festival",
      hikingTrip: "Wandelen",
      camping: "Kamperen",
      weekendGetaway: "Weekendje weg",
      businessTrip: "Zakelijk reizen",
      otherTrip: "Anders",
      vacation: "Vakantie",
      backpacking: "Backpacken",
      bachelorTrip: "Vrijgezellenfeest",
      workation: "Workation",
      cinema: "Bioscoop",
      themePark: "Attractiepark",
      dayOut: "Dagje uit",
    },
    discover: {
      title: "Ontdekken",
      empty: "Nog geen openbare evenementen.",
      creator: "door",
      view: "Bekijken",
      join: "Deelnemen",
    },
    profileStats: { events: "Evenementen", friends: "Vrienden", totalSpent: "Totaal besteed" },
    profileTabs: { profile: "Profiel", friends: "Vrienden", activity: "Activiteit", settings: "Instellingen" },
    profileActivity: { comingSoon: "Activiteit komt binnenkort." },
    tripsComingSoon: "Trips komen binnenkort. Maak voor nu evenementen onder Feesten.",
  },
};

const LanguageContext = createContext<{
  language: Language;
  setLanguage: (lang: Language) => void;
  t: Translations;
} | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [languageState, setLanguageState] = useState<Language>("en");
  const language: Language = (ENABLED_LANGUAGES as readonly string[]).includes(languageState)
    ? languageState
    : "en";
  const setLanguage = (lang: Language) => {
    if ((ENABLED_LANGUAGES as readonly string[]).includes(lang)) setLanguageState(lang);
  };
  return (
    <LanguageContext.Provider value={{ language, setLanguage, t: translations[language] }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useLanguage must be used within a LanguageProvider");
  return context;
}
