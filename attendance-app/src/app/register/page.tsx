"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, GraduationCap, School } from "lucide-react";
import { cn } from "@/lib/utils";

export default function RegisterPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [role, setRole] = useState<"student" | "teacher">("student");

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    // Mock Registration Logic
    setTimeout(() => {
      setIsLoading(false);
      // Dynamic Redirect based on selected role
      if (role === "teacher") {
        router.push("/dashboard/teacher");
      } else {
        router.push("/dashboard/student");
      }
    }, 1500);
  };

  const handleGoogleSignIn = () => {
    setIsLoading(true);
    // Mock Google Auth
    setTimeout(() => {
        setIsLoading(false);
        // Defaulting to student for Google Auth mock, 
        // in real app you'd check if user exists or ask for role
        router.push("/dashboard/student");
    }, 1500);
  }

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-4rem)] bg-muted/40 px-4 py-8">
      <Card className="w-100">
        <CardHeader className="text-center">
          <CardTitle>Create an Account</CardTitle>
          <CardDescription>
            Enter your details to get started with SnapAttend.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleRegister} className="space-y-4">
            
            {/* Role Selection */}
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div 
                onClick={() => setRole("student")}
                className={cn(
                  "cursor-pointer rounded-lg border-2 p-4 flex flex-col items-center justify-center gap-2 transition-all hover:border-primary/50",
                  role === "student" ? "border-primary bg-primary/5" : "border-muted bg-transparent"
                )}
              >
                <GraduationCap className={cn("h-6 w-6", role === "student" ? "text-primary" : "text-muted-foreground")} />
                <span className={cn("text-sm font-medium", role === "student" ? "text-primary" : "text-muted-foreground")}>Student</span>
              </div>

              <div 
                onClick={() => setRole("teacher")}
                className={cn(
                  "cursor-pointer rounded-lg border-2 p-4 flex flex-col items-center justify-center gap-2 transition-all hover:border-primary/50",
                  role === "teacher" ? "border-primary bg-primary/5" : "border-muted bg-transparent"
                )}
              >
                <School className={cn("h-6 w-6", role === "teacher" ? "text-primary" : "text-muted-foreground")} />
                <span className={cn("text-sm font-medium", role === "teacher" ? "text-primary" : "text-muted-foreground")}>Teacher</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input id="name" placeholder={role === "teacher" ? "Prof. John Doe" : "John Doe"} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder={role === "teacher" ? "teacher@school.edu" : "student@example.com"} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" required />
            </div>
            
            <Button className="w-full cursor-pointer" type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isLoading ? "Creating Account..." : `Register as ${role === "teacher" ? "Teacher" : "Student"}`}
            </Button>
          </form>

          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                Or continue with
              </span>
            </div>
          </div>

          <Button variant="outline" className="w-full cursor-pointer" onClick={handleGoogleSignIn} disabled={isLoading}>
            <svg className="mr-2 h-4 w-4" aria-hidden="true" focusable="false" data-prefix="fab" data-icon="google" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 488 512">
                <path fill="currentColor" d="M488 261.8C488 403.3 391.1 504 248 504 110.8 504 0 393.2 0 256S110.8 8 248 8c66.8 0 123 24.5 166.3 64.9l-67.5 64.9C258.5 52.6 94.3 116.6 94.3 256c0 86.5 69.1 156.6 153.7 156.6 98.2 0 135-70.4 140.8-106.9H248v-85.3h236.1c2.3 12.7 3.9 24.9 3.9 41.4z"></path>
            </svg>
            Google
          </Button>
        </CardContent>
        <CardFooter className="flex justify-center">
          <div className="text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href="/login" className="text-primary hover:underline">
              Sign in
            </Link>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}