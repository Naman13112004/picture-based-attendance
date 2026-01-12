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
  BookOpen
} from "lucide-react";

interface SidebarProps {
  role: "teacher" | "student";
}

export function Sidebar({ role }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter(); // Initialize router

  // Logout Handler
  const handleLogout = () => {
    // 1. Remove tokens from LocalStorage
    localStorage.removeItem("token");
    localStorage.removeItem("user"); 
    
    // 2. Redirect to Home Page
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
    <div className="flex h-full flex-col border-r bg-card w-64 md:flex">
      <div className="p-6">
        <h2 className="text-2xl font-bold tracking-tight text-primary">
          {role === "teacher" ? "Teacher Panel" : "Student View"}
        </h2>
      </div>
      <div className="flex-1 px-4 space-y-2">
        {routes.map((route) => (
          <Link key={route.href} href={route.href}>
            <Button
              variant={pathname === route.href ? "secondary" : "ghost"}
              className={cn("w-full justify-start gap-2 cursor-pointer", pathname === route.href && "bg-secondary")}
            >
              <route.icon className="h-4 w-4" />
              {route.label}
            </Button>
          </Link>
        ))}
      </div>
      <div className="p-4 border-t">
        {/* Changed from Link to Button with onClick */}
        <Button 
            variant="outline" 
            className="w-full gap-2 text-destructive hover:text-destructive cursor-pointer"
            onClick={handleLogout}
        >
            <LogOut className="h-4 w-4" />
            Sign Out
        </Button>
      </div>
    </div>
  );
}