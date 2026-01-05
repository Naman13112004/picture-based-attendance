"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, XCircle } from "lucide-react";

export default function StudentDashboard() {
  // Mock Data
  const attendanceHistory = [
    { id: 1, class: "CS 101", date: "Oct 24, 2023", status: "Present" },
    { id: 2, class: "CS 202", date: "Oct 24, 2023", status: "Absent" },
    { id: 3, class: "CS 305", date: "Oct 23, 2023", status: "Present" },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Welcome back, Alex</h2>
        <p className="text-muted-foreground">Here is your attendance summary.</p>
      </div>

      {/* Stats Row */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Attendance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">85%</div>
            <p className="text-xs text-muted-foreground">+2% from last month</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Classes Joined</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">4</div>
          </CardContent>
        </Card>
      </div>

      {/* Recent History */}
      <Card className="col-span-3">
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {attendanceHistory.map((record) => (
              <div
                key={record.id}
                className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0"
              >
                <div>
                  <p className="font-medium">{record.class}</p>
                  <p className="text-sm text-muted-foreground">{record.date}</p>
                </div>
                <div className="flex items-center gap-2">
                  {record.status === "Present" ? (
                    <span className="flex items-center text-green-600 text-sm font-medium">
                      <CheckCircle2 className="mr-1 h-4 w-4" /> Present
                    </span>
                  ) : (
                    <span className="flex items-center text-red-500 text-sm font-medium">
                      <XCircle className="mr-1 h-4 w-4" /> Absent
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}