"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
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

  const selectedSchool = useMemo(() => schools.find((school) => school.id === value), [schools, value]);

  // Initialize input value from selected school
  useEffect(() => {
    if (selectedSchool) {
      setInputValue(selectedSchool.name);
    } else {
      setInputValue("");
    }
  }, [selectedSchool]);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      setInputValue(newValue);

      // Try to find exact match
      const match = schools.find((school) => school.name.toLowerCase() === newValue.toLowerCase());
      if (match) {
        onChange(match.id);
      } else {
        // Clear selection if no exact match
        onChange("");
      }
    },
    [schools, onChange]
  );

  const handleSelectFromDatalist = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedName = e.target.value;
      const match = schools.find((school) => school.name === selectedName);
      if (match) {
        onChange(match.id);
        setInputValue(match.name);
      }
    },
    [schools, onChange]
  );

  return (
    <div className={className}>
      {label && <Label htmlFor="school-selector">{label}</Label>}
      <Input
        id="school-selector"
        list="schools-datalist"
        value={inputValue}
        onChange={handleInputChange}
        onBlur={handleSelectFromDatalist}
        placeholder={placeholder}
        disabled={disabled}
        className={error ? "border-red-500" : ""}
      />
      <datalist id="schools-datalist">
        {schools.map((school) => (
          <option key={school.id} value={school.name} />
        ))}
      </datalist>
      {error && <p className="text-sm text-red-500 mt-1">{error}</p>}
    </div>
  );
}
