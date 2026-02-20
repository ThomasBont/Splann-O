import { createContext, useContext, useState, ReactNode } from "react";

type Language = "en" | "es";

export type CurrencyCode = "EUR" | "USD" | "ARS" | "GBP" | "MXN";

export const CURRENCIES: { code: CurrencyCode; symbol: string; label: string; labelEs: string }[] = [
  { code: "EUR", symbol: "\u20AC", label: "Euro", labelEs: "Euro" },
  { code: "USD", symbol: "$", label: "US Dollar", labelEs: "D\u00F3lar" },
  { code: "ARS", symbol: "AR$", label: "Argentine Peso", labelEs: "Peso Argentino" },
  { code: "GBP", symbol: "\u00A3", label: "British Pound", labelEs: "Libra Esterlina" },
  { code: "MXN", symbol: "MX$", label: "Mexican Peso", labelEs: "Peso Mexicano" },
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
    myBarbecues: string;
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
      myBarbecues: "My Barbecues",
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
      myBarbecues: "Mis Asados",
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
