import LoginTabs from "@/components/auth/login-tabs";

export default function LoginPage() {
  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-4rem)] bg-muted/40 px-4 py-8">
      <LoginTabs />
    </div>
  );
}