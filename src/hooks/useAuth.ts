import { useState, useEffect } from "react";

const STORAGE_KEY = "marido_pra_que_auth";

let authState = {
  isLoggedIn: false,
  profilePhoto: null as string | null,
  userData: {
    name: "Carolina Lima Silva",
    whatsapp: "(21) 98822-1100",
    birthDate: "12/08/1992",
    email: "carolina@email.com"
  }
};

// Initialize from localStorage
try {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    const parsed = JSON.parse(saved);
    authState = {
       isLoggedIn: !!parsed.isLoggedIn,
       profilePhoto: parsed.profilePhoto || null,
       userData: parsed.userData || authState.userData
    };
  }
} catch (e) {
  console.error("Auth storage error:", e);
}

const listeners = new Set<() => void>();

const notifyListeners = () => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(authState));
  listeners.forEach((listener) => listener());
};

export const authStore = {
  getSnapshot: () => ({ ...authState }),
  login: () => {
    authState.isLoggedIn = true;
    notifyListeners();
  },
  logout: () => {
    authState.isLoggedIn = false;
    authState.profilePhoto = null;
    notifyListeners();
  },
  updatePhoto: (dataUrl: string) => {
    authState.profilePhoto = dataUrl;
    notifyListeners();
  },
  updateUserData: (data: typeof authState.userData) => {
    authState.userData = { ...data };
    notifyListeners();
  },
  subscribe: (listener: () => void) => {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
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
    userData: state.userData,
    login: authStore.login,
    logout: authStore.logout,
    updatePhoto: authStore.updatePhoto,
    updateUserData: authStore.updateUserData
  };
}
