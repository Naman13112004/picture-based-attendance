"use client";

import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
    DropdownMenu, 
    DropdownMenuContent, 
    DropdownMenuItem, 
    DropdownMenuLabel, 
    DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { Plus, MoreHorizontal, Pencil, Trash, Copy } from "lucide-react";
import Link from "next/link";

export default function TeacherClassesPage() {
  const classes = [
    { id: "c1", code: "CS101-A", name: "CS 101 - Intro to Programming", students: 45, schedule: "Mon/Wed 09:00 AM" },
    { id: "c2", code: "CS202-B", name: "CS 202 - Data Structures", students: 32, schedule: "Tue/Thu 11:30 AM" },
    { id: "c3", code: "CS305-A", name: "CS 305 - Artificial Intelligence", students: 28, schedule: "Fri 02:00 PM" },
    { id: "c4", code: "SE400-X", name: "SE 400 - Software Engineering", students: 50, schedule: "Mon 01:00 PM" },
  ];

  const copyCode = (code: string) => {
      navigator.clipboard.writeText(code);
      alert("Class code copied to clipboard!");
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Manage Classes</h2>
          <p className="text-muted-foreground">View and manage all your active classrooms.</p>
        </div>
        <Button className="gap-2 cursor-pointer">
          <Plus className="h-4 w-4" /> Create New Class
        </Button>
      </div>

      <div className="border rounded-lg bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Class Name</TableHead>
              <TableHead>Code</TableHead>
              <TableHead>Schedule</TableHead>
              <TableHead className="text-right">Students</TableHead>
              <TableHead className="w-12.5"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {classes.map((cls) => (
              <TableRow key={cls.id}>
                <TableCell className="font-medium">
                    <Link href={`/dashboard/teacher/class/${cls.id}`} className="hover:underline text-primary">
                        {cls.name}
                    </Link>
                </TableCell>
                <TableCell>
                    <div className="flex items-center gap-2">
                        <code className="bg-muted px-2 py-1 rounded text-sm">{cls.code}</code>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyCode(cls.code)}>
                            <Copy className="h-3 w-3" />
                        </Button>
                    </div>
                </TableCell>
                <TableCell>{cls.schedule}</TableCell>
                <TableCell className="text-right">{cls.students}</TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="h-8 w-8 p-0 cursor-pointer">
                        <span className="sr-only">Open menu</span>
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Actions</DropdownMenuLabel>
                      <DropdownMenuItem className="cursor-pointer">
                        <Pencil className="mr-2 h-4 w-4" /> Edit Details
                      </DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive focus:text-destructive cursor-pointer">
                        <Trash className="mr-2 h-4 w-4" /> Delete Class
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}