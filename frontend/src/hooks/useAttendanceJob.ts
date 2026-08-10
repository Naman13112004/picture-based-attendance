import { useState, useEffect, useCallback } from 'react';
import Cookies from 'js-cookie';

interface JobResult {
    total_faces_detected: number;
    present_student_ids: string[];
    present_count: number;
    absent_count: number;
    message?: string;
}

export type JobStatus = 'IDLE' | 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'DEAD';

interface UseAttendanceJobReturn {
    status: JobStatus;
    result: JobResult | null;
    error: string | null;
    startListening: (jobId: string) => void;
    reset: () => void;
}

export function useAttendanceJob(): UseAttendanceJobReturn {
    const [status, setStatus] = useState<JobStatus>('IDLE');
    const [result, setResult] = useState<JobResult | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [currentJobId, setCurrentJobId] = useState<string | null>(null);

    const startListening = useCallback((jobId: string) => {
        setCurrentJobId(jobId);
        setStatus('QUEUED');
        setResult(null);
        setError(null);
    }, []);

    const reset = useCallback(() => {
        setCurrentJobId(null);
        setStatus('IDLE');
        setResult(null);
        setError(null);
    }, []);

    useEffect(() => {
        if (!currentJobId) return;

        // const API_URL = process.env.NEXT_PUBLIC_LOCAL_API_URL;
        const API_URL = process.env.NEXT_PUBLIC_BACKEND_API_URL;
        if (!API_URL) {
            console.error("NEXT_PUBLIC_BACKEND_API_URL is not defined");
            return;
        }
        const token = Cookies.get('token');

        const url = new URL(`${API_URL}/attendance/job/${currentJobId}/stream`);
        if (token) {
            url.searchParams.append('token', token);
        }

        const eventSource = new EventSource(url.toString());

        eventSource.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);

                if (data.status) {
                    setStatus(data.status);
                }

                if (data.result) {
                    setResult(data.result);
                }

                if (data.lastError) {
                    setError(data.lastError);
                }

                if (['COMPLETED', 'FAILED', 'DEAD'].includes(data.status)) {
                    eventSource.close();
                }
            } catch (err) {
                console.error("Error parsing SSE data", err);
            }
        };

        eventSource.onerror = (err) => {
            console.error("SSE connection error", err);
            setError("Connection to job stream lost.");
            eventSource.close();
            setStatus('FAILED');
        };

        return () => {
            eventSource.close();
        };
    }, [currentJobId]);

    return { status, result, error, startListening, reset };
}
