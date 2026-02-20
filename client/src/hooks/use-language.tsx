import { createContext, useContext, useState, ReactNode } from "react";

type Language = "en" | "es";

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
      amountLabel: "Amount ($)",
      cancel: "Cancel",
      add: "Add",
      save: "Save Changes",
    },
    split: {
      contributions: "Individual Contributions",
      settlement: "Settlement Plan",
      owes: "owes",
      allSettled: "All settled up!",
    },
  },
  es: {
    title: "La App de Asado Ortega",
    subtitle: "Divide la cuenta, mantén la buena onda",
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
      title: "¡Prende la parrilla!",
      subtitle: "Empieza agregando participantes, luego registra los gastos.",
    },
    categories: {
      Meat: "Carne",
      Bread: "Pan",
      Drinks: "Bebidas",
      Charcoal: "Carbón",
      Transportation: "Transporte",
      Other: "Otros",
    },
    modals: {
      addPersonTitle: "Agregar Participante",
      addExpenseTitle: "Registrar Gasto",
      editExpenseTitle: "Editar Gasto",
      nameLabel: "Nombre",
      paidByLabel: "Pagado Por",
      categoryLabel: "Categoría",
      itemLabel: "Descripción del Ítem",
      amountLabel: "Monto ($)",
      cancel: "Cancelar",
      add: "Agregar",
      save: "Guardar Cambios",
    },
    split: {
      contributions: "Contribuciones Individuales",
      settlement: "Plan de Pagos",
      owes: "le debe a",
      allSettled: "¡Todo saldado!",
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
