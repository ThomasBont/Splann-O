import { createContext, useContext, useState, ReactNode } from "react";

export type Language = "en" | "es" | "it" | "nl";

export type CurrencyCode = "EUR" | "USD" | "ARS" | "GBP" | "MXN";

export const CURRENCIES: {
  code: CurrencyCode;
  symbol: string;
  label: string;
  labelEs: string;
  labelIt: string;
  labelNl: string;
}[] = [
  { code: "EUR", symbol: "€", label: "Euro", labelEs: "Euro", labelIt: "Euro", labelNl: "Euro" },
  { code: "USD", symbol: "$", label: "US Dollar", labelEs: "Dólar", labelIt: "Dollaro", labelNl: "Dollar" },
  { code: "ARS", symbol: "AR$", label: "Argentine Peso", labelEs: "Peso Argentino", labelIt: "Peso Argentino", labelNl: "Argentijnse Peso" },
  { code: "GBP", symbol: "£", label: "British Pound", labelEs: "Libra Esterlina", labelIt: "Sterlina", labelNl: "Pond Sterling" },
  { code: "MXN", symbol: "MX$", label: "Mexican Peso", labelEs: "Peso Mexicano", labelIt: "Peso Messicano", labelNl: "Mexicaanse Peso" },
];

export const LANGUAGES: { code: Language; label: string }[] = [
  { code: "en", label: "EN" },
  { code: "es", label: "ES" },
  { code: "it", label: "IT" },
  { code: "nl", label: "NL" },
];

export const EUR_RATES: Record<CurrencyCode, number> = {
  EUR: 1,
  USD: 1.08,
  ARS: 1050,
  GBP: 0.85,
  MXN: 18.0,
};

