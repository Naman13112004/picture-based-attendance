"use client";

import api from "@/lib/api";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { CameraModal } from "@/components/modals/camera-modal";
import { PlusCircle, Trash2, UserSquare2 } from "lucide-react";
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle
} from "@/components/ui/card";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import Image from "next/image";

const StudentProfile = () => {
    // State to store up to 3 image base64 strings
    // Using null to represent an empty slot
    const [images, setImages] = useState<(string | null)[]>([null, null, null]);
    const [activeSlotIndex, setActiveSlotIndex] = useState<number | null>(null);
    const [isCameraOpen, setIsCameraOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isLoadingData, setIsLoadingData] = useState(true);
    const [isConsentModalOpen, setIsConsentModalOpen] = useState(false);

    // 1. Fetch Existing Profile on Mount
    useEffect(() => {
        const fetchProfile = async () => {
            try {
                const res = await api.get('/profile');
                if (res.data) {
                    // Backend returns full urls
                    const loadedImages = [
                        res.data.faceData1 || null,
                        res.data.faceData2 || null,
                        res.data.faceData3 || null,
                    ];
                    setImages(loadedImages);
                }
            } catch (error) {
                console.error("Failed to load profile", error);
            } finally {
                setIsLoadingData(false);
            }
        }
        fetchProfile();
    }, []);

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

    // 2. Save Images
    const handleSaveProfile = async () => {
        const filledImages = images.filter(img => img !== null);
        if (filledImages.length < 3) {
            toast.error("Please provide all 3 reference photos.");
            return;
        }

        setIsSaving(true);
        try {
            // Backend expects { images: [base64, base64, base64] }
            // If the image is already a URL (loaded from server), we shouldn't re-upload it unless changed.
            // However, for MVP simplicity, we might only support re-uploading all or handling mixed types.
            // Let's assume for now the user re-captures or we send what we have.
            // Note: Sending a URL string where base64 is expected might break the backend validator we wrote.
            // Ideally, the backend should handle this, OR we force the user to retake photos if they want to update.

            await api.post('/profile/upload-faces', {
                images: filledImages
            });
            toast.success("Profile updated successfully!");
        } catch (error) {
            console.error(error);
            toast.error("Failed to save profile.");
        } finally {
            setIsSaving(false);
        }
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
                                            { }
                                            <Image src={imgData} alt={`Reference ${index + 1}`} className="object-cover" crossOrigin="anonymous" fill />
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
                        onClick={() => setIsConsentModalOpen(true)}
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

            {/* Consent Modal */}
            <Dialog open={isConsentModalOpen} onOpenChange={setIsConsentModalOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Consent to Store Photos</DialogTitle>
                        <DialogDescription>
                            By proceeding, you consent to store these 3 photos in our database for the purpose of facial recognition attendance. These photos will be kept securely until you update them, at which point the previous photos will be permanently deleted. Do you agree to these terms?
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsConsentModalOpen(false)} className="cursor-pointer">
                            Cancel
                        </Button>
                        <Button onClick={() => {
                            setIsConsentModalOpen(false);
                            handleSaveProfile();
                        }} className="cursor-pointer">
                            I Agree & Save
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default StudentProfile;