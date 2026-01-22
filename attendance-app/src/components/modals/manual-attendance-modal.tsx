"use client";

import { useState, useEffect } from "react";
import { 
    Dialog, 
    DialogContent, 
    DialogDescription, 
    DialogFooter, 
    DialogHeader, 
    DialogTitle 
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { Loader2 } from "lucide-react";
import api from "@/lib/api";

interface StudentRecord {
    studentId: string;
    name: string;
    email: string;
    avatar: string | null;
    status: 'PRESENT' | 'ABSENT';
}

interface ManualAttendanceModalProps {
    isOpen: boolean;
    onClose: () => void;
    classId: string;
    date: string; // ISO Date String YYYY-MM-DD
    students: StudentRecord[]; // The current list from the main page
    onUpdateSuccess: () => void;
}

export const ManualAttendanceModal = ({
    isOpen,
    onClose,
    classId,
    date,
    students,
    onUpdateSuccess
}: ManualAttendanceModalProps) => {
    const [localRecords, setLocalRecords] = useState<StudentRecord[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);

    // Sync state when modal opens or props change
    useEffect(() => {
        if (isOpen) {
            setLocalRecords([...students]); // Create a copy
            setHasChanges(false);
        }
    }, [isOpen, students]);

    const toggleAttendance = (studentId: string) => {
        setLocalRecords(current => 
            current.map(record => {
                if (record.studentId === studentId) {
                    return {
                        ...record,
                        status: record.status === 'PRESENT' ? 'ABSENT' : 'PRESENT'
                    };
                }
                return record;
            })
        );
        setHasChanges(true);
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            // Prepare payload: only send necessary data
            const updates = localRecords.map(r => ({
                studentId: r.studentId,
                status: r.status
            }));

            await api.patch('/attendance/manual', {
                classId,
                date,
                updates
            });

            onUpdateSuccess();
            onClose();
        } catch (error) {
            console.error("Failed to update manual attendance", error);
            alert("Failed to save changes. Please try again.");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>Manual Attendance</DialogTitle>
                    <DialogDescription>
                        Adjust attendance for <span className="font-semibold text-foreground">{date}</span>.
                    </DialogDescription>
                </DialogHeader>

                {/* Scrollable List */}
                <div className="flex-1 overflow-y-auto pr-2 my-4 space-y-2 border rounded-md p-2">
                    {localRecords.map((student) => (
                        <div 
                            key={student.studentId} 
                            className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                                student.status === 'PRESENT' 
                                ? 'bg-green-50/50 border-green-100 dark:bg-green-900/10 dark:border-green-900' 
                                : 'bg-red-50/50 border-red-100 dark:bg-red-900/10 dark:border-red-900'
                            }`}
                        >
                            <div className="flex items-center gap-3">
                                <Avatar className="h-9 w-9">
                                    <AvatarImage src={student.avatar || ""} />
                                    <AvatarFallback>{student.name.charAt(0)}</AvatarFallback>
                                </Avatar>
                                <div>
                                    <p className="text-sm font-medium leading-none">{student.name}</p>
                                    <p className="text-xs text-muted-foreground mt-1">{student.email}</p>
                                </div>
                            </div>

                            <div className="flex items-center gap-3">
                                <span className={`text-xs font-semibold w-16 text-right ${
                                    student.status === 'PRESENT' ? "text-green-600" : "text-red-500"
                                }`}>
                                    {student.status}
                                </span>
                                <Switch 
                                    checked={student.status === 'PRESENT'}
                                    onCheckedChange={() => toggleAttendance(student.studentId)}
                                    className="cursor-pointer"
                                />
                            </div>
                        </div>
                    ))}
                </div>

                <DialogFooter className="gap-2">
                    <Button variant="outline" onClick={onClose} className="cursor-pointer">
                        Cancel
                    </Button>
                    <Button 
                        onClick={handleSave} 
                        disabled={isSaving || !hasChanges}
                        className="cursor-pointer"
                    >
                        {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {isSaving ? "Saving..." : "Save Changes"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};