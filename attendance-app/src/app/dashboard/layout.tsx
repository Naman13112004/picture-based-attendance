"use client";

import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  // Simple check to determine role based on URL for MVP
  // In production, this comes from the Session/Auth Context
  const isTeacher = pathname.includes("/teacher");
  const role = isTeacher ? "teacher" : "student";

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