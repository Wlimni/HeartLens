// app/hooks/useMongoDB.ts
import { useState } from "react";

const useMongoDB = (confirmedSubject: string) => {
  const [historicalData, setHistoricalData] = useState<any>(null); // Consider typing this if possible
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null); // Explicitly typed as string | null

  const fetchHistoricalData = async () => {
    if (!confirmedSubject) {
      setHistoricalData(null);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/last-access?subjectId=${confirmedSubject}`);
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || `HTTP error! Status: ${response.status}`);
      }
      const data = await response.json();
      setHistoricalData(data);
    } catch (err: unknown) { // Explicitly type err as unknown
      // Safely handle the error
      if (err instanceof Error) {
        setError(err.message); // Now TypeScript knows err has a message
      } else {
        setError("An unknown error occurred");
      }
    } finally {
      setLoading(false);
    }
  };

  const pushDataToMongo = async (recordData: any) => { // Consider typing recordData
    const payload = { ...recordData, subjectId: confirmedSubject || 'unknown' };
    const response = await fetch('/api/save-record', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || "Failed to save data");
    }
    return result;
  };

  return { historicalData, loading, error, fetchHistoricalData, pushDataToMongo };
};

export default useMongoDB;