"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { Badge } from "@/components/ui/badge";
import { getDbRuntime } from "@/lib/firebase-runtime";

type Props = {
  schoolId: string;
  isActive?: boolean;
};

export function SchoolAdminApprovalsBadge({ schoolId, isActive = false }: Props) {
  const [pendingTeacherIds, setPendingTeacherIds] = useState<string[]>([]);
  const [pendingUserIds, setPendingUserIds] = useState<string[]>([]);

  useEffect(() => {
    let active = true;
    let unsubPendingTeachers = () => {};
    let unsubUsers = () => {};

    (async () => {
      if (!schoolId) {
        if (active) {
          setPendingTeacherIds([]);
          setPendingUserIds([]);
        }
        return;
      }

      const db = await getDbRuntime();

      unsubPendingTeachers = onSnapshot(
        collection(db, "schools", schoolId, "pendingTeachers"),
        (snapshot) => {
          if (!active) return;
          setPendingTeacherIds(snapshot.docs.map((docSnap) => docSnap.id));
        },
        () => {
          if (!active) return;
          setPendingTeacherIds([]);
        }
      );

      unsubUsers = onSnapshot(
        query(
          collection(db, "users"),
          where("schoolId", "==", schoolId),
          where("role", "==", "professor"),
          where("estado", "==", "pendente")
        ),
        (snapshot) => {
          if (!active) return;
          setPendingUserIds(snapshot.docs.map((docSnap) => docSnap.id));
        },
        () => {
          if (!active) return;
          setPendingUserIds([]);
        }
      );
    })();

    return () => {
      active = false;
      unsubPendingTeachers();
      unsubUsers();
    };
  }, [schoolId]);

  const pendingCount = useMemo(() => {
    return new Set([...pendingTeacherIds, ...pendingUserIds]).size;
  }, [pendingTeacherIds, pendingUserIds]);

  if (pendingCount <= 0) {
    return null;
  }

  const label = pendingCount >= 10 ? "9+" : String(pendingCount);

  return (
    <Badge
      className={[
        "ml-2 h-5 min-w-5 justify-center rounded-full border px-1 text-[10px] leading-none",
        isActive
          ? "border-amber-400 bg-amber-500 text-black shadow-[0_0_0_1px_rgba(245,158,11,0.35)]"
          : "border-amber-500/40 bg-amber-500/15 text-amber-700",
      ].join(" ")}
    >
      {label}
    </Badge>
  );
}
