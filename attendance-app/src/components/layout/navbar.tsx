// components/layout/navbar.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation"; // Added to check current route
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Moon, Sun, Menu, Camera, LayoutDashboard } from "lucide-react";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/store/useAuth";

export default function Navbar() {
  const { theme, setTheme } = useTheme();
  const pathname = usePathname(); // Get current path
  
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  const { token, role } = useAuth();
  const isLoggedIn = !!token;

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  // Helper to determine where the main button should go
  const getDashboardLink = () => {
      if (role === "TEACHER") return "/dashboard/teacher";
      return "/dashboard/student"; // Default to student
  };

  // Condition to hide button: if we are already inside /dashboard
  const isDashboard = pathname?.startsWith("/dashboard");

  if(!mounted) return null;

  return (
    <nav className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
      <div className="container flex h-16 items-center justify-between px-4 md:px-8">
        {/* Logo */}
        <Link href="/" className="flex items-center space-x-2">
          <Camera className="h-6 w-6 text-primary" />
          <span className="font-bold text-xl tracking-tight">SnapAttend</span>
        </Link>

        {/* Desktop Navigation */}
        <div className="hidden md:flex items-center space-x-6">
          <Link href="/about" className="text-sm font-medium transition-colors hover:text-primary">
            How it Works
          </Link>
          <div className="flex items-center space-x-2">
            <Button variant="ghost" size="icon" onClick={toggleTheme} className="cursor-pointer">
              {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </Button>
            
            {/* Logic for Main CTA Button */}
            {!isDashboard && (
                <>
                    {isLoggedIn ? (
                        <Link href={getDashboardLink()}>
                             <Button className="cursor-pointer gap-2">
                                <LayoutDashboard className="h-4 w-4" /> 
                                Dashboard
                             </Button>
                        </Link>
                    ) : (
                        <Link href="/register">
                            <Button className="cursor-pointer">Get Started</Button>
                        </Link>
                    )}
                </>
            )}
          </div>
        </div>

        {/* Mobile Menu Toggle */}
        <div className="md:hidden flex items-center">
            <Button variant="ghost" size="icon" onClick={toggleTheme} className="mr-2">
              {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
                <Menu className="h-6 w-6" />
            </Button>
        </div>
      </div>

      {/* Mobile Menu Dropdown with Animation */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden border-b bg-background"
          >
            <div className="container py-4 flex flex-col space-y-4 px-4">
              <Link href="/about" className="text-sm font-medium" onClick={() => setIsMobileMenuOpen(false)}>
                How it Works
              </Link>
              
              {!isDashboard && (
                  isLoggedIn ? (
                    <Link href={getDashboardLink()} onClick={() => setIsMobileMenuOpen(false)}>
                        <Button className="w-full gap-2">
                            <LayoutDashboard className="h-4 w-4" /> Dashboard
                        </Button>
                    </Link>
                  ) : (
                    <Link href="/register" onClick={() => setIsMobileMenuOpen(false)}>
                        <Button className="w-full">Get Started</Button>
                    </Link>
                  )
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}