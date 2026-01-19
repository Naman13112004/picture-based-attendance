// store/useAuth.ts
import { create } from "zustand";

type Role = "STUDENT" | "TEACHER" | null;

interface AuthState {
  token: string | null;
  role: Role;
  setAuth: (token: string, role: Role) => void;
  clearAuth: () => void;
}

export const useAuth = create<AuthState>((set) => ({
  token: null,
  role: null,
  setAuth: (token, role) => {
    localStorage.setItem("token", token);
    localStorage.setItem("user", JSON.stringify({ role }));
    set({ token, role });
  },
  clearAuth: () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    set({ token: null, role: null });
  },
}));
