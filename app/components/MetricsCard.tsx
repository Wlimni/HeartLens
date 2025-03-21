"use client";
import React from "react";

interface MetricsCardProps {
  title: string;
  value: number | { bpm?: number; sdnn?: number }; // Support for structured types
  unit?: string;
  confidence?: number; // Optional confidence
  className?: string; // Custom styling
}

export default function MetricsCard({
  title,
  value,
  unit,
  confidence,
  className = "",
}: MetricsCardProps) {
  return (
    <div className={`p-4 rounded-lg shadow flex-1 min-w-[150px] ${className}`}>
      <p className="text-inherit">{title}</p> {/* Inherit color from parent */}
      <h2 className="text-2xl font-bold text-inherit">
        {typeof value === 'number' && value > 0
          ? `${value} ${unit || ''}`
          : typeof value === 'object' && value !== null
          ? value.bpm !== undefined
            ? `${value.bpm} BPM`
            : value.sdnn !== undefined
            ? isNaN(value.sdnn)
              ? '--'
              : `${value.sdnn} ms`
            : '--'
          : '--'}
      </h2>
      {confidence !== undefined && (
        <p className="text-sm text-inherit">
          Confidence: {confidence.toFixed(1)}%
        </p>
      )}
    </div>
  );
}