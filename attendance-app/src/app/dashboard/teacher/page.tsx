"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Users, ArrowRight } from "lucide-react";
import Link from "next/link";

export default function TeacherDashboard() {
  // Mock Data for Classrooms
  const classrooms = [
    { id: 1, name: "CS 101 - Intro to Programming", students: 45, time: "09:00 AM" },
    { id: 2, name: "CS 202 - Data Structures", students: 32, time: "11:30 AM" },
    { id: 3, name: "CS 305 - Artificial Intelligence", students: 28, time: "02:00 PM" },
  ];

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
          <p className="text-muted-foreground">Manage your classes and today's attendance.</p>
        </div>
        <Button className="gap-2 cursor-pointer">
          <Plus className="h-4 w-4" /> Create Class
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {classrooms.map((cls) => (
          <Card key={cls.id} className="hover:shadow-lg transition-all cursor-pointer">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {cls.time}
              </CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold mb-1">{cls.name}</div>
              <p className="text-xs text-muted-foreground mb-4">
                {cls.students} Students Enrolled
              </p>
              <Link href={`/dashboard/teacher/class/${cls.id}`}>
                <Button variant="secondary" className="w-full text-xs h-8 cursor-pointer">
                  View Class <ArrowRight className="h-3 w-3 ml-2" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}