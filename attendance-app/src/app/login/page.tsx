"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GoogleAuthButton } from "@/components/google-auth-button";
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
import api from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const defaultRole = searchParams.get("role") || "student";
  
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleLogin = async (role: string) => {
    setIsLoading(true);
    setError("");
    try {
      const response = await api.post('/auth/login', {
        email,
        password
      });

      // Save Token
      localStorage.setItem('token', response.data.token);
      localStorage.setItem('user', JSON.stringify(response.data.user));

      // Check if the user is logging into the correct portal
      // (Optional: You can force redirect based on the actual role from DB)
      const userRole = response.data.user.role; // "STUDENT" or "TEACHER"
      
      if (userRole === "TEACHER") {
        router.push("/dashboard/teacher");
      } else {
        router.push("/dashboard/student");
      }

    } catch (err: any) {
       setError(err.response?.data?.message || "Login failed");
    } finally {
      setIsLoading(false);
    }
  };

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
              {error && <div className="text-red-500 text-sm mb-2">{error}</div>}
              <div className="space-y-2">
                <Label htmlFor="s-email">Email</Label>
                <Input id="s-email" type="email" value={email} onChange={e => setEmail(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="s-password">Password</Label>
                <Input id="s-password" type="password" value={password} onChange={e => setPassword(e.target.value)} />
              </div>
              <Button className="w-full cursor-pointer" onClick={() => handleLogin("student")} disabled={isLoading}>
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Login as Student"}
              </Button>
              
              <GoogleAuthButton role="student" />
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
              {error && <div className="text-red-500 text-sm mb-2">{error}</div>}
              <div className="space-y-2">
                <Label htmlFor="t-email">Work Email</Label>
                <Input id="t-email" type="email" value={email} onChange={e => setEmail(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="t-password">Password</Label>
                <Input id="t-password" type="password" value={password} onChange={e => setPassword(e.target.value)} />
              </div>
              <Button className="w-full cursor-pointer" onClick={() => handleLogin("teacher")} disabled={isLoading}>
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Login as Teacher"}
              </Button>

              <GoogleAuthButton role="teacher" />
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