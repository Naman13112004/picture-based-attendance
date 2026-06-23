// components/layout/sidebar.tsx
"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { 
  LayoutDashboard, 
  Users, 
  Settings, 
  LogOut, 
  BookOpen,
  ChevronLeft
} from "lucide-react";

import { useAuth } from "@/store/useAuth";
import { useState } from "react";

interface SidebarProps {
  role: "teacher" | "student";
}

export function Sidebar({ role }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  const [collapsed, setCollapsed] = useState(false);

  const { clearAuth } = useAuth();

  const handleLogout = () => {
    clearAuth();
    router.replace("/");
  };

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
    <aside
      className={cn(
        "hidden md:flex flex-col z-50 h-[calc(100vh-4rem)] bg-card border-r transition-all sticky top-16",
        collapsed ? "w-16" : "w-64"
      )}
    >
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
          className="cursor-pointer"
        >
          <ChevronLeft className={cn("transition", collapsed && "rotate-180")} />
        </Button>
      </div>

      <div className="px-2 space-y-1 flex-1 overflow-y-auto">
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
  );
}