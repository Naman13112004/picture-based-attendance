"use client";

import api from "@/lib/api";
import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
    UploadCloud,
    CheckCircle2,
    Loader2,
    AlertCircle,
    UserCheck,
    UserX,
    Search,
    CalendarIcon,
    Edit2
} from "lucide-react";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ManualAttendanceModal } from "@/components/modals/manual-attendance-modal";

// Define the shape of our student record from the API
interface StudentRecord {
    studentId: string;
    name: string;
    email: string;
    avatar: string | null;
    status: 'PRESENT' | 'ABSENT';
    time: string | null;
}

const TeacherClassDetails = () => {
    const params = useParams();
    const classId = params.id as string;

    // --- Upload & Process State ---
    // Processing states: 'idle' | 'uploading' | 'processing' | 'complete' | 'error'
    const [file, setFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [status, setStatus] = useState<'idle' | 'uploading' | 'processing' | 'complete' | 'error'>('idle');
    const [attendanceResults, setAttendanceResults] = useState<{ present: number, absent: number } | null>(null);

    // --- History & Records State ---
    const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]); // Default to today YYYY-MM-DD
    const [historyLoading, setHistoryLoading] = useState(false);
    const [studentRecords, setStudentRecords] = useState<StudentRecord[]>([]);
    const [stats, setStats] = useState({ total: 0, present: 0 });

    // --- Modal State ---
    const [isManualModalOpen, setIsManualModalOpen] = useState(false);

    // 1. Fetch History Function
    const fetchHistory = useCallback(async (date: string) => {
        setHistoryLoading(true);
        try {
            // Call the new backend endpoint
            const res = await api.get(`/attendance/history/${classId}?date=${date}`);
            setStudentRecords(res.data.records);
            setStats({
                total: res.data.totalStudents,
                present: res.data.presentCount
            });
        } catch (error) {
            console.error("Failed to fetch history", error);
        } finally {
            setHistoryLoading(false);
        }
    }, [classId]);

    // Initial load when component mounts or date changes
    useEffect(() => {
        if (classId) {
            fetchHistory(selectedDate);
        }
    }, [classId, selectedDate, fetchHistory]);

    // 2. File Handling
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            setFile(selectedFile);
            // Create local preview URL
            const url = URL.createObjectURL(selectedFile);
            setPreviewUrl(url);
            setStatus('idle'); // Reset status on new file selection
            setAttendanceResults(null);
        }
    };

    // 3. Process Attendance
    const handleProcessAttendance = async () => {
        if (!file || !previewUrl) return;
        setStatus('uploading');

        try {
            // 1. Convert File to Base64 to send to our Node Backend
            // (Alternatively, use FormData for multipart/form-data, but our Backend Controller expects JSON with base64 for now)
            const reader = new FileReader();
            reader.readAsDataURL(file);

            reader.onloadend = async () => {
                const base64String = reader.result as string;

                setStatus('processing');

                // 2. Call API
                const res = await api.post('/attendance/mark', {
                    classId: classId,
                    image: base64String
                });

                // 3. Handle Results
                const { results } = res.data; // results: { total_faces_detected, present_student_ids, absent_count }

                setAttendanceResults({
                    present: results.present_student_ids.length,
                    absent: results.absent_count
                });
                setStatus('complete');
            };

        } catch (error) {
            console.error(error);
            setStatus('error');
            alert("Failed to process attendance");
        }
    }

    const handleManualSuccess = () => {
        // Refresh the list after manual edit
        fetchHistory(selectedDate);

        // Optional: If we just processed an image and then manually edited, 
        // we might want to update the "Results" card too, but usually refreshing 
        // the history list is sufficient as that's the source of truth.
    };

    return (
        <div className="grid gap-6 md:grid-cols-2">
            {/* Upload Section */}
            <Card className="md:row-span-2">
                <CardHeader>
                    <CardTitle>Take Attendance</CardTitle>
                    <CardDescription>Upload a clear photo of the entire class.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    {!previewUrl ? (
                        <div className="flex items-center justify-center w-full">
                            <Label
                                htmlFor="dropzone-file"
                                className="flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-lg cursor-pointer bg-muted/30 hover:bg-muted/50 transition-colors"
                            >
                                <div className="flex flex-col items-center justify-center pt-5 pb-6 text-muted-foreground">
                                    <UploadCloud className="w-10 h-10 mb-4 text-primary/60" />
                                    <p className="mb-2 text-sm"><span className="font-semibold">Click to upload</span> or drag and drop</p>
                                    <p className="text-xs">PNG, JPG or JPEG</p>
                                </div>
                                <Input id="dropzone-file" type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                            </Label>
                        </div>
                    ) : (
                        <div className="relative rounded-lg overflow-hidden border">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={previewUrl} alt="Class Preview" className="w-full h-auto object-cover max-h-100" />
                            {status === 'idle' && (
                                <Button variant="secondary" size="sm" className="absolute top-2 right-2 cursor-pointer" onClick={() => { setPreviewUrl(null); setFile(null) }}>Change Photo</Button>
                            )}

                            {/* Overlay during processing */}
                            {(status === 'uploading' || status === 'processing') && (
                                <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex flex-col items-center justify-center z-10">
                                    <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
                                    <p className="text-lg font-medium">
                                        {status === 'uploading' ? "Uploading image..." : "AI is analyzing faces..."}
                                    </p>
                                </div>
                            )}
                        </div>
                    )}

                    <Button
                        className="w-full cursor-pointer" size="lg"
                        disabled={!file || status !== 'idle'}
                        onClick={handleProcessAttendance}
                    >
                        {status === 'idle' ? "Process Attendance" : status === 'complete' ? "Attendance Taken" : "Processing..."}
                    </Button>

                    <div className="relative flex items-center py-2">
                        <div className="grow border-t border-muted"></div>
                        <span className="shrink-0 mx-4 text-xs text-muted-foreground">OR</span>
                        <div className="grow border-t border-muted"></div>
                    </div>

                    <Button
                        variant="outline"
                        className="w-full cursor-pointer gap-2"
                        onClick={() => setIsManualModalOpen(true)}
                    >
                        <Edit2 className="h-4 w-4" />
                        Manual Attendance / Corrections
                    </Button>
                </CardContent>
            </Card>

            {/* Results Section - Only shows when complete */}
            {status === 'complete' && attendanceResults && (
                <Card className="border-primary bg-primary/5">
                    <CardHeader>
                        <CardTitle className="flex items-center text-primary gap-2">
                            <CheckCircle2 className="h-6 w-6" /> Attendance Marked!
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4 text-center">
                            <div className="p-4 bg-background rounded-lg border">
                                <div className="text-3xl font-bold text-green-600">{attendanceResults.present}</div>
                                <div className="text-sm text-muted-foreground">Present</div>
                            </div>
                            <div className="p-4 bg-background rounded-lg border">
                                <div className="text-3xl font-bold text-red-500">{attendanceResults.absent}</div>
                                <div className="text-sm text-muted-foreground">Absent</div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Instructions Section */}
            {status === 'idle' && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <AlertCircle className="h-5 w-5 text-muted-foreground" /> Guidelines
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm text-muted-foreground space-y-2">
                        <p>1. Ensure good lighting in the classroom.</p>
                        <p>2. All students should be looking towards the camera.</p>
                        <p>3. Avoid blurry images for accurate detection.</p>
                    </CardContent>
                </Card>
            )}

            {/* RIGHT COLUMN: HISTORY & RECORDS */}
            <div className="space-y-6">
                <Card className="h-full flex flex-col">
                    <CardHeader className="pb-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div>
                                <CardTitle>Attendance Records</CardTitle>
                                <CardDescription>View status by date.</CardDescription>
                            </div>

                            {/* DATE PICKER */}
                            <div className="relative">
                                <CalendarIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    type="date"
                                    className="pl-9 w-full sm:w-45 cursor-pointer"
                                    value={selectedDate}
                                    onChange={(e) => setSelectedDate(e.target.value)}
                                />
                            </div>
                        </div>
                    </CardHeader>

                    <Separator />

                    <CardContent className="flex-1 p-0">
                        {/* STATS STRIP */}
                        <div className="grid grid-cols-3 divide-x border-b bg-muted/20">
                            <div className="p-4 text-center">
                                <span className="text-xs text-muted-foreground font-semibold uppercase">Total</span>
                                <div className="text-xl font-bold">{stats.total}</div>
                            </div>
                            <div className="p-4 text-center">
                                <span className="text-xs text-green-600 font-semibold uppercase">Present</span>
                                <div className="text-xl font-bold text-green-700">{stats.present}</div>
                            </div>
                            <div className="p-4 text-center">
                                <span className="text-xs text-red-500 font-semibold uppercase">Absent</span>
                                <div className="text-xl font-bold text-red-600">{stats.total - stats.present}</div>
                            </div>
                        </div>

                        {/* SCROLLABLE LIST */}
                        <div className="max-h-125 overflow-y-auto">
                            {historyLoading ? (
                                <div className="flex items-center justify-center py-12">
                                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                                </div>
                            ) : studentRecords.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                                    <Search className="h-10 w-10 mb-2 opacity-20" />
                                    <p>No students found for this class.</p>
                                </div>
                            ) : (
                                <div className="divide-y">
                                    {studentRecords.map((student) => (
                                        <div key={student.studentId} className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors">
                                            <div className="flex items-center gap-3">
                                                <Avatar>
                                                    <AvatarImage src={student.avatar || ""} />
                                                    <AvatarFallback>{student.name.charAt(0)}</AvatarFallback>
                                                </Avatar>
                                                <div>
                                                    <p className="font-medium text-sm">{student.name}</p>
                                                    <p className="text-xs text-muted-foreground">{student.email}</p>
                                                </div>
                                            </div>

                                            <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium border ${student.status === 'PRESENT'
                                                ? 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-900'
                                                : 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-900'
                                                }`}>
                                                {student.status === 'PRESENT' ? (
                                                    <>
                                                        <UserCheck className="h-3 w-3" /> Present
                                                    </>
                                                ) : (
                                                    <>
                                                        <UserX className="h-3 w-3" /> Absent
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* MANUAL ATTENDANCE MODAL */}
            <ManualAttendanceModal
                isOpen={isManualModalOpen}
                onClose={() => setIsManualModalOpen(false)}
                classId={classId}
                date={selectedDate}
                students={studentRecords} // Pass current backend state
                onUpdateSuccess={handleManualSuccess}
            />
        </div>
    );
};

export default TeacherClassDetails;