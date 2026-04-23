"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export default function FormatRowsPage() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const handleBulkFormat = async () => {
    setLoading(true);
    setMessage(null);

    try {
      const res = await fetch("/api/admin/format-rows", {
        method: "POST",
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to format rows");
      }

      setMessage({ text: data.message || "Successfully formatted all rows", type: "success" });
    } catch (err: any) {
      setMessage({ text: err.message || "An unknown error occurred", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-lg mx-auto bg-white rounded shadow-md mt-12 border">
      <h1 className="text-2xl font-bold mb-4">Bulk Row Formatting</h1>
      <p className="text-gray-600 mb-6">
        This module will scan the LUXE DBASE and LUXE COPY (Backup) google sheets. 
        It will apply the official Luxe row background colors and font formatting based on the &quot;Status&quot; column 
        (e.g., Sold = Red, Leased Out = Soft Red).
      </p>

      {message && (
        <div className={`p-4 mb-4 rounded ${message.type === "success" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
          {message.text}
        </div>
      )}

      <Button
        onClick={handleBulkFormat}
        disabled={loading}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded transition-colors"
      >
        {loading ? "Formatting in Progress..." : "Run Bulk Background Formatting"}
      </Button>
      
      <p className="text-sm text-gray-500 mt-4 text-center">
        Note: This is a fast operation, but it modifies thousands of rows. Please only run when necessary.
      </p>
    </div>
  );
}
