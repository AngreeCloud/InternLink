"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Lock, Star, EyeOff } from "lucide-react";
import type {
  AvaliacaoConfig,
  NotaFinalProfessor,
  CursoDatasAvaliacao,
} from "@/lib/avaliacao/types";

type Props = {
  config: AvaliacaoConfig;
  professorData: NotaFinalProfessor | null;
  notaFinalCalculada: number | null;
  datas: CursoDatasAvaliacao | null;
};

export function AlunoEvaluationView({
  config,
  professorData,
  notaFinalCalculada,
  datas,
}: Props) {
  const now = new Date();
  const publicacaoDate = datas?.datas?.publicacaoNotaFinal
    ? new Date(datas.datas.publicacaoNotaFinal)
    : null;
  const isBlocked = publicacaoDate ? now < publicacaoDate : true;
  const hasFinalGrade = professorData?.estado === "assinado";

  if (isBlocked || !hasFinalGrade) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <div className="rounded-full bg-muted p-3 text-muted-foreground">
            <Lock className="h-6 w-6" />
          </div>
          <h3 className="text-base font-semibold text-balance">
            Nota indisponível
          </h3>
          <p className="max-w-md text-sm text-muted-foreground text-pretty">
            {!hasFinalGrade
              ? "A nota final do estágio ainda não foi publicada. Será disponibilizada após a avaliação ser concluída pelo tutor e professor."
              : `A nota final estará disponível a partir de ${publicacaoDate?.toLocaleDateString("pt-PT")}.`}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="border-green-200 bg-green-50">
        <CardContent className="flex flex-col items-center justify-center gap-3 py-12 text-center">
          <div className="rounded-full bg-green-100 p-4 text-green-700">
            <Star className="h-8 w-8" />
          </div>
          <div>
            <p className="text-sm text-green-700">Nota final do estágio</p>
            <p className="text-4xl font-bold text-green-800">
              {professorData?.notaFinal ?? "-"}
              <span className="text-lg font-normal text-green-600">
                {" "}
                / {config.notaFinalEsperada.max}
              </span>
            </p>
          </div>
          {professorData?.assinadoEm && (
            <p className="text-xs text-green-600">
              Publicado em{" "}
              {new Date(
                professorData.assinadoEm
              ).toLocaleDateString("pt-PT")}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Parameter details visible to student */}
      {professorData?.parametros && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Detalhes da avaliação
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {config.parametros.map((param) => (
              <div
                key={param.nome}
                className="flex justify-between text-sm"
              >
                <span className="text-muted-foreground">
                  {param.nome}
                </span>
                <span className="font-medium">
                  {professorData.parametros[param.nome] ?? "-"}
                  <span className="text-xs text-muted-foreground">
                    {" "}
                    /{config.escala.max}
                  </span>
                </span>
              </div>
            ))}
            <div className="flex justify-between border-t pt-2 text-sm font-semibold">
              <span>
                Nota calculada ({config.metodoCalculo})
              </span>
              <span>
                {notaFinalCalculada !== null
                  ? notaFinalCalculada
                  : "-"}
                {notaFinalCalculada !== null && (
                  <span className="text-xs font-normal text-muted-foreground">
                    {" "}
                    /{config.notaFinalEsperada.max}
                  </span>
                )}
              </span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