export function convertCurrency(amount: number, from: CurrencyCode, to: CurrencyCode): number {
  const inEUR = amount / EUR_RATES[from];
  return inEUR * EUR_RATES[to];
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
    split: string;
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
  };
  split: {
    contributions: string;
    settlement: string;
    owes: string;
    allSettled: string;
    overpaid: string;
    underpaid: string;
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
    currencyConversion: string;
    approxRates: string;
    yourShare: string;
    allowOptInExpenses: string;
    allowOptInExpensesDesc: string;
    imIn: string;
    imOut: string;
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
    birthday: string;
    otherParty: string;
    cityTrip: string;
    cinema: string;
    themePark: string;
    dayOut: string;
    otherTrip: string;
  };
  discover: {
    title: string;
    empty: string;
    creator: string;
    view: string;
    join: string;
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
    tabs: { expenses: "Expenses", split: "Split Check" },
    emptyState: {
      title: "Create an event",
      subtitle: "Add participants and log expenses to split costs.",
    },
    categories: {
      Meat: "Meat", Bread: "Bread", Drinks: "Drinks",
      Charcoal: "Charcoal", Transportation: "Transportation", Other: "Other",
      Food: "Food", Transport: "Transport", Tickets: "Tickets", Accommodation: "Accommodation",
    },
    modals: {
      addPersonTitle: "Add Participant", addExpenseTitle: "Record Expense",
      editExpenseTitle: "Edit Expense", nameLabel: "Name", paidByLabel: "Paid By",
      categoryLabel: "Category", itemLabel: "Item Description", amountLabel: "Amount",
      cancel: "Cancel", add: "Add", save: "Save Changes",
    },
    split: {
      contributions: "Individual Contributions", settlement: "Settlement Plan",
      owes: "owes", allSettled: "All settled up!", overpaid: "Overpaid", underpaid: "Underpaid",
    },
    bbq: {
      allBarbecues: "Barbecues", newBarbecue: "New Barbecue", bbqName: "BBQ Name",
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
      currencyConversion: "In Other Currencies", approxRates: "Approximate rates",
      yourShare: "Your share",
      allowOptInExpenses: "Allow participants to choose which expenses they pay for",
      allowOptInExpensesDesc: "Participants can opt in or out per expense (e.g. skip meat or transport).",
      imIn: "I'm in",
      imOut: "I'm out",
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
      birthday: "Birthday",
      otherParty: "Other",
      cityTrip: "City trip",
      cinema: "Cinema",
      themePark: "Theme park",
      dayOut: "Day out",
      otherTrip: "Other",
    },
    discover: {
      title: "Discover",
      empty: "No public events yet.",
      creator: "by",
      view: "View",
      join: "Join",
    },
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
    tabs: { expenses: "Gastos", split: "Dividir Cuenta" },
    emptyState: {
      title: "Crear un evento",
      subtitle: "Agregá participantes y cargá gastos para repartir costos.",
    },
    categories: {
      Meat: "Carne", Bread: "Pan", Drinks: "Bebidas",
      Charcoal: "Carbón", Transportation: "Transporte", Other: "Otros",
      Food: "Comida", Transport: "Transporte", Tickets: "Entradas", Accommodation: "Alojamiento",
    },
    modals: {
      addPersonTitle: "Agregar Participante", addExpenseTitle: "Registrar Gasto",
      editExpenseTitle: "Editar Gasto", nameLabel: "Nombre", paidByLabel: "Pagado Por",
      categoryLabel: "Categoría", itemLabel: "Descripción del Ítem", amountLabel: "Monto",
      cancel: "Cancelar", add: "Agregar", save: "Guardar Cambios",
    },
    split: {
      contributions: "Contribuciones Individuales", settlement: "Plan de Pagos",
      owes: "le debe a", allSettled: "¡Todo saldado!", overpaid: "Pagó de más", underpaid: "Debe",
    },
    bbq: {
      allBarbecues: "Asados", newBarbecue: "Nuevo Asado", bbqName: "Nombre del Asado",
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
      currencyConversion: "En Otras Monedas", approxRates: "Tasas aproximadas",
      yourShare: "Tu cuota",
      allowOptInExpenses: "Permitir que los participantes elijan en qué gastos participan",
      allowOptInExpensesDesc: "Cada participante puede sumarse o no a cada gasto (ej. carne o transporte).",
      imIn: "Me sumo",
      imOut: "No me sumo",
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
      birthday: "Cumpleaños",
      otherParty: "Otro",
      cityTrip: "Viaje ciudad",
      cinema: "Cine",
      themePark: "Parque de diversiones",
      dayOut: "Día afuera",
      otherTrip: "Otro",
    },
    discover: {
      title: "Descubrir",
      empty: "Aún no hay eventos públicos.",
      creator: "por",
      view: "Ver",
      join: "Unirse",
    },
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
    tabs: { expenses: "Spese", split: "Divisione" },
    emptyState: {
      title: "Crea un evento",
      subtitle: "Aggiungi partecipanti e registra le spese per dividere i costi.",
    },
    categories: {
      Meat: "Carne", Bread: "Pane", Drinks: "Bevande",
      Charcoal: "Carbone", Transportation: "Trasporto", Other: "Altro",
      Food: "Cibo", Transport: "Trasporto", Tickets: "Biglietti", Accommodation: "Alloggio",
    },
    modals: {
      addPersonTitle: "Aggiungi Partecipante", addExpenseTitle: "Registra Spesa",
      editExpenseTitle: "Modifica Spesa", nameLabel: "Nome", paidByLabel: "Pagato Da",
      categoryLabel: "Categoria", itemLabel: "Descrizione", amountLabel: "Importo",
      cancel: "Annulla", add: "Aggiungi", save: "Salva",
    },
    split: {
      contributions: "Contributi Individuali", settlement: "Piano di Rimborso",
      owes: "deve a", allSettled: "Tutto saldato!", overpaid: "Eccedenza", underpaid: "Debito",
    },
    bbq: {
      allBarbecues: "Barbecue", newBarbecue: "Nuovo BBQ", bbqName: "Nome BBQ",
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
      currencyConversion: "In Altre Valute", approxRates: "Tassi approssimativi",
      yourShare: "La tua quota",
      allowOptInExpenses: "Permetti ai partecipanti di scegliere per quali spese pagare",
      allowOptInExpensesDesc: "Ogni partecipante può optare per ogni spesa (es. carne o trasporto).",
      imIn: "Partecipo",
      imOut: "Non partecipo",
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
      dinnerParty: "Diner",
      birthday: "Verjaardag",
      otherParty: "Anders",
      cityTrip: "Stedentrip",
      cinema: "Bioscoop",
      themePark: "Attractiepark",
      dayOut: "Dagje uit",
      otherTrip: "Anders",
    },
    discover: {
      title: "Scopri",
      empty: "Nessun evento pubblico ancora.",
      creator: "da",
      view: "Apri",
      join: "Unisciti",
    },
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
    tabs: { expenses: "Uitgaven", split: "Verdeling" },
    emptyState: {
      title: "Maak een evenement",
      subtitle: "Voeg deelnemers toe en log uitgaven om kosten te verdelen.",
    },
    categories: {
      Meat: "Vlees", Bread: "Brood", Drinks: "Drankjes",
      Charcoal: "Houtskool", Transportation: "Transport", Other: "Overig",
      Food: "Eten", Transport: "Vervoer", Tickets: "Tickets", Accommodation: "Accommodatie",
    },
    modals: {
      addPersonTitle: "Deelnemer Toevoegen", addExpenseTitle: "Uitgave Registreren",
      editExpenseTitle: "Uitgave Bewerken", nameLabel: "Naam", paidByLabel: "Betaald Door",
      categoryLabel: "Categorie", itemLabel: "Omschrijving", amountLabel: "Bedrag",
      cancel: "Annuleren", add: "Toevoegen", save: "Opslaan",
    },
    split: {
      contributions: "Individuele Bijdragen", settlement: "Betaalplan",
      owes: "is verschuldigd aan", allSettled: "Alles verrekend!", overpaid: "Te veel betaald", underpaid: "Te weinig betaald",
    },
    bbq: {
      allBarbecues: "Barbecues", newBarbecue: "Nieuwe BBQ", bbqName: "BBQ Naam",
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
      currencyConversion: "In Andere Valuta's", approxRates: "Geschatte koersen",
      yourShare: "Jouw aandeel",
      allowOptInExpenses: "Laat deelnemers kiezen voor welke uitgaven ze betalen",
      allowOptInExpensesDesc: "Deelnemers kunnen per uitgave opt-in of opt-out (bijv. vlees of vervoer).",
      imIn: "Ik doe mee",
      imOut: "Ik doe niet mee",
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
      birthday: "Verjaardag",
      otherParty: "Anders",
      cityTrip: "Stedentrip",
      cinema: "Bioscoop",
      themePark: "Attractiepark",
      dayOut: "Dagje uit",
      otherTrip: "Anders",
    },
    discover: {
      title: "Ontdekken",
      empty: "Nog geen openbare evenementen.",
      creator: "door",
      view: "Bekijken",
      join: "Deelnemen",
    },
    tripsComingSoon: "Trips komen binnenkort. Maak voor nu evenementen onder Feesten.",
  },
};

const LanguageContext = createContext<{
  language: Language;
  setLanguage: (lang: Language) => void;
  t: Translations;
} | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>("en");
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
