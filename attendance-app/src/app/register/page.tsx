"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, GraduationCap, School } from "lucide-react";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";

import api from "@/lib/api";
import { cn } from "@/lib/utils";
import { GoogleAuthButton } from "@/components/google-auth-button";

export default function RegisterPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [role, setRole] = useState<"student" | "teacher">("student");
  const [error, setError] = useState("");

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    const formData = new FormData(e.target as HTMLFormElement);
    const name = formData.get("name") as string;
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    try {
      // ACTUAL BACKEND CALL
      const response = await api.post('/auth/register', {
        name,
        email,
        password,
        role: role.toUpperCase() // Backend expects "STUDENT" or "TEACHER"
      });

      // Save token and user info
      localStorage.setItem('token', response.data.token);
      localStorage.setItem('user', JSON.stringify(response.data.user));

      // Redirect
      if (role === "teacher") {
        router.push("/dashboard/teacher");
      } else {
        router.push("/dashboard/student");
      }

    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.message || "Registration failed");
    } finally {
      setIsLoading(false);
    }
  };

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
            {/* Display Error if exists */}
             {error && (
                <div className="p-3 text-sm text-red-500 bg-red-50 border border-red-200 rounded-md">
                  {error}
                </div>
             )}

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
              <Input id="name" name="name" placeholder={role === "teacher" ? "Prof. John Doe" : "John Doe"} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" placeholder={role === "teacher" ? "teacher@school.edu" : "student@example.com"} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" name="password" type="password" required />
            </div>

            <Button className="w-full cursor-pointer" type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isLoading ? "Creating Account..." : `Register as ${role === "teacher" ? "Teacher" : "Student"}`}
            </Button>
          </form>

          <GoogleAuthButton role={role} />
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