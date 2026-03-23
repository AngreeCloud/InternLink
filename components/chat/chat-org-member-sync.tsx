"use client";

import { useEffect } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { getAuthRuntime } from "@/lib/firebase-runtime";
import { ensureOrgMemberIndexByUserId } from "@/lib/chat/realtime-chat";

export function ChatOrgMemberSync() {
  useEffect(() => {
    let active = true;
    let unsubscribe = () => {};

    (async () => {
      try {
        const auth = await getAuthRuntime();
        unsubscribe = onAuthStateChanged(auth, (user) => {
          if (!active || !user) return;

          void ensureOrgMemberIndexByUserId(user.uid).catch(() => {
            // Keep auth flow resilient even if org index sync fails.
          });
        });
      } catch {
        // Ignore bootstrap errors here; chat screen handles its own error path.
      }
    })();

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  return null;
}
