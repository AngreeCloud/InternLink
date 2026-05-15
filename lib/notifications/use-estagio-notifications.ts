"use client";

import { useEffect, useState } from "react";
import { collectionGroup, limit, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { getDbRuntime } from "@/lib/firebase-runtime";

export type EstagioNotification = {
  id: string;
  userId: string;
  type: string;
  title: string;
  body: string;
  readAt: unknown;
  createdAt: unknown;
  createdAtMs: number;
  estagioId: string;
  requestId?: string;
  requestType?: string;
  targetDate?: string;
  docId?: string;
};

function toMillis(raw: unknown): number {
  if (!raw) return 0;
  if (typeof raw === "number") return raw;
  if (typeof raw === "string") {
    const parsed = Date.parse(raw);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  if (raw instanceof Date) return raw.getTime();
  if (typeof raw === "object") {
    const obj = raw as { seconds?: number; toDate?: () => Date };
    if (typeof obj.toDate === "function") return obj.toDate().getTime();
    if (typeof obj.seconds === "number") return obj.seconds * 1000;
  }
  return 0;
}

export function useEstagioNotifications(params: {
  userId: string;
  enabled: boolean;
  limitCount?: number;
}) {
  const { userId, enabled, limitCount = 100 } = params;
  const [notifications, setNotifications] = useState<EstagioNotification[]>([]);

  useEffect(() => {
    if (!enabled || !userId) {
      setNotifications([]);
      return;
    }

    let unsubscribe = () => {};
    let cancelled = false;

    (async () => {
      try {
        const db = await getDbRuntime();
        if (cancelled) return;

        const q = query(
          collectionGroup(db, "notifications"),
          where("userId", "==", userId),
          orderBy("createdAt", "desc"),
          limit(limitCount)
        );

        unsubscribe = onSnapshot(
          q,
          (snap) => {
            const next: EstagioNotification[] = snap.docs.map((docSnap) => {
              const data = docSnap.data() as Record<string, unknown>;
              const estagioId =
                (data.estagioId as string | undefined) ?? docSnap.ref.parent.parent?.id ?? "";

              return {
                id: docSnap.id,
                userId: (data.userId as string | undefined) ?? "",
                type: (data.type as string | undefined) ?? "",
                title: (data.title as string | undefined) ?? "Notificacao",
                body: (data.body as string | undefined) ?? "",
                readAt: data.readAt ?? null,
                createdAt: data.createdAt ?? null,
                createdAtMs: toMillis(data.createdAt),
                estagioId,
                requestId: data.requestId as string | undefined,
                requestType: data.requestType as string | undefined,
                targetDate: data.targetDate as string | undefined,
                docId: data.docId as string | undefined,
              };
            });
            setNotifications(next);
          },
          (err) => {
            console.error("[v0] estagio notifications snapshot", err);
            setNotifications([]);
          }
        );
      } catch (err) {
        console.error("[v0] estagio notifications init", err);
        setNotifications([]);
      }
    })();

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [enabled, limitCount, userId]);

  return { notifications };
}
