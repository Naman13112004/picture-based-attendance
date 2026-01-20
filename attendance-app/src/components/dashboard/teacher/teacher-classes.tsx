"use client";

import { useState, useEffect } from "react";
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
import {
    Plus,
    MoreHorizontal,
    Pencil,
    Trash,
    Copy,
    Loader2
} from "lucide-react";

import Link from "next/link";
import api from "@/lib/api";
import { ClassroomModal } from "@/components/modals/classroom-modal";

interface Classroom {
    id: string;
    name: string;
    code: string;
    _count: { students: number };
}

const TeacherClasses = () => {
    const [classrooms, setClassrooms] = useState<Classroom[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingClass, setEditingClass] = useState<Classroom | null>(null); // Null = Create Mode

    // 1. Fetch
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

    // 2. Actions
    const copyCode = (code: string) => {
        navigator.clipboard.writeText(code);
        alert("Class code copied to clipboard!");
    }

    const handleCreate = async (name: string) => {
        await api.post('/classrooms/create', { name });
        fetchClasses();
    }

    const handleEdit = async (name: string) => {
        if (!editingClass) return;
        await api.put(`/classrooms/${editingClass.id}`, { name });
        fetchClasses();
    }

    const handleDelete = async (id: string) => {
        if (confirm("Are you sure you want to delete this class? This action cannot be undone.")) {
            try {
                await api.delete(`/classrooms/${id}`);
                fetchClasses();
            } catch (error) {
                alert("Failed to delete class");
            }
        }
    }

    const openCreateModal = () => {
        setEditingClass(null);
        setIsModalOpen(true);
    }

    const openEditModal = (cls: Classroom) => {
        setEditingClass(cls);
        setIsModalOpen(true);
    }

    if (isLoading) {
        return <div className="flex h-[50vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    }

    return (
        <div className="space-y-8">
            {/* Reusable Modal */}
            <ClassroomModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onConfirm={editingClass ? handleEdit : handleCreate}
                initialData={editingClass}
                title={editingClass ? "Edit Classroom" : "Create New Classroom"}
            />

            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Manage Classes</h2>
                    <p className="text-muted-foreground">View and manage all your active classrooms.</p>
                </div>
                <Button className="gap-2 cursor-pointer" onClick={openCreateModal}>
                    <Plus className="h-4 w-4" /> Create New Class
                </Button>
            </div>

            <div className="border rounded-lg bg-card">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Class Name</TableHead>
                            <TableHead>Code</TableHead>
                            {/* Removed Schedule Header */}
                            <TableHead className="text-right">Students</TableHead>
                            <TableHead className="w-12.5"></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {classrooms.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={4} className="h-24 text-center">
                                    No classes found.
                                </TableCell>
                            </TableRow>
                        ) : (
                            classrooms.map((cls) => (
                                <TableRow key={cls.id}>
                                    <TableCell className="font-medium">
                                        <Link href={`/dashboard/teacher/class/${cls.id}`} className="hover:underline text-primary">
                                            {cls.name}
                                        </Link>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            <code className="bg-muted px-2 py-1 rounded text-sm">{cls.code}</code>
                                            <Button variant="ghost" size="icon" className="h-6 w-6 cursor-pointer" onClick={() => copyCode(cls.code)}>
                                                <Copy className="h-3 w-3" />
                                            </Button>
                                        </div>
                                    </TableCell>
                                    {/* Removed Schedule Cell */}
                                    <TableCell className="text-right">{cls._count?.students || 0}</TableCell>
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
                                                <DropdownMenuItem className="cursor-pointer" onClick={() => openEditModal(cls)}>
                                                    <Pencil className="mr-2 h-4 w-4" /> Edit Details
                                                </DropdownMenuItem>
                                                <DropdownMenuItem className="text-destructive focus:text-destructive cursor-pointer" onClick={() => handleDelete(cls.id)}>
                                                    <Trash className="mr-2 h-4 w-4" /> Delete Class
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
};

export default TeacherClasses;