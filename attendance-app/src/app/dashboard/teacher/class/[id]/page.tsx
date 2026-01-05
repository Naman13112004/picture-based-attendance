"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UploadCloud, Users, CheckCircle2, Loader2, AlertCircle } from "lucide-react";

// Mock data based on ID
const getClassDetails = (id: string) => {
    return {
        id: id,
        name: id === '1' ? "CS 101 - Intro to Programming" : "Advanced Algorithms",
        totalStudents: 45
    }
}

export default function ClassDetailsPage() {
  const params = useParams();
  const classId = params.id as string;
  const classDetails = getClassDetails(classId);

  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  // Processing states: 'idle' | 'uploading' | 'processing' | 'complete' | 'error'
  const [status, setStatus] = useState<'idle' | 'uploading' | 'processing' | 'complete' | 'error'>('idle');
  const [attendanceResults, setAttendanceResults] = useState<{present: number, absent: number} | null>(null);


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

  // Mock the entire backend process
  const handleProcessAttendance = () => {
      if(!file) return;

      setStatus('uploading');
      
      // 1. Simulate Upload to server
      setTimeout(() => {
          setStatus('processing');
          
          // 2. Simulate Python AI processing (longer delay)
          setTimeout(() => {
              // Mock results coming back from Python API
              const mockPresentCount = Math.floor(Math.random() * classDetails.totalStudents);
              setAttendanceResults({
                  present: mockPresentCount,
                  absent: classDetails.totalStudents - mockPresentCount
              });
              setStatus('complete');
          }, 3000); // 3 second processing simulation

      }, 1500); // 1.5 second upload simulation
  }


  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">{classDetails.name}</h2>
          <div className="flex items-center text-muted-foreground mt-2">
            <Users className="h-4 w-4 mr-2" />
            <span>{classDetails.totalStudents} Students Enrolled</span>
          </div>
        </div>
      </div>

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
                             <Button variant="secondary" size="sm" className="absolute top-2 right-2 cursor-pointer" onClick={() => {setPreviewUrl(null); setFile(null)}}>Change Photo</Button>
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
                    {status === 'idle' ? "Process Attendance" : "Processing..."}
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
                <Button variant="outline" className="w-full cursor-pointer">View Detailed Report</Button>
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

      </div>
    </div>
  );
}