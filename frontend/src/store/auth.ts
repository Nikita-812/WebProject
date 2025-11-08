import { create } from "zustand";
import type { AuthResponse, User } from "../types";

interface AuthState {
  token: string | null;
  user: User | null;
  setAuth: (payload: AuthResponse) => void;
  clear: () => void;
}

const storageKey = "kanban.auth";

const readFromStorage = (): AuthResponse | null => {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(storageKey);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthResponse;
  } catch {
    return null;
  }
};

const initial = readFromStorage();

export const useAuthStore = create<AuthState>((set) => ({
  token: initial?.access_token ?? null,
  user: initial?.user ?? null,
  setAuth: (payload) => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(storageKey, JSON.stringify(payload));
    }
    set({ token: payload.access_token, user: payload.user });
  },
  clear: () => {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(storageKey);
    }
    set({ token: null, user: null });
  },
}));

export const authToken = (): string | null => useAuthStore.getState().token;
