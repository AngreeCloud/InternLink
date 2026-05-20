import { useState, useEffect } from "react";
import { collection, collectionGroup, onSnapshot, query, where } from "firebase/firestore";
import { getAuthRuntime, getDbRuntime } from "@/lib/firebase-runtime";

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

      // Firestore doesn't let us directly query subcollection based on parent's field
      // easily without a specific index. But wait, `tutorId` is on `estagios` not on `sumarios`.
      // So we have two ways:
      // 1. Listen to all 'estagios' where tutorId = userId, then listen to their 'sumarios'.
      // 2. Add tutorId directly to sumarios.

      // We'll use approach 1 since we can't easily backfill tutorId right now.
      
      const estagiosQuery = query(collection(db, "estagios"), where("tutorId", "==", userId));
      
      unsub = onSnapshot(estagiosQuery, (estagiosSnap) => {
        if (isCancelled) return;
        
        const estagioIds = estagiosSnap.docs.map(doc => doc.id);
        
        if (estagioIds.length === 0) {
          setCount(0);
          return;
        }

        // We can use collectionGroup if we had the index, but we don't.
        // We will attach listeners to each estagio's sumarios collection.
        // For performance, this is fine if the number of estagios is low (typically < 10 for a tutor).
        
        const unsubs: Array<() => void> = [];
        let totalCount = 0;
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
          
          const u = onSnapshot(sumariosQuery, (sumariosSnap) => {
            // Count those not yet signed
            const pendingCount = sumariosSnap.docs.filter(doc => !doc.data().signedByTutor).length;
            countsByEstagio.set(estagioId, pendingCount);
            updateCount();
          });
          
          unsubs.push(u);
        }
        
        unsub = () => {
          for (const u of unsubs) u();
        };
      });

    })();

    return () => {
      isCancelled = true;
      unsub();
    };
  }, [userId]);

  return count;
}
