"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Camera, RotateCcw, Check } from "lucide-react";
import Image from "next/image";

interface CameraModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (imageDataUrl: string) => void;
}

export function CameraModal({ isOpen, onClose, onCapture }: CameraModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [error, setError] = useState<string>("");

  // Start camera when modal opens
  useEffect(() => {
    if (isOpen && !capturedImage) {
      startCamera();
    } else {
      stopCamera();
    }
    // Cleanup on unmount or close
    return () => {
      stopCamera();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);


  const startCamera = async () => {
    setError("");
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: "user", width: 640, height: 480 } 
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err) {
      setError("Unable to access camera. Please ensure permissions are granted.");
      console.error("Error accessing camera:", err);
    }
  };

  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
  }, [stream]);

  const takePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext("2d");

      if (context) {
        // Set canvas dimensions to match video stream
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        // Draw current video frame to canvas
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // Convert canvas data to base64 image url
        const imageDataUrl = canvas.toDataURL("image/jpeg");
        setCapturedImage(imageDataUrl);
        stopCamera(); // Stop stream after capture to save resources
      }
    }
  };

  const handleRetake = () => {
    setCapturedImage(null);
    startCamera();
  };

  const handleConfirm = () => {
    if (capturedImage) {
      onCapture(capturedImage);
      handleClose();
    }
  };

  const handleClose = () => {
      setCapturedImage(null);
      stopCamera();
      onClose();
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Take Reference Photo</DialogTitle>
          <DialogDescription>
            Ensure your face is clearly visible and well-lit.
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex flex-col items-center justify-center space-y-4 p-4 border-2 border-dashed rounded-lg bg-muted/50 relative min-h-75">
          {error && <p className="text-destructive text-sm">{error}</p>}
          
          {/* Hidden Canvas for capture logic */}
          <canvas ref={canvasRef} className="hidden" />

          {!capturedImage ? (
            // Live Video Feed
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="rounded-lg w-full h-auto max-h-100 object-cover"
              onLoadedMetadata={() => videoRef.current?.play()}
            />
          ) : (
            // Captured Image Preview
             
            <Image 
                src={capturedImage} 
                alt="Captured" 
                className="rounded-lg w-full h-auto max-h-100 object-cover transform scale-x-[-1]" 
            />
          )}
        </div>

        <DialogFooter className="sm:justify-between">
          {!capturedImage ? (
            <Button className="w-full sm:w-auto cursor-pointer" onClick={takePhoto} disabled={!stream}>
              <Camera className="mr-2 h-4 w-4" /> Capture
            </Button>
          ) : (
            <div className="flex gap-2 w-full justify-end">
                <Button variant="outline" onClick={handleRetake} className="cursor-pointer">
                    <RotateCcw className="mr-2 h-4 w-4" /> Retake
                </Button>
                <Button onClick={handleConfirm} className="cursor-pointer">
                    <Check className="mr-2 h-4 w-4" /> Confirm
                </Button>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}