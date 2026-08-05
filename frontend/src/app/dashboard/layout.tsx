"use client";

import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { useAuth } from "@/store/useAuth";
import { Loader2 } from "lucide-react";
import { useEffect } from "react";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { hasHydrated, hydrate } = useAuth();

  useEffect(() => {
    if (!hasHydrated) {
      hydrate();
    }
  }, [hasHydrated, hydrate]);
  
  // Simple check to determine role based on URL for MVP
  const isTeacher = pathname.includes("/teacher");
  const role = isTeacher ? "teacher" : "student";

  if (!hasHydrated) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
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