"use client";

import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { getDbRuntime } from "@/lib/firebase-runtime";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Building2, MapPin } from "lucide-react";
import {
  calcularDataFimEstimada,
  DEFAULT_DIAS_SEMANA,
  formatIsoDatePt,
  type DiasSemana,
} from "@/lib/estagios/date-calc";

const DAY_LABEL: Record<keyof DiasSemana, string> = {
  seg: "Segunda",
  ter: "Terça",
  qua: "Quarta",
  qui: "Quinta",
  sex: "Sexta",
  sab: "Sábado",
  dom: "Domingo",
};

const DAY_ORDER: (keyof DiasSemana)[] = ["seg", "ter", "qua", "qui", "sex", "sab", "dom"];

type EmpresaOption = {
  id: string;
  nome: string;
  morada?: string;
  codigoPostal?: string;
  localidade?: string;
  nif?: string;
  setor?: string;
};

export type EditableEstagio = {
  id: string;
  titulo?: string;
  empresa?: string;
  entidadeAcolhimento?: string;
  empresaId?: string;
  dataInicio?: string;
  totalHoras?: number;
  horasDiarias?: number;
  diasSemana?: Partial<DiasSemana>;
};

type Props = {
  estagio: EditableEstagio | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
};

function normalize(input?: Partial<DiasSemana>): DiasSemana {
  return {
    seg: Boolean(input?.seg),
    ter: Boolean(input?.ter),
    qua: Boolean(input?.qua),
    qui: Boolean(input?.qui),
    sex: Boolean(input?.sex),
    sab: Boolean(input?.sab),
    dom: Boolean(input?.dom),
  };
}

