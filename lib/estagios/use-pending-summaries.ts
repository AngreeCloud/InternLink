import { useState, useEffect } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { getDbRuntime } from "@/lib/firebase-runtime";

export function usePendingSummaries(userId: string | undefined) {
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
            const sumariosQuery = query(
              collection(db, "estagios", estagioId, "sumarios"),
              where("estado", "==", "preenchido")
            );

            const u = onSnapshot(
              sumariosQuery,
              (sumariosSnap) => {
                const pendingCount = sumariosSnap.docs.filter((doc) => !doc.data().signedByTutor).length;
                countsByEstagio.set(estagioId, pendingCount);
                updateCount();
              },
              () => {
                // Ignore — typically permission-denied after logout
              }
            );

            unsubs.push(u);
          }

          unsub = () => {
            for (const u of unsubs) u();
          };
        },
        () => {
          // Ignore — typically permission-denied after logout
        }
      );
    })();

    return () => {
      isCancelled = true;
      unsub();
    };
  }, [userId]);

  return count;
}
