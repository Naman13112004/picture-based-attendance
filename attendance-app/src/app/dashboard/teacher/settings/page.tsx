"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react"; // Optional: assuming you might have lucide-react for icons

export default function SettingsPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // State for dynamic profile information
  const [formData, setFormData] = useState({
    firstName: "Sarah",
    lastName: "Wilson",
    email: "sarah.wilson@school.edu",
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSave = async () => {
    setIsLoading(true);
    // Simulate API call
    setTimeout(() => {
      console.log("Saving data:", formData);
      setIsLoading(false);
      alert("Profile updated successfully!"); // Replace with your toast notification
    }, 1000);
  };

  const handleDelete = async () => {
    const confirmed = window.confirm(
      "Are you sure you want to delete your account? This action cannot be undone."
    );

    if (confirmed) {
      setIsDeleting(true);
      // Simulate API call
      setTimeout(() => {
        console.log("Account deleted");
        setIsDeleting(false);
        alert("Account deleted."); // Replace with redirect logic (e.g., router.push('/login'))
      }, 1500);
    }
  };

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
        Coming Soon...
        {/* Profile Section */}
        {/* <Card>
          <CardHeader>
            <CardTitle>Profile Information</CardTitle>
            <CardDescription>Update your personal details.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name</Label>
                <Input
                  id="firstName"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleInputChange}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  id="lastName"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleInputChange}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleInputChange}
              />
            </div>
          </CardContent>
          <CardFooter className="justify-start">
            <Button 
                onClick={handleSave} 
                disabled={isLoading}
                className="cursor-pointer"
            >
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isLoading ? "Saving..." : "Save Changes"}
            </Button>
          </CardFooter>
        </Card> */}

        {/* Danger Zone */}
        {/* <Card className="border-destructive/50 bg-destructive/10">
          <CardHeader>
            <CardTitle className="text-destructive">Danger Zone</CardTitle>
            <CardDescription>Irreversible actions.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Deleting your account will remove all classroom data and student records associated with you.
            </p>
          </CardContent>
          <CardFooter className="justify-start">
            <Button 
                variant="destructive" 
                onClick={handleDelete}
                disabled={isDeleting}
                className="cursor-pointer"
            >
               {isDeleting ? "Deleting..." : "Delete Account"}
            </Button>
          </CardFooter>
        </Card> */}
      </div>
    </div>
  );
}