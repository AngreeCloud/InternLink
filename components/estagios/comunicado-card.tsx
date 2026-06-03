"use client";

import { Card, CardContent } from "@/components/ui/card";
import { formatIsoPt } from "@/lib/estagios/workdays";
import { Megaphone } from "lucide-react";

type Props = {
  targetDate: string;
  reason: string;
};

export function ComunicadoCard({ targetDate, reason }: Props) {
  return (
    <Card className="border-blue-300 bg-blue-100 shadow-sm">
      <CardContent className="flex items-start gap-3 px-4 py-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-200 text-blue-700">
          <Megaphone className="h-4 w-4" />
        </div>
        <div className="min-w-0 space-y-0.5">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-blue-900">
              Comunicado da empresa
            </span>
          </div>
          <p className="text-xs font-medium text-blue-700">
            {formatIsoPt(targetDate)}
          </p>
          <p className="text-sm text-blue-800/90 break-words">{reason}</p>
        </div>
      </CardContent>
    </Card>
  );
}
