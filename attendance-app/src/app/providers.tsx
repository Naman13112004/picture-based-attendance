"use client";

import { GoogleOAuthProvider } from "@react-oauth/google";
import { ThemeProvider } from "@/components/theme-provider";

import { useEffect } from "react";
import { useAuth } from "@/store/useAuth";

export function Providers({ children }: { children: React.ReactNode }) {
  const setAuth = useAuth((s) => s.setAuth);
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";

  useEffect(() => {
    const token = localStorage.getItem("token");
    const user = localStorage.getItem("user");

    if (token && user) {
      setAuth(token, JSON.parse(user).role);
    }
  }, []);

  return (
    <GoogleOAuthProvider clientId={clientId}>
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
      >
        {children}
      </ThemeProvider>
    </GoogleOAuthProvider>
  );
}