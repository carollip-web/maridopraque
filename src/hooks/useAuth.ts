import { useState, useEffect } from "react";

let isLoggedIn = false;
const listeners = new Set<() => void>();

const notifyListeners = () => {
  listeners.forEach((listener) => listener());
};

export const authStore = {
  getSnapshot: () => isLoggedIn,
  login: () => {
    isLoggedIn = true;
    notifyListeners();
  },
  logout: () => {
    isLoggedIn = false;
    notifyListeners();
  },
  subscribe: (listener: () => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }
};

export function useAuth() {
  const [loggedIn, setLoggedIn] = useState(authStore.getSnapshot());

  useEffect(() => {
    return authStore.subscribe(() => {
      setLoggedIn(authStore.getSnapshot());
    });
  }, []);

  return {
    isLoggedIn: loggedIn,
    login: authStore.login,
    logout: authStore.logout
  };
}
