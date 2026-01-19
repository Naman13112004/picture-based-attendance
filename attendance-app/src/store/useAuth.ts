// store/useAuth.ts
import { create } from "zustand";

type Role = "STUDENT" | "TEACHER" | null;

interface AuthState {
  token: string | null;
  role: Role;
  hasHydrated: boolean;
  hydrate: () => void;
  clearAuth: () => void;
}

export const useAuth = create<AuthState>((set) => ({
  token: null,
  role: null,
  hasHydrated: false,

  hydrate: () => {
    if (typeof window === "undefined") return;

    const token = localStorage.getItem("token");
    const user = localStorage.getItem("user");

    const role: Role = user ? JSON.parse(user).role : null;

    set({
      token,
      role,
      hasHydrated: true,
    });
  },

  clearAuth: () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    set({ token: null, role: null });
  },
}));
