"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, XCircle, Loader2, LayoutDashboard } from "lucide-react";

import api from "@/lib/api";
import Cookies from "js-cookie";

// Define the shape of our data
interface DashboardData {
  totalClasses: number;
  attendancePercentage: number;
  history: {
    id: string;
    class: string;
    date: string;
    status: "Present" | "Absent";
  }[];
}

const StudentDashboardComponent = () => {
    const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [userName, setUserName] = useState("Student");

  useEffect(() => {
    // 1. Get User Name from cookies for the welcome message
    const userStr = Cookies.get("user");
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        setUserName(user.name);
      } catch (e) {
        // Fallback if parsing fails
      }
    }

    // 2. Fetch Dashboard Stats
    const fetchStats = async () => {
      try {
        const res = await api.get('/attendance/stats');
        setData(res.data);
      } catch (error) {
        console.error("Failed to fetch dashboard stats", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStats();
  }, []);

  if (isLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

    return (
        <div className="space-y-8">
            <div>
                <h2 className="text-3xl font-bold tracking-tight">Welcome back, {userName}</h2>
                <p className="text-muted-foreground">Here is your attendance summary.</p>
            </div>

            {/* Stats Row */}
            <div className="grid gap-4 md:grid-cols-3">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Attendance</CardTitle>
                        <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{data?.attendancePercentage}%</div>
                        <p className="text-xs text-muted-foreground">Overall Performance</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Classes Joined</CardTitle>
                        <LayoutDashboard className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{data?.totalClasses}</div>
                        <p className="text-xs text-muted-foreground">Active Enrollments</p>
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
                        {data?.history.length === 0 ? (
                            <p className="text-sm text-muted-foreground">No attendance records found yet.</p>
                        ) : (
                            data?.history.map((record) => (
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
                            ))
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default StudentDashboardComponent;