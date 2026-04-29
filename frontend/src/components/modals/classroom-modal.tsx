// components/modals/classroom-modal.tsx
"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { 
    Dialog, 
    DialogContent, 
    DialogHeader, 
    DialogTitle, 
    DialogFooter 
} from "@/components/ui/dialog";

interface ClassroomModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (name: string) => Promise<void>;
  initialData?: { name: string } | null; // If present, we are in Edit mode
  title: string;
  description?: string;
}

export const ClassroomModal = ({
  isOpen,
  onClose,
  onConfirm,
  initialData,
  title
}: ClassroomModalProps) => {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  // If initialData changes (edit mode), update the input
  useEffect(() => {
    if (initialData) {
      setName(initialData.name);
    } else {
      setName("");
    }
  }, [initialData, isOpen]);

  const handleSubmit = async () => {
    try {
      setLoading(true);
      await onConfirm(name);
      onClose();
      setName(""); // Reset
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Class Name</Label>
            <Input 
                placeholder="e.g. CS 101" 
                value={name} 
                onChange={(e) => setName(e.target.value)} 
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading || !name}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {initialData ? "Save Changes" : "Create Class"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};