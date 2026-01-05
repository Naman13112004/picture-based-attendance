// app/login/page.tsx
"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2 } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const defaultRole = searchParams.get("role") || "student";
  
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = (role: string) => {
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      if (role === "teacher") {
        router.push("/dashboard/teacher");
      } else {
        router.push("/dashboard/student");
      }
    }, 1500);
  };

  const handleGoogleSignIn = () => {
    setIsLoading(true);
    setTimeout(() => {
        setIsLoading(false);
        router.push("/dashboard/student");
    }, 1500);
  }

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-4rem)] bg-muted/40 px-4 py-8">
      <Tabs defaultValue={defaultRole} className="w-100">
        <TabsList className="grid w-full grid-cols-2 mb-4">
          <TabsTrigger value="student" className="cursor-pointer">Student</TabsTrigger>
          <TabsTrigger value="teacher" className="cursor-pointer">Teacher</TabsTrigger>
        </TabsList>

        {/* STUDENT LOGIN */}
        <TabsContent value="student">
          <Card>
            <CardHeader>
              <CardTitle>Student Portal</CardTitle>
              <CardDescription>Login to view attendance.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="s-email">Email</Label>
                <Input id="s-email" placeholder="student@example.com" type="email" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="s-password">Password</Label>
                <Input id="s-password" type="password" />
              </div>
              <Button className="w-full cursor-pointer" onClick={() => handleLogin("student")} disabled={isLoading}>
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Login as Student"}
              </Button>
              
              <GoogleAuthButton onClick={handleGoogleSignIn} isLoading={isLoading} />
            </CardContent>
            <CardFooter className="justify-center">
                <p className="text-sm text-muted-foreground">
                    Don&apos;t have an account? <Link href="/register" className="text-primary hover:underline">Sign up</Link>
                </p>
            </CardFooter>
          </Card>
        </TabsContent>

        {/* TEACHER LOGIN */}
        <TabsContent value="teacher">
          <Card>
            <CardHeader>
              <CardTitle>Teacher Access</CardTitle>
              <CardDescription>Manage your classrooms.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="t-email">Work Email</Label>
                <Input id="t-email" placeholder="teacher@school.edu" type="email" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="t-password">Password</Label>
                <Input id="t-password" type="password" />
              </div>
              <Button className="w-full cursor-pointer" onClick={() => handleLogin("teacher")} disabled={isLoading}>
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Login as Teacher"}
              </Button>

              <GoogleAuthButton onClick={handleGoogleSignIn} isLoading={isLoading} />
            </CardContent>
            <CardFooter className="justify-center">
                <p className="text-sm text-muted-foreground">
                    Don&apos;t have an account? <Link href="/register" className="text-primary hover:underline">Sign up</Link>
                </p>
            </CardFooter>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Helper component for the Google Button to avoid code repetition
function GoogleAuthButton({ onClick, isLoading }: { onClick: () => void, isLoading: boolean }) {
    return (
        <>
            <div className="relative">
                <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
                <div className="relative flex justify-center text-xs uppercase"><span className="bg-background px-2 text-muted-foreground">Or continue with</span></div>
            </div>
            <Button variant="outline" className="w-full cursor-pointer" onClick={onClick} disabled={isLoading}>
                <svg className="mr-2 h-4 w-4" aria-hidden="true" focusable="false" data-prefix="fab" data-icon="google" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 488 512">
                    <path fill="currentColor" d="M488 261.8C488 403.3 391.1 504 248 504 110.8 504 0 393.2 0 256S110.8 8 248 8c66.8 0 123 24.5 166.3 64.9l-67.5 64.9C258.5 52.6 94.3 116.6 94.3 256c0 86.5 69.1 156.6 153.7 156.6 98.2 0 135-70.4 140.8-106.9H248v-85.3h236.1c2.3 12.7 3.9 24.9 3.9 41.4z"></path>
                </svg>
                Google
            </Button>
        </>
    )
}