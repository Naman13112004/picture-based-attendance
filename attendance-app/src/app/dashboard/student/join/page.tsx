// app/dashboard/student/join/page.tsx
"use client";

import api from "@/lib/api";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Search, Users, Loader2 } from "lucide-react";

export default function JoinClassPage() {
  const [code, setCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleJoin = async () => {
    setIsLoading(true);
    try {
        const res = await api.post('/classrooms/join', { code });
        alert(res.data.message); // "Successfully joined Class Name"
        setCode("");
    } catch (error: any) {
        alert(error.response?.data?.message || "Failed to join class");
    } finally {
        setIsLoading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto space-y-8">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Join a Classroom</h2>
        <p className="text-muted-foreground">Enter the unique code provided by your teacher.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Class Code</CardTitle>
          <CardDescription>
            Ask your teacher for the 6-digit class code.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex space-x-2">
            <Input 
                placeholder="e.g. CS101-XY" 
                value={code} 
                onChange={(e) => setCode(e.target.value)}
            />
            <Button onClick={handleJoin} disabled={isLoading || !code} className="cursor-pointer">
               {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Join Class"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}