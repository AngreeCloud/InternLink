"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  subMonths,
  isSameMonth,
  isSameDay,
  isBefore,
  isAfter,
  startOfDay,
} from "date-fns";
import { pt } from "date-fns/locale";

type Props = {
  value: string; // YYYY-MM-DD
  onChange: (iso: string) => void;
  minDate?: Date;
};

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

function toIso(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function DatePicker({ value, onChange, minDate }: Props) {
  const [open, setOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(() =>
    value ? startOfMonth(new Date(value)) : startOfMonth(new Date())
  );
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const selectedDate = value ? new Date(value) : null;
  const displayLabel = value
    ? format(new Date(value), "dd/MM/yyyy")
    : "Selecionar data";

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calStart = startOfWeek(monthStart);
  const calEnd = endOfWeek(monthEnd);

  const days: Date[] = [];
  let cursor = calStart;
  while (isBefore(cursor, calEnd) || isSameDay(cursor, calEnd)) {
    days.push(cursor);
    cursor = addDays(cursor, 1);
  }

  const handleSelect = useCallback(
    (d: Date) => {
      const iso = toIso(d);
      onChange(iso);
      setOpen(false);
    },
    [onChange]
  );

  const isDisabled = (d: Date) => {
    if (minDate && isBefore(d, startOfDay(minDate))) return true;
    return false;
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground"
      >
        <span className={value ? "" : "text-muted-foreground"}>
          {displayLabel}
        </span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="ml-2 h-4 w-4 text-muted-foreground"
        >
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-72 rounded-md border bg-popover text-popover-foreground shadow-md">
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2">
            <button
              type="button"
              className="rounded p-1 hover:bg-accent"
              onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
            <span className="text-sm font-medium">
              {format(currentMonth, "MMMM yyyy", { locale: pt })}
            </span>
            <button
              type="button"
              className="rounded p-1 hover:bg-accent"
              onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          </div>

          {/* Weekday headers */}
          <div className="grid grid-cols-7 px-3 pb-1">
            {WEEKDAYS.map((d) => (
              <div
                key={d}
                className="text-center text-xs font-medium text-muted-foreground"
              >
                {d}
              </div>
            ))}
          </div>

          {/* Days grid */}
          <div className="grid grid-cols-7 px-3 pb-3">
            {days.map((d, i) => {
              const sameMonth = isSameMonth(d, currentMonth);
              const selected = selectedDate && isSameDay(d, selectedDate);
              const today = isSameDay(d, new Date());
              const disabled = isDisabled(d);

              return (
                <button
                  key={i}
                  type="button"
                  disabled={disabled}
                  className={`h-8 w-full rounded text-sm
                    ${!sameMonth ? "text-muted-foreground/30" : ""}
                    ${selected ? "bg-primary text-primary-foreground hover:bg-primary" : ""}
                    ${!selected && sameMonth && !disabled ? "hover:bg-accent" : ""}
                    ${today && !selected ? "font-bold underline underline-offset-2" : ""}
                    ${disabled ? "cursor-not-allowed opacity-30" : ""}
                  `}
                  onClick={() => !disabled && handleSelect(d)}
                >
                  {format(d, "d")}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
