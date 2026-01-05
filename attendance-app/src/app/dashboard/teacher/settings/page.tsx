"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

export default function SettingsPage() {
  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h3 className="text-3xl font-bold tracking-tight">Settings</h3>
        <p className="text-muted-foreground">
          Manage your account settings and preferences.
        </p>
      </div>
      <Separator />

      <div className="grid gap-6">
        {/* Profile Section */}
        <Card>
            <CardHeader>
                <CardTitle>Profile Information</CardTitle>
                <CardDescription>Update your personal details.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label>First Name</Label>
                        <Input defaultValue="Sarah" />
                    </div>
                    <div className="space-y-2">
                        <Label>Last Name</Label>
                        <Input defaultValue="Wilson" />
                    </div>
                </div>
                <div className="space-y-2">
                    <Label>Email Address</Label>
                    <Input defaultValue="sarah.wilson@school.edu" type="email" />
                </div>
            </CardContent>
            <CardFooter className="justify-end">
                <Button className="cursor-pointer">Save Changes</Button>
            </CardFooter>
        </Card>

        {/* Notifications Section */}
        <Card>
            <CardHeader>
                <CardTitle>Notifications</CardTitle>
                <CardDescription>Configure how you receive alerts.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                        <Label className="text-base">Email Summaries</Label>
                        <p className="text-sm text-muted-foreground">Receive weekly attendance reports via email.</p>
                    </div>
                    <Switch defaultChecked className="cursor-pointer" />
                </div>
                <div className="flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                        <Label className="text-base">Low Attendance Alerts</Label>
                        <p className="text-sm text-muted-foreground">Get notified when a student falls below 75%.</p>
                    </div>
                    <Switch defaultChecked className="cursor-pointer" />
                </div>
            </CardContent>
        </Card>

        {/* Danger Zone */}
        <Card className="border-destructive/50 bg-destructive/10">
            <CardHeader>
                <CardTitle className="text-destructive">Danger Zone</CardTitle>
                <CardDescription>Irreversible actions.</CardDescription>
            </CardHeader>
            <CardContent>
                <p className="text-sm text-muted-foreground">
                    Deleting your account will remove all classroom data and student records associated with you.
                </p>
            </CardContent>
            <CardFooter className="justify-end">
                <Button variant="destructive" className="cursor-pointer">Delete Account</Button>
            </CardFooter>
        </Card>
      </div>
    </div>
  );
}