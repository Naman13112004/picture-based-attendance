"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Users, ArrowRight } from "lucide-react";
import Link from "next/link";
import api from "@/lib/api";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from "@/components/ui/dialog";

interface Classroom {
    id: string;
    name: string;
    code: string;
    _count: { students: number };
}

export default function TeacherDashboard() {
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Create Class State
  const [newClassName, setNewClassName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // 1. Fetch Classes
  const fetchClasses = async () => {
      try {
          const res = await api.get('/classrooms');
          setClassrooms(res.data);
      } catch (error) {
          console.error("Failed to fetch classes", error);
      } finally {
          setIsLoading(false);
      }
  }

  useEffect(() => {
      fetchClasses();
  }, []);

  // 2. Create Class Handler
  const handleCreateClass = async () => {
      setIsCreating(true);
      try {
          await api.post('/classrooms/create', {
              name: newClassName,
              schedule: "TBD" // You can add an input for this
          });
          setIsDialogOpen(false);
          setNewClassName("");
          fetchClasses(); // Refresh list
      } catch (error) {
          alert("Failed to create class");
      } finally {
          setIsCreating(false);
      }
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
          <p className="text-muted-foreground">Manage your classes and today's attendance.</p>
        </div>
        {/* Create Class Modal */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
                <Button className="gap-2"><Plus className="h-4 w-4" /> Create Class</Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Create New Classroom</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label>Class Name</Label>
                        <Input placeholder="e.g. Advanced AI" value={newClassName} onChange={e => setNewClassName(e.target.value)} />
                    </div>
                    <Button onClick={handleCreateClass} disabled={isCreating} className="w-full">
                        {isCreating ? "Creating..." : "Create Classroom"}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {classrooms.map((cls) => (
          <Card key={cls.id} className="hover:shadow-lg transition-all cursor-pointer">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Class Code: {cls.code}</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold mb-1">{cls.name}</div>
              <p className="text-xs text-muted-foreground mb-4">
                {cls._count?.students || 0} Students Enrolled
              </p>
              <Link href={`/dashboard/teacher/class/${cls.id}`}>
                <Button variant="secondary" className="w-full text-xs h-8">
                  View Class <ArrowRight className="h-3 w-3 ml-2" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        ))}
        {classrooms.length === 0 && !isLoading && (
            <p className="text-muted-foreground col-span-3 text-center py-10">No classes found. Create one to get started.</p>
        )}
      </div>
    </div>
  );
}