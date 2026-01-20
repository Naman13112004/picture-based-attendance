// app/dashboard/student/join/page.tsx

import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import StudentJoin from "@/components/dashboard/student/student-join";

export default function JoinClassPage() {
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
          <StudentJoin />
        </CardContent>
      </Card>
    </div>
  );
}