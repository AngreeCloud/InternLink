"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Loader2, Plus, Trash2, AlertCircle, Settings } from "lucide-react";
import { useSchoolAdmin } from "@/components/school-admin/school-admin-context";
import { validateConfig } from "@/lib/avaliacao/validations";
import type { AvaliacaoConfig, MetodoCalculo, ParametroAvaliacao } from "@/lib/avaliacao/types";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentConfig: AvaliacaoConfig | null;
  onSaved: (config: AvaliacaoConfig) => void;
};

export function AvaliacaoConfigDialog({
  open,
  onOpenChange,
  currentConfig,
  onSaved,
}: Props) {
  const { schoolId } = useSchoolAdmin();

  const [parametros, setParametros] = useState<ParametroAvaliacao[]>([
    { nome: "" },
  ]);
  const [escalaMin, setEscalaMin] = useState(1);
  const [escalaMax, setEscalaMax] = useState(5);
  const [metodoCalculo, setMetodoCalculo] = useState<MetodoCalculo>("soma");
  const [notaFinalMin, setNotaFinalMin] = useState(4);
  const [notaFinalMax, setNotaFinalMax] = useState(20);
  const [permitirTutorVerNotaFinal, setPermitirTutorVerNotaFinal] =
    useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setError(null);
      setValidationError(null);
      return;
    }

    if (currentConfig) {
      setParametros(
        currentConfig.parametros.length > 0
          ? currentConfig.parametros
          : [{ nome: "" }]
      );
      setEscalaMin(currentConfig.escala.min);
      setEscalaMax(currentConfig.escala.max);
      setMetodoCalculo(currentConfig.metodoCalculo);
      setNotaFinalMin(currentConfig.notaFinalEsperada.min);
      setNotaFinalMax(currentConfig.notaFinalEsperada.max);
      setPermitirTutorVerNotaFinal(
        currentConfig.permitirTutorVerNotaFinal
      );
    }
  }, [open, currentConfig]);

  const addParametro = () => {
    setParametros((prev) => [...prev, { nome: "" }]);
  };

  const removeParametro = (index: number) => {
    setParametros((prev) => prev.filter((_, i) => i !== index));
  };

  const updateParametroNome = (index: number, nome: string) => {
    setParametros((prev) =>
      prev.map((p, i) => (i === index ? { ...p, nome } : p))
    );
  };

  const buildConfig = (): AvaliacaoConfig => {
    return {
      parametros: parametros.filter((p) => p.nome.trim().length > 0),
      escala: { min: escalaMin, max: escalaMax },
      metodoCalculo,
      notaFinalEsperada: { min: notaFinalMin, max: notaFinalMax },
      permitirTutorVerNotaFinal,
    };
  };

  const handleSave = async () => {
    setError(null);
    setValidationError(null);

    const config = buildConfig();

    if (config.parametros.length === 0) {
      setValidationError("Adicione pelo menos um parâmetro de avaliação.");
      return;
    }

    const validation = validateConfig(config);
    if (!validation.valid) {
      setValidationError(validation.error ?? "Configuração inválida.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/school-admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avaliacaoConfig: config }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setError(data.error || "Falha ao guardar configuração.");
        return;
      }
      onSaved(config);
      onOpenChange(false);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Erro inesperado."
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Configurar Sistema de Avaliação
          </DialogTitle>
          <DialogDescription>
            Defina os parâmetros, escala e método de cálculo para as avaliações
            de estágio da escola.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* Parâmetros */}
          <div className="space-y-2">
            <Label>Parâmetros de Avaliação</Label>
            <div className="space-y-2">
              {parametros.map((param, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Input
                    placeholder={`Parâmetro ${index + 1}`}
                    value={param.nome}
                    onChange={(e) =>
                      updateParametroNome(index, e.target.value)
                    }
                    className="flex-1"
                  />
                  {parametros.length > 1 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeParametro(index)}
                      className="shrink-0 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={addParametro}
              className="mt-1"
            >
              <Plus className="mr-1 h-4 w-4" />
              Adicionar parâmetro
            </Button>
          </div>

          {/* Escala dos parâmetros */}
          <div className="space-y-2">
            <Label>Escala dos parâmetros (uniforme)</Label>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Label className="text-xs text-muted-foreground">Mín</Label>
                <Input
                  type="number"
                  value={escalaMin}
                  onChange={(e) => setEscalaMin(Number(e.target.value) || 0)}
                  className="w-20"
                />
              </div>
              <span className="text-muted-foreground">a</span>
              <div className="flex items-center gap-2">
                <Label className="text-xs text-muted-foreground">Máx</Label>
                <Input
                  type="number"
                  value={escalaMax}
                  onChange={(e) => setEscalaMax(Number(e.target.value) || 0)}
                  className="w-20"
                />
              </div>
            </div>
          </div>

          {/* Método */}
          <div className="space-y-2">
            <Label>Método de cálculo</Label>
            <Select
              value={metodoCalculo}
              onValueChange={(v) =>
                setMetodoCalculo(v as MetodoCalculo)
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="soma">
                  Soma — as notas dos parâmetros são somadas
                </SelectItem>
                <SelectItem value="media">
                  Média — calcula a média das notas dos parâmetros
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Nota final esperada */}
          <div className="space-y-2">
            <Label>Escala da nota final esperada</Label>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Label className="text-xs text-muted-foreground">Mín</Label>
                <Input
                  type="number"
                  value={notaFinalMin}
                  onChange={(e) =>
                    setNotaFinalMin(Number(e.target.value) || 0)
                  }
                  className="w-20"
                />
              </div>
              <span className="text-muted-foreground">a</span>
              <div className="flex items-center gap-2">
                <Label className="text-xs text-muted-foreground">Máx</Label>
                <Input
                  type="number"
                  value={notaFinalMax}
                  onChange={(e) =>
                    setNotaFinalMax(Number(e.target.value) || 0)
                  }
                  className="w-20"
                />
              </div>
            </div>
            {metodoCalculo === "soma" && parametros.filter((p) => p.nome.trim()).length > 0 && (
              <p className="text-xs text-muted-foreground">
                Com {parametros.filter((p) => p.nome.trim()).length} parâmetro(s) de {escalaMin}-{escalaMax}, soma ={" "}
                {parametros.filter((p) => p.nome.trim()).length * escalaMin}-
                {parametros.filter((p) => p.nome.trim()).length * escalaMax}
              </p>
            )}
          </div>

          {/* Toggle visibilidade */}
          <div className="flex items-center justify-between rounded-md border border-border p-3">
            <div>
              <Label className="cursor-pointer">
                Permitir que o tutor veja a nota final
              </Label>
              <p className="text-xs text-muted-foreground">
                Quando ativo, o tutor poderá ver a nota final atribuída pelo
                professor após este assinar.
              </p>
            </div>
            <Switch
              checked={permitirTutorVerNotaFinal}
              onCheckedChange={setPermitirTutorVerNotaFinal}
            />
          </div>

          {/* Erros */}
          {validationError && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{validationError}</span>
            </div>
          )}
          {error && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                A guardar...
              </>
            ) : (
              "Guardar configuração"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
