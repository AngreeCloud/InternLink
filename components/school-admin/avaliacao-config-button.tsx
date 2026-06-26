"use client";

import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { getDbRuntime } from "@/lib/firebase-runtime";
import { Button } from "@/components/ui/button";
import { Settings } from "lucide-react";
import { useSchoolAdmin } from "@/components/school-admin/school-admin-context";
import { AvaliacaoConfigDialog } from "./avaliacao-config-dialog";
import type { AvaliacaoConfig } from "@/lib/avaliacao/types";

export function AvaliacaoConfigButton() {
  const { schoolId } = useSchoolAdmin();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [config, setConfig] = useState<AvaliacaoConfig | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!dialogOpen) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const db = await getDbRuntime();
        const snap = await getDoc(doc(db, "schools", schoolId));
        if (cancelled) return;
        if (snap.exists()) {
          const data = snap.data() as Record<string, unknown>;
          setConfig(
            (data.avaliacaoConfig as AvaliacaoConfig | undefined) ?? null
          );
        }
      } catch {
        // silently ignore
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [dialogOpen, schoolId]);

  return (
    <>
      <Button
        size="lg"
        onClick={() => setDialogOpen(true)}
        className="w-full sm:w-auto"
      >
        <Settings className="mr-2 h-5 w-5" />
        Configurar Sistema de Avaliação
      </Button>
      <AvaliacaoConfigDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        currentConfig={config}
        onSaved={(newConfig) => setConfig(newConfig)}
      />
    </>
  );
}
