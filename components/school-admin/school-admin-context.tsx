"use client";

import { createContext, useContext } from "react";

export type SchoolAdminContextValue = {
  userId: string;
  schoolId: string;
  name: string;
  email: string;
};

const SchoolAdminContext = createContext<SchoolAdminContextValue | null>(null);

export function SchoolAdminProvider({
  value,
  children,
}: {
  value: SchoolAdminContextValue;
  children: React.ReactNode;
}) {
  return <SchoolAdminContext.Provider value={value}>{children}</SchoolAdminContext.Provider>;
}

export function useSchoolAdmin() {
  const context = useContext(SchoolAdminContext);
  if (!context) {
    throw new Error("useSchoolAdmin deve ser usado dentro de SchoolAdminProvider");
  }
  return context;
}
