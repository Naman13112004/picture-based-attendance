// components/layout/sidebar.tsx
"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation"; // Added useRouter
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { 
  LayoutDashboard, 
  Users, 
  Settings, 
  LogOut, 
  BookOpen,
  ChevronLeft,
  Menu
} from "lucide-react";

import { useAuth } from "@/store/useAuth";
import { useState } from "react";

interface SidebarProps {
  role: "teacher" | "student";
}

export function Sidebar({ role }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter(); // Initialize router

  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const { clearAuth } = useAuth();

  const handleLogout = () => {
    clearAuth();
    router.push("/");
  };

  // Define routes based on role
  const routes = role === "teacher" 
    ? [
        { label: "Dashboard", href: "/dashboard/teacher", icon: LayoutDashboard },
        { label: "Classrooms", href: "/dashboard/teacher/classes", icon: BookOpen },
        { label: "Settings", href: "/dashboard/teacher/settings", icon: Settings },
      ]
    : [
        { label: "My Attendance", href: "/dashboard/student", icon: LayoutDashboard },
        { label: "Join Class", href: "/dashboard/student/join", icon: Users },
        { label: "Profile", href: "/dashboard/student/profile", icon: Settings },
      ];

  return (
    <>
      {/* Mobile Toggle */}
      <Button
        variant="outline"
        size="icon"
        className="md:hidden fixed bottom-5 left-4 bg-black"
        onClick={() => setMobileOpen(true)}
      >
        <Menu />
      </Button>

      {/* Overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed md:static z-50 h-full bg-card border-r transition-all",
          collapsed ? "w-16" : "w-64",
          mobileOpen ? "left-0" : "-left-full",
          "md:left-0"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4">
          {!collapsed && (
            <h2 className="font-bold text-primary">
              {role === "teacher" ? "Teacher Panel" : "Student View"}
            </h2>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCollapsed(!collapsed)}
            className="hidden md:flex cursor-pointer"
          >
            <ChevronLeft className={cn("transition", collapsed && "rotate-180")} />
          </Button>
        </div>

        {/* Routes */}
        <div className="px-2 space-y-1">
          {routes.map((route) => (
            <Link key={route.href} href={route.href}>
              <Button
                variant={pathname === route.href ? "secondary" : "ghost"}
                className={cn(
                  "w-full justify-start gap-2 cursor-pointer",
                  collapsed && "justify-center"
                )}
              >
                <route.icon className="h-4 w-4" />
                {!collapsed && route.label}
              </Button>
            </Link>
          ))}
        </div>

        {/* Logout */}
        <div className="p-4 border-t">
          <Button
            variant="outline"
            className="w-full gap-2 text-destructive cursor-pointer"
            onClick={handleLogout}
          >
            <LogOut className="h-4 w-4" />
            {!collapsed && "Sign Out"}
          </Button>
        </div>
      </aside>
    </>
  );
}