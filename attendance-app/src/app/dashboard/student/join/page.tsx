// app/dashboard/student/join/page.tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Search, Users, Loader2 } from "lucide-react";

export default function JoinClassPage() {
  const [code, setCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [foundClass, setFoundClass] = useState<string | null>(null);

  const handleSearch = () => {
    setIsLoading(true);
    // Mock API search
    setTimeout(() => {
        setIsLoading(false);
        if (code.length > 3) {
            setFoundClass("CS 101 - Intro to Programming (Prof. Smith)");
        }
    }, 1000);
  };

  const handleJoin = () => {
      alert(`Successfully joined ${foundClass}`);
      setFoundClass(null);
      setCode("");
  }

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
            <Button onClick={handleSearch} disabled={isLoading || !code} className="cursor-pointer">
               {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            </Button>
          </div>

          {/* Result Preview */}
          {foundClass && (
             <div className="flex items-center p-4 border rounded-lg bg-secondary/50 animate-in fade-in slide-in-from-top-2">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center mr-4">
                    <Users className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                    <p className="font-medium">{foundClass}</p>
                    <p className="text-xs text-muted-foreground">45 Students • 09:00 AM</p>
                </div>
             </div>
          )}
        </CardContent>
        <CardFooter className="flex justify-end">
          <Button disabled={!foundClass} onClick={handleJoin} className="cursor-pointer">Join Class</Button>
        </CardFooter>
      </Card>
    </div>
  );
}