import LoginTabs from "@/components/auth/login-tabs";
import { Suspense } from "react";

export default function LoginPage() {
  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-4rem)] bg-muted/40 px-4 py-8">
      <Suspense fallback={<p>Loading...</p>}>
        <LoginTabs />
      </Suspense>
    </div>
  );
}