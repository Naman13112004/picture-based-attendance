// store/useAuth.ts
import { create } from "zustand";
import Cookies from "js-cookie";

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

    const token = Cookies.get("token");
    const userStr = Cookies.get("user");

    let role: Role = null;
    if (userStr) {
        try {
            role = JSON.parse(userStr).role;
        } catch (e) {
            console.error("Failed to parse user cookie", e);
        }
    }

    set({
      token: token || null,
      role,
      hasHydrated: true,
    });
  },

  clearAuth: () => {
    Cookies.remove("token");
    Cookies.remove("user");
    set({ token: null, role: null });
  },
}));
