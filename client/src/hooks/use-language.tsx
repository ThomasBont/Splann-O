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
    usernameHint: string;
    passwordHint: string;
    forgotPassword: string;
    forgotPasswordTitle: string;
    forgotPasswordSubtitle: string;
    sendResetLink: string;
    checkEmail: string;
    checkEmailDesc: string;
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
    host: string;
  };
}

const translations: Record<Language, Translations> = {
  en: {
    title: "The Ortega Asado App",
    subtitle: "Split the bill, keep the vibes",
    addPerson: "Add Person",
    addExpense: "Add Expense",
    totalSpent: "Total Spent",
    participants: "Participants",
    expenses: "Expenses",
    fairShare: "Fair Share",
    tabs: { expenses: "Expenses", split: "Split Check" },
    emptyState: {
      title: "Fire up the grill!",
      subtitle: "Start by adding participants, then log your expenses.",
    },
    categories: {
      Meat: "Meat", Bread: "Bread", Drinks: "Drinks",
      Charcoal: "Charcoal", Transportation: "Transportation", Other: "Other",
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
      selectBbq: "Select a barbecue to get started", noBbqs: "No barbecues yet",
      noBbqsSubtitle: "Create your first barbecue event to start tracking expenses.",
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
    },
    auth: {
      login: "Log In", register: "Sign Up", logout: "Log Out",
      username: "Username", email: "Email address", displayName: "Your name",
      displayNamePlaceholder: "e.g. Carlos (optional)",
      password: "Password", confirmPassword: "Confirm Password",
      loginTitle: "Welcome back", registerTitle: "Create account",
      welcomeBack: "Sign in to continue", createAccount: "Join the asado",
      alreadyHaveAccount: "Already have an account?", dontHaveAccount: "Don't have an account?",
      usernameTaken: "That username is already taken",
      emailTaken: "An account with that email already exists",
      invalidCredentials: "Invalid username or password",
      passwordsNoMatch: "Passwords do not match",
      loggedInAs: "Signed in as", profile: "Profile",
      usernameHint: "2–30 characters, letters/numbers/_/-",
      passwordHint: "At least 4 characters",
      forgotPassword: "Forgot password?",
      forgotPasswordTitle: "Reset your password",
      forgotPasswordSubtitle: "Enter your email and we'll send you a reset link",
      sendResetLink: "Send reset link",
      checkEmail: "Check your email",
      checkEmailDesc: "We've sent a password reset link to your email address.",
      newPassword: "New password",
      resetPasswordBtn: "Reset password",
      passwordResetSuccess: "Password reset! You can now log in.",
      backToLogin: "Back to login",
      tokenInvalid: "This reset link is invalid or has expired.",
    },
    user: {
      setupTitle: "Welcome! Pick a username", setupSubtitle: "Your name identifies you across barbecues.",
      usernamePlaceholder: "e.g. Carlos", confirm: "Let's Go!",
      joinBbq: "Join", pending: "Pending", joined: "Joined",
      pendingRequests: "Join Requests", accept: "Accept", reject: "Reject",
      leave: "Leave", hi: "Hi", changeUsername: "Change name", host: "Host",
    },
  },
  es: {
    title: "La App de Asado Ortega",
    subtitle: "Dividí la cuenta, mantenéla buena onda",
    addPerson: "Agregar Persona",
    addExpense: "Agregar Gasto",
    totalSpent: "Total Gastado",
    participants: "Participantes",
    expenses: "Gastos",
    fairShare: "Cuota Justa",
    tabs: { expenses: "Gastos", split: "Dividir Cuenta" },
    emptyState: {
      title: "¡Prendé la parrilla!",
      subtitle: "Empezá agregando participantes, luego registrá los gastos.",
    },
    categories: {
      Meat: "Carne", Bread: "Pan", Drinks: "Bebidas",
      Charcoal: "Carbón", Transportation: "Transporte", Other: "Otros",
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
      selectBbq: "Seleccioná un asado para empezar", noBbqs: "No hay asados todavía",
      noBbqsSubtitle: "Creá tu primer asado para empezar a registrar gastos.",
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
    },
    auth: {
      login: "Iniciar Sesión", register: "Registrarse", logout: "Cerrar Sesión",
      username: "Usuario", email: "Correo electrónico", displayName: "Tu nombre",
      displayNamePlaceholder: "ej. Carlos (opcional)",
      password: "Contraseña", confirmPassword: "Confirmar Contraseña",
      loginTitle: "Bienvenido de vuelta", registerTitle: "Crear cuenta",
      welcomeBack: "Iniciá sesión para continuar", createAccount: "Unite al asado",
      alreadyHaveAccount: "¿Ya tenés cuenta?", dontHaveAccount: "¿No tenés cuenta?",
      usernameTaken: "Ese nombre de usuario ya está en uso",
      emailTaken: "Ya existe una cuenta con ese correo",
      invalidCredentials: "Usuario o contraseña inválidos",
      passwordsNoMatch: "Las contraseñas no coinciden",
      loggedInAs: "Sesión iniciada como", profile: "Perfil",
      usernameHint: "2–30 caracteres, letras/números/_/-",
      passwordHint: "Al menos 4 caracteres",
      forgotPassword: "¿Olvidaste tu contraseña?",
      forgotPasswordTitle: "Recuperar contraseña",
      forgotPasswordSubtitle: "Ingresá tu email y te enviaremos un enlace",
      sendResetLink: "Enviar enlace",
      checkEmail: "Revisá tu email",
      checkEmailDesc: "Te enviamos un enlace para restablecer tu contraseña.",
      newPassword: "Nueva contraseña",
      resetPasswordBtn: "Restablecer contraseña",
      passwordResetSuccess: "¡Contraseña restablecida! Ya podés iniciar sesión.",
      backToLogin: "Volver al inicio",
      tokenInvalid: "Este enlace es inválido o expiró.",
    },
    user: {
      setupTitle: "¡Bienvenido! Elegí un nombre", setupSubtitle: "Tu nombre te identificará en los asados.",
      usernamePlaceholder: "ej. Carlos", confirm: "¡Vamos!",
      joinBbq: "Unirse", pending: "Pendiente", joined: "Unido",
      pendingRequests: "Solicitudes", accept: "Aceptar", reject: "Rechazar",
      leave: "Salir", hi: "Hola", changeUsername: "Cambiar nombre", host: "Anfitrión",
    },
  },
  it: {
    title: "The Ortega Asado App",
    subtitle: "Dividi il conto, goditi il momento",
    addPerson: "Aggiungi Persona",
    addExpense: "Aggiungi Spesa",
    totalSpent: "Totale Speso",
    participants: "Partecipanti",
    expenses: "Spese",
    fairShare: "Quota Equa",
    tabs: { expenses: "Spese", split: "Divisione" },
    emptyState: {
      title: "Accendi la griglia!",
      subtitle: "Inizia aggiungendo partecipanti, poi registra le spese.",
    },
    categories: {
      Meat: "Carne", Bread: "Pane", Drinks: "Bevande",
      Charcoal: "Carbone", Transportation: "Trasporto", Other: "Altro",
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
      selectBbq: "Seleziona un barbecue per iniziare", noBbqs: "Nessun barbecue ancora",
      noBbqsSubtitle: "Crea il tuo primo evento barbecue.",
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
    },
    auth: {
      login: "Accedi", register: "Registrati", logout: "Esci",
      username: "Nome utente", email: "Indirizzo email", displayName: "Il tuo nome",
      displayNamePlaceholder: "es. Carlo (opzionale)",
      password: "Password", confirmPassword: "Conferma Password",
      loginTitle: "Bentornato", registerTitle: "Crea account",
      welcomeBack: "Accedi per continuare", createAccount: "Unisciti all'asado",
      alreadyHaveAccount: "Hai già un account?", dontHaveAccount: "Non hai un account?",
      usernameTaken: "Questo nome utente è già in uso",
      emailTaken: "Esiste già un account con questa email",
      invalidCredentials: "Nome utente o password non validi",
      passwordsNoMatch: "Le password non corrispondono",
      loggedInAs: "Connesso come", profile: "Profilo",
      usernameHint: "2–30 caratteri, lettere/numeri/_/-",
      passwordHint: "Almeno 4 caratteri",
      forgotPassword: "Password dimenticata?",
      forgotPasswordTitle: "Reimposta la password",
      forgotPasswordSubtitle: "Inserisci la tua email e ti invieremo un link",
      sendResetLink: "Invia link",
      checkEmail: "Controlla la tua email",
      checkEmailDesc: "Abbiamo inviato un link per reimpostare la password.",
      newPassword: "Nuova password",
      resetPasswordBtn: "Reimposta password",
      passwordResetSuccess: "Password reimpostata! Ora puoi accedere.",
      backToLogin: "Torna al login",
      tokenInvalid: "Questo link non è valido o è scaduto.",
    },
    user: {
      setupTitle: "Benvenuto! Scegli un nome", setupSubtitle: "Il tuo nome ti identificherà nei barbecue.",
      usernamePlaceholder: "es. Carlo", confirm: "Andiamo!",
      joinBbq: "Unisciti", pending: "In attesa", joined: "Unito",
      pendingRequests: "Richieste", accept: "Accetta", reject: "Rifiuta",
      leave: "Esci", hi: "Ciao", changeUsername: "Cambia nome", host: "Organizzatore",
    },
  },
  nl: {
    title: "The Ortega Asado App",
    subtitle: "Deel de rekening, geniet van het moment",
    addPerson: "Persoon Toevoegen",
    addExpense: "Uitgave Toevoegen",
    totalSpent: "Totaal Besteed",
    participants: "Deelnemers",
    expenses: "Uitgaven",
    fairShare: "Eerlijk Aandeel",
    tabs: { expenses: "Uitgaven", split: "Verdeling" },
    emptyState: {
      title: "Steek de grill aan!",
      subtitle: "Begin met het toevoegen van deelnemers, dan registreer je de uitgaven.",
    },
    categories: {
      Meat: "Vlees", Bread: "Brood", Drinks: "Drankjes",
      Charcoal: "Houtskool", Transportation: "Transport", Other: "Overig",
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
      selectBbq: "Selecteer een barbecue om te beginnen", noBbqs: "Nog geen barbecues",
      noBbqsSubtitle: "Maak je eerste barbecue-evenement aan.",
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
    },
    auth: {
      login: "Inloggen", register: "Registreren", logout: "Uitloggen",
      username: "Gebruikersnaam", email: "E-mailadres", displayName: "Jouw naam",
      displayNamePlaceholder: "bijv. Carlos (optioneel)",
      password: "Wachtwoord", confirmPassword: "Bevestig Wachtwoord",
      loginTitle: "Welkom terug", registerTitle: "Account aanmaken",
      welcomeBack: "Log in om verder te gaan", createAccount: "Doe mee aan het asado",
      alreadyHaveAccount: "Heb je al een account?", dontHaveAccount: "Heb je geen account?",
      usernameTaken: "Die gebruikersnaam is al in gebruik",
      emailTaken: "Er bestaat al een account met dat e-mailadres",
      invalidCredentials: "Ongeldige gebruikersnaam of wachtwoord",
      passwordsNoMatch: "Wachtwoorden komen niet overeen",
      loggedInAs: "Ingelogd als", profile: "Profiel",
      usernameHint: "2–30 tekens, letters/cijfers/_/-",
      passwordHint: "Minimaal 4 tekens",
      forgotPassword: "Wachtwoord vergeten?",
      forgotPasswordTitle: "Wachtwoord herstellen",
      forgotPasswordSubtitle: "Vul je e-mail in en we sturen je een link",
      sendResetLink: "Link versturen",
      checkEmail: "Controleer je e-mail",
      checkEmailDesc: "We hebben een herstelkoppeling naar je e-mailadres gestuurd.",
      newPassword: "Nieuw wachtwoord",
      resetPasswordBtn: "Wachtwoord herstellen",
      passwordResetSuccess: "Wachtwoord hersteld! Je kunt nu inloggen.",
      backToLogin: "Terug naar inloggen",
      tokenInvalid: "Deze link is ongeldig of verlopen.",
    },
    user: {
      setupTitle: "Welkom! Kies een gebruikersnaam", setupSubtitle: "Je naam identificeert je bij barbecues.",
      usernamePlaceholder: "bijv. Carlos", confirm: "Let's Go!",
      joinBbq: "Deelnemen", pending: "In behandeling", joined: "Deelnemer",
      pendingRequests: "Aanvragen", accept: "Accepteren", reject: "Afwijzen",
      leave: "Verlaten", hi: "Hoi", changeUsername: "Naam wijzigen", host: "Gastheer",
    },
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
