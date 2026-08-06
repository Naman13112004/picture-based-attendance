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

interface CameraModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (imageDataUrl: string) => void;
  mode?: "student-registration" | "teacher-attendance";
  uploadProgress?: number;
}

export function CameraModal({ 
  isOpen, 
  onClose, 
  onCapture, 
  mode = "student-registration",
  uploadProgress 
}: CameraModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [error, setError] = useState<string>("");
  const [facingMode, setFacingMode] = useState<"user" | "environment">(
    mode === "teacher-attendance" ? "environment" : "user"
  );
  const [hasMultipleCameras, setHasMultipleCameras] = useState(false);
  const [isCompressing, setIsCompressing] = useState(false);

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


  useEffect(() => {
    // Check for multiple cameras
    const checkCameras = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoInputs = devices.filter(device => device.kind === "videoinput");
        if (videoInputs.length > 1) {
          setHasMultipleCameras(true);
        }
      } catch (err) {
        console.error("Error enumerating devices:", err);
      }
    };
    checkCameras();
  }, []);

  const startCamera = async () => {
    setError("");
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode, width: { ideal: 1280 }, height: { ideal: 720 } }
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

  const toggleCamera = () => {
    stopCamera();
    setFacingMode(prev => prev === "user" ? "environment" : "user");
    // setTimeout to ensure state updates and stream stops before restarting
    setTimeout(() => {
      if (isOpen && !capturedImage) startCamera();
    }, 100);
  };

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

  const compressImage = (dataUrl: string, maxWidth: number, quality: number): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL("image/jpeg", quality));
        } else {
          resolve(dataUrl);
        }
      };
      img.src = dataUrl;
    });
  };

  const handleConfirm = async () => {
    if (capturedImage) {
      setIsCompressing(true);
      try {
        let finalImage = capturedImage;
        if (mode === "teacher-attendance") {
          // Compress to max 1280px wide, 0.85 quality
          finalImage = await compressImage(capturedImage, 1280, 0.85);
        }
        onCapture(finalImage);
        // Do not handleClose() immediately if we show upload progress
        if (uploadProgress === undefined) {
           handleClose();
        }
      } catch (err) {
        console.error("Compression error", err);
        onCapture(capturedImage);
        if (uploadProgress === undefined) handleClose();
      } finally {
        setIsCompressing(false);
      }
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
          <DialogTitle>
            {mode === "teacher-attendance" ? "Take Classroom Photo" : "Take Reference Photo"}
          </DialogTitle>
          <DialogDescription>
            {mode === "teacher-attendance" 
              ? "Ensure all students are clearly visible and well-lit."
              : "Ensure your face is clearly visible and well-lit."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center justify-center space-y-4 p-4 border-2 border-dashed rounded-lg bg-muted/50 relative min-h-75">
          {error && <p className="text-destructive text-sm">{error}</p>}

          {/* Hidden Canvas for capture logic */}
          <canvas ref={canvasRef} className="hidden" />

          {!capturedImage ? (
            // Live Video Feed
            <div className="relative w-full">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`rounded-lg w-full h-auto max-h-100 object-cover ${facingMode === "user" ? "transform scale-x-[-1]" : ""}`}
                onLoadedMetadata={() => videoRef.current?.play()}
              />
              {hasMultipleCameras && (
                <Button 
                  variant="secondary" 
                  size="icon"
                  className="absolute bottom-4 right-4 rounded-full opacity-80 hover:opacity-100 cursor-pointer"
                  onClick={toggleCamera}
                >
                  <RotateCcw className="h-5 w-5" />
                </Button>
              )}
            </div>
          ) : (
            // Captured Image Preview
            <div className="relative w-full">
              <img
                src={capturedImage}
                alt="Captured"
                className={`rounded-lg w-full h-auto max-h-100 object-cover ${facingMode === "user" ? "transform scale-x-[-1]" : ""}`}
              />
              
              {uploadProgress !== undefined && (
                <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex flex-col items-center justify-center rounded-lg z-10">
                  <div className="w-3/4 max-w-xs space-y-2 text-center">
                    <p className="font-medium">Uploading...</p>
                    <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-primary transition-all duration-300"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="sm:justify-between">
          {!capturedImage ? (
            <Button className="w-full sm:w-auto cursor-pointer" onClick={takePhoto} disabled={!stream}>
              <Camera className="mr-2 h-4 w-4" /> Capture
            </Button>
          ) : (
            <div className="flex gap-2 w-full justify-end">
              <Button 
                variant="outline" 
                onClick={handleRetake} 
                className="cursor-pointer"
                disabled={uploadProgress !== undefined || isCompressing}
              >
                <RotateCcw className="mr-2 h-4 w-4" /> Retake
              </Button>
              <Button 
                onClick={handleConfirm} 
                className="cursor-pointer"
                disabled={uploadProgress !== undefined || isCompressing}
              >
                <Check className="mr-2 h-4 w-4" /> 
                {isCompressing ? "Processing..." : "Confirm"}
              </Button>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}