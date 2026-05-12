"use client";

import api from "@/lib/api";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const StudentJoin = () => {
    const [code, setCode] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    const handleJoin = async () => {
        setIsLoading(true);
        try {
            const res = await api.post('/classrooms/join', { code });
            alert(res.data.message); // "Successfully joined Class Name"
            setCode("");
        } catch (error: unknown) {
            const e = error as { response?: { data?: { message?: string } } };
            alert(e.response?.data?.message || "Failed to join class");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex space-x-2">
            <Input
                placeholder="e.g. CS101-XY"
                value={code}
                onChange={(e) => setCode(e.target.value)}
            />
            <Button onClick={handleJoin} disabled={isLoading || !code} className="cursor-pointer">
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Join Class"}
            </Button>
        </div>
    );
};

export default StudentJoin;