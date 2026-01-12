"use client";

import { useGoogleLogin } from "@react-oauth/google";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import api from "@/lib/api";

interface GoogleAuthButtonProps {
  role?: "student" | "teacher"; // Optional: pass role if known (e.g. from register page)
}

export function GoogleAuthButton({ role = "student" }: GoogleAuthButtonProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const login = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setIsLoading(true);
      try {
        // We get an access token from Google, but for security, we want an ID Token.
        // However, the standard 'implicit' flow gives an access token.
        // A simpler way with this library for ID Tokens is 'flow: "auth-code"' or simply sending the access token 
        // and letting backend verify it via Google UserInfo API.
        
        // Let's stick to the simplest flow: Send the Token to Backend
        const res = await api.post("/auth/google", {
            token: tokenResponse.access_token, // Send the access token
            role: role.toUpperCase() // "STUDENT" or "TEACHER"
        });

        // Save backend JWT
        localStorage.setItem("token", res.data.token);
        localStorage.setItem("user", JSON.stringify(res.data.user));

        // Redirect
        if (res.data.user.role === "TEACHER") {
          router.push("/dashboard/teacher");
        } else {
          router.push("/dashboard/student");
        }
      } catch (error) {
        console.error("Google Login Failed", error);
        alert("Google Sign-In failed. Please try again.");
      } finally {
        setIsLoading(false);
      }
    },
    onError: () => {
      alert("Google Login Failed");
    }
  });

  return (
    <>
        <div className="relative my-4">
            <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
            <div className="relative flex justify-center text-xs uppercase"><span className="bg-background px-2 text-muted-foreground">Or continue with</span></div>
        </div>
        <Button 
            variant="outline" 
            className="w-full" 
            onClick={() => login()} 
            disabled={isLoading}
            type="button" // Prevent form submission
        >
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : (
                 <svg className="mr-2 h-4 w-4" aria-hidden="true" focusable="false" data-prefix="fab" data-icon="google" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 488 512">
                 <path fill="currentColor" d="M488 261.8C488 403.3 391.1 504 248 504 110.8 504 0 393.2 0 256S110.8 8 248 8c66.8 0 123 24.5 166.3 64.9l-67.5 64.9C258.5 52.6 94.3 116.6 94.3 256c0 86.5 69.1 156.6 153.7 156.6 98.2 0 135-70.4 140.8-106.9H248v-85.3h236.1c2.3 12.7 3.9 24.9 3.9 41.4z"></path>
             </svg>
            )}
            Google
        </Button>
    </>
  );
}