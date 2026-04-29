import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UserPlus, Camera, CheckSquare, ScanFace } from "lucide-react";

export default function AboutPage() {
  const steps = [
    {
      icon: <UserPlus className="h-8 w-8 text-blue-500" />,
      title: "1. Create Account & Setup",
      description: "Teachers create classrooms. Students register and join these classrooms using a unique code.",
    },
    {
      icon: <ScanFace className="h-8 w-8 text-purple-500" />,
      title: "2. Register Face Data",
      description: "Students upload 3 distinct reference photos of themselves using our secure live-camera interface.",
    },
    {
      icon: <Camera className="h-8 w-8 text-rose-500" />,
      title: "3. Snap Class Photo",
      description: "During class, the teacher simply takes a single photo of the entire classroom.",
    },
    {
      icon: <CheckSquare className="h-8 w-8 text-green-500" />,
      title: "4. Automated Attendance",
      description: "Our AI scans the group photo, matches faces against the database, and marks attendance instantly.",
    },
  ];

  return (
    <div className="container py-16 px-4 md:px-8 max-w-5xl mx-auto">
      <div className="text-center mb-16 space-y-4">
        <h1 className="text-4xl font-extrabold tracking-tight lg:text-5xl">How SnapAttend Works</h1>
        <p className="text-xl text-muted-foreground">
          Automating attendance with the power of Computer Vision.
        </p>
      </div>

      <div className="grid gap-8 md:grid-cols-2">
        {steps.map((step, index) => (
          <Card key={index} className="relative overflow-hidden border-2 hover:border-primary/50 transition-colors">
            <div className="absolute top-0 left-0 bg-muted px-3 py-1 text-xs font-bold rounded-br-lg">
              STEP 0{index + 1}
            </div>
            <CardHeader className="flex flex-row gap-4 items-center pt-8">
              <div className="p-3 bg-muted rounded-full">
                {step.icon}
              </div>
              <CardTitle className="text-xl">{step.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground leading-relaxed">
                {step.description}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}