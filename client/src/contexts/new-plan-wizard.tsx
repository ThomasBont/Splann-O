import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

type NewPlanWizardStep = "BASICS" | "TYPE" | "SUBCATEGORY";

type NewPlanWizardContextValue = {
  isNewPlanWizardOpen: boolean;
  newPlanWizardStep: NewPlanWizardStep;
  openNewPlanWizard: (initialStep?: NewPlanWizardStep) => void;
  closeNewPlanWizard: () => void;
};

const NewPlanWizardContext = createContext<NewPlanWizardContextValue | null>(null);

export function NewPlanWizardProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState<NewPlanWizardStep>("TYPE");

  const value = useMemo<NewPlanWizardContextValue>(
    () => ({
      isNewPlanWizardOpen: isOpen,
      newPlanWizardStep: step,
      openNewPlanWizard: (initialStep = "TYPE") => {
        setStep(initialStep);
        setIsOpen(true);
      },
      closeNewPlanWizard: () => {
        setIsOpen(false);
        setStep("TYPE");
      },
    }),
    [isOpen, step],
  );

  return <NewPlanWizardContext.Provider value={value}>{children}</NewPlanWizardContext.Provider>;
}

export function useNewPlanWizard() {
  const context = useContext(NewPlanWizardContext);
  if (!context) {
    throw new Error("useNewPlanWizard must be used within NewPlanWizardProvider");
  }
  return context;
}