export function EditEstagioDialog({ estagio, open, onOpenChange, onSaved }: Props) {
  const [titulo, setTitulo] = useState("");
  const [dataInicio, setDataInicio] = useState("");
  const [totalHoras, setTotalHoras] = useState<number>(600);
  const [horasDiarias, setHorasDiarias] = useState<number>(7);
  const [diasSemana, setDiasSemana] = useState<DiasSemana>(DEFAULT_DIAS_SEMANA);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [empresaSearch, setEmpresaSearch] = useState("");
  const [empresaOptions, setEmpresaOptions] = useState<EmpresaOption[]>([]);
  const [empresaOpen, setEmpresaOpen] = useState(false);
  const [empresaHighlight, setEmpresaHighlight] = useState(0);
  const [selectedEmpresa, setSelectedEmpresa] = useState<EmpresaOption | null>(null);
  const [empresaInitialized, setEmpresaInitialized] = useState(false);
  const empresaRootRef = useRef<HTMLDivElement | null>(null);
  const empresaDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchEmpresas = useCallback(async (query: string) => {
    try {
      const res = await fetch(`/api/empresas/search?q=${encodeURIComponent(query)}`);
      if (!res.ok) return;
      const data = (await res.json()) as { empresas?: EmpresaOption[] };
      setEmpresaOptions(data.empresas ?? []);
    } catch {
      setEmpresaOptions([]);
    }
  }, []);

  useEffect(() => {
    if (!open || !estagio) return;
    setTitulo(estagio.titulo ?? "");
    setDataInicio(estagio.dataInicio ?? "");
    setTotalHoras(Number.isFinite(estagio.totalHoras) ? Number(estagio.totalHoras) : 600);
    setHorasDiarias(Number.isFinite(estagio.horasDiarias) ? Number(estagio.horasDiarias) : 7);
    setDiasSemana(normalize(estagio.diasSemana));
    setErrorMessage(null);
    setSubmitting(false);

    const nome = estagio.entidadeAcolhimento ?? estagio.empresa ?? "";
    setEmpresaSearch(nome);
    setSelectedEmpresa(null);
    setEmpresaInitialized(false);
    setEmpresaOpen(false);
  }, [open, estagio]);

  useEffect(() => {
    if (empresaInitialized || !estagio || !open) return;
    if (estagio.empresaId && estagio.empresaId !== "undefined") {
      setEmpresaInitialized(true);
      fetch(`/api/empresas/search?q=${encodeURIComponent(estagio.empresaId)}`)
        .then((r) => r.json())
        .then((data: { empresas?: EmpresaOption[] }) => {
          const match = (data.empresas ?? []).find((e) => e.id === estagio.empresaId);
          if (match) {
            setSelectedEmpresa(match);
            setEmpresaSearch(match.nome);
          }
        })
        .catch(() => {});
    }
  }, [estagio, open, empresaInitialized]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (empresaRootRef.current && !empresaRootRef.current.contains(event.target as Node)) {
        setEmpresaOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    setEmpresaHighlight(0);
  }, [empresaOptions]);

  const handleEmpresaInput = (value: string) => {
    setEmpresaSearch(value);
    setSelectedEmpresa(null);
    if (empresaDebounceRef.current) clearTimeout(empresaDebounceRef.current);
    const q = value.trim();
    if (!q) {
      setEmpresaOptions([]);
      setEmpresaOpen(false);
      return;
    }
    setEmpresaOpen(true);
    empresaDebounceRef.current = setTimeout(() => fetchEmpresas(q), 250);
  };

  const selectEmpresa = (opt: EmpresaOption) => {
    setSelectedEmpresa(opt);
    setEmpresaSearch(opt.nome);
    setEmpresaOpen(false);
    setEmpresaOptions([]);
  };

  const clearEmpresa = () => {
    setSelectedEmpresa(null);
    setEmpresaSearch("");
    setEmpresaOpen(false);
  };

  const handleEmpresaKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!empresaOpen || empresaOptions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setEmpresaHighlight((prev) => Math.min(prev + 1, empresaOptions.length - 1));
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setEmpresaHighlight((prev) => Math.max(prev - 1, 0));
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const opt = empresaOptions[empresaHighlight];
      if (opt) selectEmpresa(opt);
    }
    if (e.key === "Escape") {
      setEmpresaOpen(false);
    }
  };

  const dateResult = useMemo(() => {
    if (!dataInicio || !totalHoras || !horasDiarias) return null;
    return calcularDataFimEstimada({
      dataInicio,
      totalHoras: Number(totalHoras),
      horasDiarias: Number(horasDiarias),
      diasSemana,
    });
  }, [dataInicio, totalHoras, horasDiarias, diasSemana]);

  const toggleDay = (key: keyof DiasSemana) => {
    setDiasSemana((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = async () => {
    if (!estagio) return;
    setErrorMessage(null);

    const tituloTrim = titulo.trim();
    if (!tituloTrim) {
      setErrorMessage("Indique o título do estágio.");
      return;
    }
    if (!dataInicio) {
      setErrorMessage("Indique a data de início.");
      return;
    }
    if (!Number.isFinite(totalHoras) || totalHoras <= 0) {
      setErrorMessage("Total de horas deve ser positivo.");
      return;
    }
    if (!Number.isFinite(horasDiarias) || horasDiarias <= 0 || horasDiarias > 24) {
      setErrorMessage("Horas por dia inválidas (1-24).");
      return;
    }
    if (!DAY_ORDER.some((k) => diasSemana[k])) {
      setErrorMessage("Selecione pelo menos um dia da semana.");
      return;
    }

    setSubmitting(true);
    try {
      const db = await getDbRuntime();
      const calc = calcularDataFimEstimada({
        dataInicio,
        totalHoras: Number(totalHoras),
        horasDiarias: Number(horasDiarias),
        diasSemana,
      });

      const empresaNome = selectedEmpresa?.nome ?? empresaSearch.trim();

      const updatePayload: Record<string, unknown> = {
        titulo: tituloTrim,
        empresa: empresaNome,
        entidadeAcolhimento: empresaNome,
        dataInicio,
        totalHoras: Number(totalHoras),
        horasDiarias: Number(horasDiarias),
        diasSemana,
        dataFimEstimada: calc.dataFimEstimada,
        updatedAt: serverTimestamp(),
      };

      if (selectedEmpresa) {
        updatePayload.empresaId = selectedEmpresa.id;
      } else {
        updatePayload.empresaId = null;
      }

      await updateDoc(doc(db, "estagios", estagio.id), updatePayload);

      onOpenChange(false);
      onSaved?.();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro inesperado.";
      setErrorMessage(`Não foi possível guardar: ${message}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar estágio</DialogTitle>
          <DialogDescription>
            Atualize o título, empresa e horário do estágio. A data estimada de fim é recalculada
            automaticamente com base nas horas previstas, dias úteis e feriados nacionais portugueses.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="edit-titulo">Título</Label>
            <Input
              id="edit-titulo"
              value={titulo}
              onChange={(event) => setTitulo(event.target.value)}
              placeholder="Ex: Estágio em Desenvolvimento Web"
            />
          </div>

          <div className="space-y-2" ref={empresaRootRef}>
            <Label htmlFor="edit-empresa">Entidade de acolhimento / Empresa</Label>
            {selectedEmpresa ? (
              <div className="flex items-center gap-3 rounded-md border border-border bg-muted/30 px-3 py-2">
                <Building2 className="h-5 w-5 text-muted-foreground shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{selectedEmpresa.nome}</p>
                  <p className="text-xs text-muted-foreground">
                    {[selectedEmpresa.localidade, selectedEmpresa.codigoPostal].filter(Boolean).join(" · ")}
                    {selectedEmpresa.nif ? ` · NIF ${selectedEmpresa.nif}` : ""}
                  </p>
                </div>
                <Button type="button" variant="ghost" size="sm" onClick={clearEmpresa}>
                  Alterar
                </Button>
              </div>
            ) : (
              <div className="relative">
                <Input
                  id="edit-empresa"
                  placeholder="Pesquisar empresa ou escrever livremente..."
                  value={empresaSearch}
                  onChange={(e) => handleEmpresaInput(e.target.value)}
                  onFocus={() => {
                    if (empresaSearch.trim()) setEmpresaOpen(true);
                  }}
                  onKeyDown={handleEmpresaKeyDown}
                  autoComplete="off"
                  role="combobox"
                  aria-expanded={empresaOpen}
                />
                {empresaOpen && empresaOptions.length > 0 && (
                  <div className="absolute z-40 mt-1 max-h-48 w-full overflow-y-auto rounded-md border bg-background shadow-md">
                    {empresaOptions.map((opt, i) => (
                      <button
                        key={opt.id}
                        type="button"
                        className={[
                          "flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition-colors",
                          i === empresaHighlight ? "bg-muted" : "hover:bg-muted",
                        ].join(" ")}
                        onClick={() => selectEmpresa(opt)}
                        onMouseEnter={() => setEmpresaHighlight(i)}
                      >
                        <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">{opt.nome}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {[opt.localidade, opt.setor].filter(Boolean).join(" · ")}
                          </p>
                        </div>
                        {opt.localidade && (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                            <MapPin className="h-3 w-3" />
                            {opt.localidade}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
                {empresaSearch.trim() && !selectedEmpresa && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Se a empresa não aparecer na lista, podes escrever o nome manualmente.
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="edit-data-inicio">Data de início</Label>
              <Input
                id="edit-data-inicio"
                type="date"
                value={dataInicio}
                onChange={(event) => setDataInicio(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-total-horas">Total de horas</Label>
              <Input
                id="edit-total-horas"
                type="number"
                min={1}
                value={totalHoras}
                onChange={(event) => setTotalHoras(Number(event.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-horas-diarias">Horas por dia</Label>
              <Input
                id="edit-horas-diarias"
                type="number"
                min={1}
                max={24}
                step={0.5}
                value={horasDiarias}
                onChange={(event) => setHorasDiarias(Number(event.target.value))}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Dias da semana ativos</Label>
            <div className="flex flex-wrap gap-2">
              {DAY_ORDER.map((key) => (
                <Button
                  key={key}
                  type="button"
                  size="sm"
                  variant={diasSemana[key] ? "default" : "outline"}
                  onClick={() => toggleDay(key)}
                >
                  {DAY_LABEL[key]}
                </Button>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-border bg-muted/40 p-4">
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <Badge variant="secondary">Pré-visualização</Badge>
              {dateResult && dateResult.diasUteis > 0 ? (
                <>
                  <span>
                    Data estimada de fim:{" "}
                    <strong>{formatIsoDatePt(dateResult.dataFimEstimada)}</strong>
                  </span>
                  <span className="text-muted-foreground">
                    ({dateResult.diasUteis} dias úteis • feriados nacionais PT excluídos)
                  </span>
                </>
              ) : (
                <span className="text-muted-foreground">
                  Preencha data de início, total de horas e horário para ver a previsão.
                </span>
              )}
            </div>
          </div>

          {errorMessage ? (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {errorMessage}
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline" disabled={submitting}>
              Cancelar
            </Button>
          </DialogClose>
          <Button type="button" onClick={handleSave} disabled={submitting}>
            {submitting ? "A guardar..." : "Guardar alterações"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
