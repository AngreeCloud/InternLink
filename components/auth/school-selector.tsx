"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import type { ChangeEvent, KeyboardEvent } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { School } from "@/lib/types/school";

type SchoolSelectorProps = {
  schools: School[];
  value: string;
  onChange: (schoolId: string) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  label?: string;
  error?: string;
};

export function SchoolSelector({
  schools,
  value,
  onChange,
  disabled = false,
  placeholder = "Digite o nome da escola...",
  className,
  label = "Escola",
  error,
}: SchoolSelectorProps) {
  const [inputValue, setInputValue] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const selectedSchool = useMemo(() => schools.find((school) => school.id === value), [schools, value]);
  const filteredSchools = useMemo(() => {
    const query = inputValue.trim().toLowerCase();
    if (!query) return schools;
    return schools.filter((school) => school.name.toLowerCase().includes(query));
  }, [schools, inputValue]);

  // Keep the visible input value in sync with externally selected school.
  useEffect(() => {
    if (selectedSchool) {
      setInputValue(selectedSchool.name);
    } else {
      setInputValue("");
    }
  }, [selectedSchool]);

  useEffect(() => {
    setHighlightedIndex(0);
  }, [inputValue]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!rootRef.current?.contains(target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const selectSchool = useCallback(
    (school: School) => {
      setInputValue(school.name);
      onChange(school.id);
      setIsOpen(false);
    },
    [onChange]
  );

  const handleInputChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      setInputValue(newValue);
      setIsOpen(true);

      const match = schools.find((school) => school.name.toLowerCase() === newValue.toLowerCase());
      if (match) {
        onChange(match.id);
      } else {
        onChange("");
      }
    },
    [schools, onChange]
  );

  const handleInputFocus = useCallback(() => {
    setIsOpen(true);
  }, []);

  const handleInputBlur = useCallback(() => {
    const exactMatch = schools.find((school) => school.name.toLowerCase() === inputValue.toLowerCase());
    if (exactMatch) {
      onChange(exactMatch.id);
      setInputValue(exactMatch.name);
      return;
    }

    if (!value) {
      setInputValue("");
    }
  }, [inputValue, onChange, schools, value]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (!isOpen && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
        setIsOpen(true);
        return;
      }

      if (!isOpen) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlightedIndex((prev) => Math.min(prev + 1, Math.max(filteredSchools.length - 1, 0)));
      }

      if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlightedIndex((prev) => Math.max(prev - 1, 0));
      }

      if (e.key === "Enter" && filteredSchools.length > 0) {
        e.preventDefault();
        selectSchool(filteredSchools[highlightedIndex] ?? filteredSchools[0]);
      }

      if (e.key === "Escape") {
        e.preventDefault();
        setIsOpen(false);
      }
    },
    [filteredSchools, highlightedIndex, isOpen, selectSchool]
  );

  return (
    <div className={className} ref={rootRef}>
      {label && <Label htmlFor="school-selector">{label}</Label>}
      <div className="relative mt-2">
        <Input
          id="school-selector"
          value={inputValue}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          onBlur={handleInputBlur}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          className={error ? "border-red-500" : ""}
          autoComplete="off"
          role="combobox"
          aria-expanded={isOpen}
          aria-controls="school-selector-list"
        />

        {isOpen && !disabled && (
          <div
            id="school-selector-list"
            className="absolute z-40 mt-2 max-h-60 w-full overflow-y-auto rounded-md border bg-background p-1 shadow-md"
            role="listbox"
          >
            {filteredSchools.length === 0 ? (
              <div className="px-3 py-2 text-sm text-muted-foreground">Nenhuma escola encontrada.</div>
            ) : (
              filteredSchools.map((school, index) => {
                const isHighlighted = index === highlightedIndex;
                const isSelected = school.id === value;

                return (
                  <button
                    key={school.id}
                    type="button"
                    className={`w-full rounded px-3 py-2 text-left text-sm transition-colors ${
                      isHighlighted || isSelected ? "bg-muted" : "hover:bg-muted"
                    }`}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => selectSchool(school)}
                    role="option"
                    aria-selected={isSelected}
                  >
                    {school.name}
                  </button>
                );
              })
            )}
          </div>
        )}
      </div>
      {error && <p className="text-sm text-red-500 mt-1">{error}</p>}
    </div>
  );
}
