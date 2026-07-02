"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface MobileDatePickerProps {
  value: string; // YYYY-MM-DD
  max?: string;  // YYYY-MM-DD
  onChange: (value: string) => void;
  className?: string;
}

const DAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

function formatDate(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function parseDate(dateStr: string): { year: number; month: number; day: number } | null {
  if (!dateStr) return null;
  const [y, m, d] = dateStr.split("-").map(Number);
  if (isNaN(y) || isNaN(m) || isNaN(d)) return null;
  return { year: y, month: m - 1, day: d };
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

function isMobileDevice(): boolean {
  if (typeof window === "undefined") return false;
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || 
         (navigator.maxTouchPoints > 0 && window.innerWidth < 768);
}

const MobileDatePicker = React.forwardRef<HTMLInputElement, MobileDatePickerProps>(
  ({ value, max, onChange, className }, ref) => {
    const [open, setOpen] = React.useState(false);
    const [isMobile, setIsMobile] = React.useState(false);
    const containerRef = React.useRef<HTMLDivElement>(null);
    const nativeInputRef = React.useRef<HTMLInputElement>(null);

    // Parse the current value to determine which month to show
    const parsed = parseDate(value);
    const today = new Date();
    const [viewYear, setViewYear] = React.useState(parsed?.year ?? today.getFullYear());
    const [viewMonth, setViewMonth] = React.useState(parsed?.month ?? today.getMonth());

    // Detect mobile on mount
    React.useEffect(() => {
      setIsMobile(isMobileDevice());
    }, []);

    // Sync view when value changes externally
    React.useEffect(() => {
      const p = parseDate(value);
      if (p) {
        setViewYear(p.year);
        setViewMonth(p.month);
      }
    }, [value]);

    // Close on outside click
    React.useEffect(() => {
      if (!open) return;
      const handler = (e: MouseEvent) => {
        if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
          setOpen(false);
        }
      };
      document.addEventListener("mousedown", handler);
      return () => document.removeEventListener("mousedown", handler);
    }, [open]);

    // Navigate months
    const prevMonth = () => {
      if (viewMonth === 0) { setViewMonth(11); setViewYear(viewYear - 1); }
      else setViewMonth(viewMonth - 1);
    };
    const nextMonth = () => {
      if (viewMonth === 11) { setViewMonth(0); setViewYear(viewYear + 1); }
      else setViewMonth(viewMonth + 1);
    };

    // Select a date
    const selectDate = (day: number) => {
      const dateStr = formatDate(viewYear, viewMonth, day);
      // Check max constraint
      if (max && dateStr > max) return;
      onChange(dateStr);
      setOpen(false);
    };

    // Today handler
    const handleToday = () => {
      const todayStr = formatDate(today.getFullYear(), today.getMonth(), today.getDate());
      if (max && todayStr > max) return;
      onChange(todayStr);
      setOpen(false);
    };

    // Build calendar grid
    const daysInMonth = getDaysInMonth(viewYear, viewMonth);
    const firstDay = getFirstDayOfMonth(viewYear, viewMonth);
    const calendarCells: (number | null)[] = [];
    for (let i = 0; i < firstDay; i++) calendarCells.push(null);
    for (let d = 1; d <= daysInMonth; d++) calendarCells.push(d);

    const todayStr = formatDate(today.getFullYear(), today.getMonth(), today.getDate());

    // On NON-mobile, use native date input
    if (!isMobile) {
      return (
        <input
          ref={ref || nativeInputRef}
          type="date"
          value={value}
          max={max}
          onChange={(e) => onChange(e.target.value)}
          className={cn(
            "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
            className
          )}
        />
      );
    }

    // Mobile: custom calendar
    return (
      <div ref={containerRef} className="relative flex-1">
        {/* Display field */}
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className={cn(
            "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background text-left",
            !value && "text-muted-foreground",
            className
          )}
        >
          {value || "Select date..."}
        </button>

        {/* Calendar overlay */}
        {open && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 z-40 bg-black/30"
              onClick={() => setOpen(false)}
            />
            {/* Calendar */}
            <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[320px] rounded-2xl bg-[#3a3a3c] text-white p-4 shadow-2xl">
              {/* Header */}
              <div className="flex items-center justify-between mb-3">
                <button
                  type="button"
                  onClick={() => {
                    // Toggle to show month/year selector or just display
                  }}
                  className="text-[#4a9eff] font-semibold text-base"
                >
                  {MONTH_NAMES[viewMonth]} {viewYear} &gt;
                </button>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={prevMonth}
                    className="text-[#4a9eff] text-lg font-bold px-1"
                  >
                    &lt;
                  </button>
                  <button
                    type="button"
                    onClick={nextMonth}
                    className="text-[#4a9eff] text-lg font-bold px-1"
                  >
                    &gt;
                  </button>
                </div>
              </div>

              {/* Day headers */}
              <div className="grid grid-cols-7 mb-1">
                {DAYS.map((d) => (
                  <div key={d} className="text-center text-[11px] text-gray-400 font-semibold py-1">
                    {d}
                  </div>
                ))}
              </div>

              {/* Days grid */}
              <div className="grid grid-cols-7">
                {calendarCells.map((day, i) => {
                  if (day === null) {
                    return <div key={`empty-${i}`} className="h-10" />;
                  }
                  const dateStr = formatDate(viewYear, viewMonth, day);
                  const isSelected = dateStr === value;
                  const isToday = dateStr === todayStr;
                  const isDisabled = max ? dateStr > max : false;

                  return (
                    <button
                      key={day}
                      type="button"
                      disabled={isDisabled}
                      onClick={() => selectDate(day)}
                      className={cn(
                        "h-10 w-10 mx-auto flex items-center justify-center rounded-full text-sm font-medium transition-colors",
                        isSelected && "bg-[#4a9eff] text-white",
                        isToday && !isSelected && "bg-[#4a9eff]/20 text-[#4a9eff] font-bold",
                        !isSelected && !isToday && "text-white hover:bg-white/10",
                        isDisabled && "opacity-30 cursor-not-allowed"
                      )}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between mt-3 pt-2">
                <button
                  type="button"
                  onClick={handleToday}
                  className="text-white bg-[#636366] px-4 py-2 rounded-lg text-sm font-medium active:bg-[#48484a]"
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="w-10 h-10 rounded-full bg-[#4a9eff] flex items-center justify-center"
                >
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <path d="M4 10.5L8 14.5L16 6.5" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    );
  }
);

MobileDatePicker.displayName = "MobileDatePicker";

export { MobileDatePicker };
