"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { CameraModal } from "@/components/camera-modal";
import { PlusCircle, Save, Trash2, UserSquare2 } from "lucide-react";
import { Loader2 } from "lucide-react";

export default function StudentProfilePage() {
  // State to store up to 3 image base64 strings
  // Using null to represent an empty slot
  const [images, setImages] = useState<(string | null)[]>([null, null, null]);
  const [activeSlotIndex, setActiveSlotIndex] = useState<number | null>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const openCameraForSlot = (index: number) => {
    setActiveSlotIndex(index);
    setIsCameraOpen(true);
  };

  const handleImageCaptured = (imageDataUrl: string) => {
    if (activeSlotIndex !== null) {
      const newImages = [...images];
      newImages[activeSlotIndex] = imageDataUrl;
      setImages(newImages);
    }
    setIsCameraOpen(false);
    setActiveSlotIndex(null);
  };

  const removeImage = (index: number) => {
      const newImages = [...images];
      newImages[index] = null;
      setImages(newImages);
  }

  // Mock API call to save images to DB
  const handleSaveProfile = () => {
      const filledImages = images.filter(img => img !== null);
      if(filledImages.length < 3) {
          alert("Please provide all 3 reference photos.");
          return;
      }

      setIsSaving(true);
      console.log("Sending to backend API:", filledImages);
      
      setTimeout(() => {
          setIsSaving(false);
          alert("Profile updated successfully! (Mock)");
      }, 2000);
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">My Profile & Face Data</h2>
        <p className="text-muted-foreground">
          Manage your reference photos for the attendance system.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Reference Photos</CardTitle>
          <CardDescription>
            You need to provide exactly 3 photos of yourself. These must be taken live.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-4">
            {images.map((imgData, index) => (
              <div key={index} className="flex flex-col items-center space-y-3">
                <div 
                  className={`relative w-full aspect-square rounded-xl border-2 border-dashed flex items-center justify-center overflow-hidden bg-muted/30 hover:bg-muted/50 transition-colors ${!imgData ? 'cursor-pointer' : ''}`}
                  onClick={() => !imgData && openCameraForSlot(index)}
                >
                  {imgData ? (
                    <>
                     {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={imgData} alt={`Reference ${index + 1}`} className="w-full h-full object-cover" />
                      <Button
                        variant="destructive"
                        size="icon"
                        className="absolute top-2 right-2 h-8 w-8 opacity-80 hover:opacity-100 transition-opacity cursor-pointer"
                        onClick={(e) => { e.stopPropagation(); removeImage(index); }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </>
                  ) : (
                    <div className="flex flex-col items-center text-muted-foreground">
                      <UserSquare2 className="h-12 w-12 mb-2 opacity-50" />
                      <span className="text-sm font-medium">Click to Capture Photo {index + 1}</span>
                      <PlusCircle className="h-5 w-5 mt-2 text-primary" />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
        <CardFooter className="flex justify-end border-t pt-6">
            <Button 
                onClick={handleSaveProfile} 
                disabled={isSaving || images.some(img => img === null)}
                className="w-full md:w-auto gap-2 cursor-pointer"
            >
                {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                Save Profile Data
            </Button>
        </CardFooter>
      </Card>

      {/* The reusable camera modal */}
      <CameraModal
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onCapture={handleImageCaptured}
      />
    </div>
  );
}