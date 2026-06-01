import { useState, useEffect } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { getDbRuntime } from "@/lib/firebase-runtime";

export function usePendingRequests(userId: string | undefined) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!userId) {
      setCount(0);
      return;
    }

    let unsub = () => {};
    let isCancelled = false;

    (async () => {
      const db = await getDbRuntime();
      if (isCancelled) return;

      const estagiosQuery = query(collection(db, "estagios"), where("tutorId", "==", userId));

      unsub = onSnapshot(
        estagiosQuery,
        (estagiosSnap) => {
          if (isCancelled) return;

          const estagioIds = estagiosSnap.docs.map((doc) => doc.id);

          if (estagioIds.length === 0) {
            setCount(0);
            return;
          }

          const unsubs: Array<() => void> = [];
          const countsByEstagio = new Map<string, number>();

          const updateCount = () => {
            let c = 0;
            for (const v of countsByEstagio.values()) c += v;
            setCount(c);
          };

          for (const estagioId of estagioIds) {
            const requestsQuery = query(
              collection(db, "estagios", estagioId, "schedule_change_requests"),
              where("status", "==", "pending_tutor")
            );

            const u = onSnapshot(
              requestsQuery,
              (snap) => {
                countsByEstagio.set(estagioId, snap.docs.length);
                updateCount();
              },
              () => {}
            );

            unsubs.push(u);
          }

          unsub = () => {
            for (const u of unsubs) u();
          };
        },
        () => {}
      );
    })();

    return () => {
      isCancelled = true;
      unsub();
    };
  }, [userId]);

  return count;
}
