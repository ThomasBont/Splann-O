import { useState } from "react";

const STORAGE_KEY = "bbq-username";

export function useUser() {
  const [username, setUsernameState] = useState<string | null>(() => {
    return localStorage.getItem(STORAGE_KEY);
  });

  const setUsername = (name: string) => {
    const trimmed = name.trim();
    localStorage.setItem(STORAGE_KEY, trimmed);
    setUsernameState(trimmed);
  };

  const clearUsername = () => {
    localStorage.removeItem(STORAGE_KEY);
    setUsernameState(null);
  };

  return { username, setUsername, clearUsername };
}
