import { useState, useCallback } from "react";

/**
 * Hook for managing modal open/close state.
 * Prepares the app for a global modal manager later.
 */
export function useModalState(initialOpen = false) {
  const [open, setOpen] = useState(initialOpen);

  const openModal = useCallback(() => setOpen(true), []);
  const closeModal = useCallback(() => setOpen(false), []);

  return {
    open,
    setOpen,
    openModal,
    closeModal,
    onOpenChange: setOpen,
  };
}

/**
 * Hook for managing multiple modals by ID.
 * Use for future global modal manager.
 */
export function useModalManager<T extends string = string>() {
  const [openIds, setOpenIds] = useState<Set<T>>(new Set());

  const openModal = useCallback((id: T) => {
    setOpenIds((prev) => new Set(prev).add(id));
  }, []);

  const closeModal = useCallback((id: T) => {
    setOpenIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const isOpen = useCallback(
    (id: T) => openIds.has(id),
    [openIds]
  );

  return {
    openModal,
    closeModal,
    isOpen,
    openIds,
  };
}
