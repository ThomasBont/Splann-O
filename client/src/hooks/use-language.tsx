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
  { code: "EUR", symbol: "\u20AC", label: "Euro", labelEs: "Euro", labelIt: "Euro", labelNl: "Euro" },
  { code: "USD", symbol: "$", label: "US Dollar", labelEs: "D\u00F3lar", labelIt: "Dollaro", labelNl: "Dollar" },
  { code: "ARS", symbol: "AR$", label: "Argentine Peso", labelEs: "Peso Argentino", labelIt: "Peso Argentino", labelNl: "Argentijnse Peso" },
  { code: "GBP", symbol: "\u00A3", label: "British Pound", labelEs: "Libra Esterlina", labelIt: "Sterlina", labelNl: "Pond Sterling" },
  { code: "MXN", symbol: "MX$", label: "Mexican Peso", labelEs: "Peso Mexicano", labelIt: "Peso Messicano", labelNl: "Mexicaanse Peso" },
];

export const LANGUAGES: { code: Language; label: string }[] = [
  { code: "en", label: "EN" },
  { code: "es", label: "ES" },
  { code: "it", label: "IT" },
  { code: "nl", label: "NL" },
];

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
    tabs: {
      expenses: "Expenses",
      split: "Split Check",
    },
    emptyState: {
      title: "Fire up the grill!",
      subtitle: "Start by adding participants, then log your expenses.",
    },
    categories: {
      Meat: "Meat",
      Bread: "Bread",
      Drinks: "Drinks",
      Charcoal: "Charcoal",
      Transportation: "Transportation",
      Other: "Other",
    },
    modals: {
      addPersonTitle: "Add Participant",
      addExpenseTitle: "Record Expense",
      editExpenseTitle: "Edit Expense",
      nameLabel: "Name",
      paidByLabel: "Paid By",
      categoryLabel: "Category",
      itemLabel: "Item Description",
      amountLabel: "Amount",
      cancel: "Cancel",
      add: "Add",
      save: "Save Changes",
    },
    split: {
      contributions: "Individual Contributions",
      settlement: "Settlement Plan",
      owes: "owes",
      allSettled: "All settled up!",
      overpaid: "Overpaid",
      underpaid: "Underpaid",
    },
    bbq: {
      allBarbecues: "Barbecues",
      newBarbecue: "New Barbecue",
      bbqName: "BBQ Name",
      date: "Date",
      currency: "Currency",
      create: "Create",
      delete: "Delete",
      selectBbq: "Select a barbecue to get started",
      noBbqs: "No barbecues yet",
      noBbqsSubtitle: "Create your first barbecue event to start tracking expenses.",
      breakdown: "Breakdown",
      hostedBy: "Hosted by",
      you: "you",
    },
    user: {
      setupTitle: "Welcome! Pick a username",
      setupSubtitle: "Your name will identify you across barbecues.",
      usernamePlaceholder: "e.g. Carlos",
      confirm: "Let's Go!",
      joinBbq: "Join",
      pending: "Pending",
      joined: "Joined",
      pendingRequests: "Join Requests",
      accept: "Accept",
      reject: "Reject",
      leave: "Leave",
      hi: "Hi",
      changeUsername: "Change name",
      host: "Host",
    },
  },
  es: {
    title: "La App de Asado Ortega",
    subtitle: "Divide la cuenta, manten\u00E9 la buena onda",
    addPerson: "Agregar Persona",
    addExpense: "Agregar Gasto",
    totalSpent: "Total Gastado",
    participants: "Participantes",
    expenses: "Gastos",
    fairShare: "Cuota Justa",
    tabs: {
      expenses: "Gastos",
      split: "Dividir Cuenta",
    },
    emptyState: {
      title: "\u00A1Prend\u00E9 la parrilla!",
      subtitle: "Empez\u00E1 agregando participantes, luego registr\u00E1 los gastos.",
    },
    categories: {
      Meat: "Carne",
      Bread: "Pan",
      Drinks: "Bebidas",
      Charcoal: "Carb\u00F3n",
      Transportation: "Transporte",
      Other: "Otros",
    },
    modals: {
      addPersonTitle: "Agregar Participante",
      addExpenseTitle: "Registrar Gasto",
      editExpenseTitle: "Editar Gasto",
      nameLabel: "Nombre",
      paidByLabel: "Pagado Por",
      categoryLabel: "Categor\u00EDa",
      itemLabel: "Descripci\u00F3n del \u00CDtem",
      amountLabel: "Monto",
      cancel: "Cancelar",
      add: "Agregar",
      save: "Guardar Cambios",
    },
    split: {
      contributions: "Contribuciones Individuales",
      settlement: "Plan de Pagos",
      owes: "le debe a",
      allSettled: "\u00A1Todo saldado!",
      overpaid: "Pag\u00F3 de m\u00E1s",
      underpaid: "Debe",
    },
    bbq: {
      allBarbecues: "Asados",
      newBarbecue: "Nuevo Asado",
      bbqName: "Nombre del Asado",
      date: "Fecha",
      currency: "Moneda",
      create: "Crear",
      delete: "Eliminar",
      selectBbq: "Seleccion\u00E1 un asado para empezar",
      noBbqs: "No hay asados todav\u00EDa",
      noBbqsSubtitle: "Cre\u00E1 tu primer asado para empezar a registrar gastos.",
      breakdown: "Desglose",
      hostedBy: "Organizado por",
      you: "vos",
    },
    user: {
      setupTitle: "\u00A1Bienvenido! Elige un nombre",
      setupSubtitle: "Tu nombre te identificar\u00E1 en los asados.",
      usernamePlaceholder: "ej. Carlos",
      confirm: "\u00A1Vamos!",
      joinBbq: "Unirse",
      pending: "Pendiente",
      joined: "Unido",
      pendingRequests: "Solicitudes",
      accept: "Aceptar",
      reject: "Rechazar",
      leave: "Salir",
      hi: "Hola",
      changeUsername: "Cambiar nombre",
      host: "Anfitri\u00F3n",
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
    tabs: {
      expenses: "Spese",
      split: "Divisione",
    },
    emptyState: {
      title: "Accendi la griglia!",
      subtitle: "Inizia aggiungendo partecipanti, poi registra le spese.",
    },
    categories: {
      Meat: "Carne",
      Bread: "Pane",
      Drinks: "Bevande",
      Charcoal: "Carbone",
      Transportation: "Trasporto",
      Other: "Altro",
    },
    modals: {
      addPersonTitle: "Aggiungi Partecipante",
      addExpenseTitle: "Registra Spesa",
      editExpenseTitle: "Modifica Spesa",
      nameLabel: "Nome",
      paidByLabel: "Pagato Da",
      categoryLabel: "Categoria",
      itemLabel: "Descrizione",
      amountLabel: "Importo",
      cancel: "Annulla",
      add: "Aggiungi",
      save: "Salva",
    },
    split: {
      contributions: "Contributi Individuali",
      settlement: "Piano di Rimborso",
      owes: "deve a",
      allSettled: "Tutto saldato!",
      overpaid: "Eccedenza",
      underpaid: "Debito",
    },
    bbq: {
      allBarbecues: "Barbecue",
      newBarbecue: "Nuovo BBQ",
      bbqName: "Nome BBQ",
      date: "Data",
      currency: "Valuta",
      create: "Crea",
      delete: "Elimina",
      selectBbq: "Seleziona un barbecue per iniziare",
      noBbqs: "Nessun barbecue ancora",
      noBbqsSubtitle: "Crea il tuo primo evento barbecue.",
      breakdown: "Riepilogo",
      hostedBy: "Organizzato da",
      you: "tu",
    },
    user: {
      setupTitle: "Benvenuto! Scegli un nome",
      setupSubtitle: "Il tuo nome ti identificher\u00E0 nei barbecue.",
      usernamePlaceholder: "es. Carlo",
      confirm: "Andiamo!",
      joinBbq: "Unisciti",
      pending: "In attesa",
      joined: "Unito",
      pendingRequests: "Richieste",
      accept: "Accetta",
      reject: "Rifiuta",
      leave: "Esci",
      hi: "Ciao",
      changeUsername: "Cambia nome",
      host: "Organizzatore",
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
    tabs: {
      expenses: "Uitgaven",
      split: "Verdeling",
    },
    emptyState: {
      title: "Steek de grill aan!",
      subtitle: "Begin met het toevoegen van deelnemers, dan registreer je de uitgaven.",
    },
    categories: {
      Meat: "Vlees",
      Bread: "Brood",
      Drinks: "Drankjes",
      Charcoal: "Houtskool",
      Transportation: "Transport",
      Other: "Overig",
    },
    modals: {
      addPersonTitle: "Deelnemer Toevoegen",
      addExpenseTitle: "Uitgave Registreren",
      editExpenseTitle: "Uitgave Bewerken",
      nameLabel: "Naam",
      paidByLabel: "Betaald Door",
      categoryLabel: "Categorie",
      itemLabel: "Omschrijving",
      amountLabel: "Bedrag",
      cancel: "Annuleren",
      add: "Toevoegen",
      save: "Opslaan",
    },
    split: {
      contributions: "Individuele Bijdragen",
      settlement: "Betaalplan",
      owes: "is verschuldigd aan",
      allSettled: "Alles verrekend!",
      overpaid: "Te veel betaald",
      underpaid: "Te weinig betaald",
    },
    bbq: {
      allBarbecues: "Barbecues",
      newBarbecue: "Nieuwe BBQ",
      bbqName: "BBQ Naam",
      date: "Datum",
      currency: "Valuta",
      create: "Aanmaken",
      delete: "Verwijderen",
      selectBbq: "Selecteer een barbecue om te beginnen",
      noBbqs: "Nog geen barbecues",
      noBbqsSubtitle: "Maak je eerste barbecue-evenement aan.",
      breakdown: "Overzicht",
      hostedBy: "Georganiseerd door",
      you: "jij",
    },
    user: {
      setupTitle: "Welkom! Kies een gebruikersnaam",
      setupSubtitle: "Je naam identificeert je bij barbecues.",
      usernamePlaceholder: "bijv. Carlos",
      confirm: "Let's Go!",
      joinBbq: "Deelnemen",
      pending: "In behandeling",
      joined: "Deelnemer",
      pendingRequests: "Aanvragen",
      accept: "Accepteren",
      reject: "Afwijzen",
      leave: "Verlaten",
      hi: "Hoi",
      changeUsername: "Naam wijzigen",
      host: "Gastheer",
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
