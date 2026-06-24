"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { useAuth } from "@/store/useAuth";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { token, hasHydrated } = useAuth();
  
  // Simple check to determine role based on URL for MVP
  const isTeacher = pathname.includes("/teacher");
  const role = isTeacher ? "teacher" : "student";

  useEffect(() => {
    if (hasHydrated && !token) {
      router.replace("/login");
    }
  }, [hasHydrated, token, router]);

  if (!hasHydrated || !token) {
    return null; // Don't render anything while checking auth
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden">
      {/* Sidebar Component */}
      <Sidebar role={role} />
      
      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto bg-muted/20 p-8">
        {children}
      </main>
    </div>
  );
}