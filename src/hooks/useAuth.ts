import { useState, useEffect } from "react";

let isLoggedIn = false;
let profilePhoto: string | null = null;
const listeners = new Set<() => void>();

const notifyListeners = () => {
  listeners.forEach((listener) => listener());
};

export const authStore = {
  getSnapshot: () => ({ isLoggedIn, profilePhoto }),
  login: () => {
    isLoggedIn = true;
    notifyListeners();
  },
  logout: () => {
    isLoggedIn = false;
    profilePhoto = null;
    notifyListeners();
  },
  updatePhoto: (dataUrl: string) => {
    profilePhoto = dataUrl;
    notifyListeners();
  },
  subscribe: (listener: () => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }
};

export function useAuth() {
  const [state, setState] = useState(authStore.getSnapshot());

  useEffect(() => {
    return authStore.subscribe(() => {
      setState(authStore.getSnapshot());
    });
  }, []);

  return {
    isLoggedIn: state.isLoggedIn,
    profilePhoto: state.profilePhoto,
    login: authStore.login,
    logout: authStore.logout,
    updatePhoto: authStore.updatePhoto
  };
}
