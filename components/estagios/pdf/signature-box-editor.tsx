"use client";

import { useEffect, useRef } from "react";
import type { EstagioRole } from "@/lib/estagios/permissions";
import type { SignatureBoxModel } from "@/components/estagios/pdf/signature-boxes-overlay";

type FabricModule = typeof import("fabric");

type SignatureBoxEditorProps = {
  boxes: SignatureBoxModel[];
  onChange: (nextBoxes: SignatureBoxModel[]) => void;
  selectedBoxId: string | null;
  onSelectBox: (boxId: string | null) => void;
  pageNumber: number;
  pageWidth: number;
  pageHeight: number;
  activeRole: EstagioRole | null;
  drawingEnabled: boolean;
};

const COLOR_BY_ROLE: Record<EstagioRole, string> = {
  diretor: "#0ea5e9",
  professor: "#16a34a",
  tutor: "#ea580c",
  aluno: "#7c3aed",
};

const ROLE_LABEL: Record<EstagioRole, string> = {
  diretor: "Diretor",
  professor: "Orientador",
  tutor: "Tutor",
  aluno: "Aluno",
};

function uid(): string {
  return `sb_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
}

export function SignatureBoxEditor({
  boxes,
  onChange,
  selectedBoxId,
  onSelectBox,
  pageNumber,
  pageWidth,
  pageHeight,
  activeRole,
  drawingEnabled,
}: SignatureBoxEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fabricCanvasRef = useRef<import("fabric").Canvas | null>(null);
  const boxesRef = useRef<SignatureBoxModel[]>(boxes);
  const onChangeRef = useRef(onChange);
  const onSelectRef = useRef(onSelectBox);
  const activeRoleRef = useRef(activeRole);
  const drawingEnabledRef = useRef(drawingEnabled);

  useEffect(() => {
    boxesRef.current = boxes;
  }, [boxes]);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    onSelectRef.current = onSelectBox;
  }, [onSelectBox]);

  useEffect(() => {
    activeRoleRef.current = activeRole;
  }, [activeRole]);

  useEffect(() => {
    drawingEnabledRef.current = drawingEnabled;
  }, [drawingEnabled]);

  useEffect(() => {
    let active = true;
    let fabricMod: FabricModule | null = null;
    let fabricCanvas: import("fabric").Canvas | null = null;
    let cleanupHandlers: (() => void) | null = null;

    (async () => {
      if (!canvasRef.current) return;
      fabricMod = (await import("fabric")) as FabricModule;
      if (!active || !canvasRef.current) return;

      fabricCanvas = new fabricMod.Canvas(canvasRef.current, {
        width: pageWidth,
        height: pageHeight,
        selection: true,
        fireRightClick: false,
        preserveObjectStacking: true,
        backgroundColor: undefined,
      });
      fabricCanvasRef.current = fabricCanvas;

      const rehydrate = () => {
        if (!fabricCanvas || !fabricMod) return;
        fabricCanvas.clear();
        const pageBoxes = boxesRef.current.filter((b) => b.page === pageNumber);
        for (const box of pageBoxes) {
          const color = box.color || (box.role ? COLOR_BY_ROLE[box.role] : "#64748b");
          const rect = new fabricMod.Rect({
            left: box.x * pageWidth,
            top: box.y * pageHeight,
            width: box.width * pageWidth,
            height: box.height * pageHeight,
            fill: `${color}1a`,
            stroke: color,
            strokeWidth: 2,
            strokeDashArray: [6, 4],
            cornerColor: color,
            borderColor: color,
            transparentCorners: false,
            hasRotatingPoint: false,
            lockRotation: true,
          });
          // @ts-expect-error custom prop
          rect.data = { boxId: box.id };
          fabricCanvas.add(rect);
          if (selectedBoxId === box.id) {
            fabricCanvas.setActiveObject(rect);
          }
        }
        fabricCanvas.requestRenderAll();
      };

      rehydrate();

      let isDrawing = false;
      let startX = 0;
      let startY = 0;
      let pendingRect: import("fabric").Rect | null = null;

      const onMouseDown = (opt: { e: MouseEvent | TouchEvent; target?: unknown }) => {
        if (!fabricCanvas || !fabricMod) return;
        if (opt.target) return; // clicou num box existente
        if (!drawingEnabledRef.current) return;
        const role = activeRoleRef.current;
        if (!role) return;
        const pointer = fabricCanvas.getPointer(opt.e as MouseEvent);
        startX = pointer.x;
        startY = pointer.y;
        isDrawing = true;
        const color = COLOR_BY_ROLE[role];
        pendingRect = new fabricMod.Rect({
          left: startX,
          top: startY,
          width: 1,
          height: 1,
          fill: `${color}1a`,
          stroke: color,
          strokeWidth: 2,
          strokeDashArray: [6, 4],
          cornerColor: color,
          borderColor: color,
          transparentCorners: false,
          hasRotatingPoint: false,
          lockRotation: true,
        });
        fabricCanvas.add(pendingRect);
      };

      const onMouseMove = (opt: { e: MouseEvent | TouchEvent }) => {
        if (!isDrawing || !fabricCanvas || !pendingRect) return;
        const pointer = fabricCanvas.getPointer(opt.e as MouseEvent);
        const w = Math.abs(pointer.x - startX);
        const h = Math.abs(pointer.y - startY);
        pendingRect.set({
          left: Math.min(pointer.x, startX),
          top: Math.min(pointer.y, startY),
          width: w,
          height: h,
        });
        fabricCanvas.requestRenderAll();
      };

      const onMouseUp = () => {
        if (!fabricCanvas || !pendingRect) {
          isDrawing = false;
          return;
        }
        const rect = pendingRect;
        isDrawing = false;
        pendingRect = null;
        const w = rect.width ?? 0;
        const h = rect.height ?? 0;
        if (w < 10 || h < 10) {
          fabricCanvas.remove(rect);
          return;
        }
        const role = activeRoleRef.current;
        if (!role) {
          fabricCanvas.remove(rect);
          return;
        }
        const newId = uid();
        // @ts-expect-error custom prop
        rect.data = { boxId: newId };
        const next: SignatureBoxModel = {
          id: newId,
          role,
          page: pageNumber,
          x: (rect.left ?? 0) / pageWidth,
          y: (rect.top ?? 0) / pageHeight,
          width: w / pageWidth,
          height: h / pageHeight,
          label: ROLE_LABEL[role],
        };
        const updated = [...boxesRef.current, next];
        onChangeRef.current(updated);
        onSelectRef.current(newId);
        fabricCanvas.setActiveObject(rect);
        fabricCanvas.requestRenderAll();
      };

      const onObjectModified = (opt: { target?: import("fabric").Object }) => {
        if (!opt.target) return;
        const target = opt.target;
        // @ts-expect-error custom prop
        const boxId: string | undefined = target.data?.boxId;
        if (!boxId) return;
        const scaleX = target.scaleX ?? 1;
        const scaleY = target.scaleY ?? 1;
        const newW = (target.width ?? 0) * scaleX;
        const newH = (target.height ?? 0) * scaleY;
        // Normalize: aplicar as escalas à largura/altura e repor scale para 1.
        target.set({ width: newW, height: newH, scaleX: 1, scaleY: 1 });
        const next: SignatureBoxModel | undefined = boxesRef.current.find((b) => b.id === boxId);
        if (!next) return;
        const updated = boxesRef.current.map((b) =>
          b.id === boxId
            ? {
                ...b,
                x: Math.max(0, Math.min(1, (target.left ?? 0) / pageWidth)),
                y: Math.max(0, Math.min(1, (target.top ?? 0) / pageHeight)),
                width: Math.max(0.01, Math.min(1, newW / pageWidth)),
                height: Math.max(0.01, Math.min(1, newH / pageHeight)),
              }
            : b
        );
        onChangeRef.current(updated);
      };

      const onSelection = (opt: { selected?: import("fabric").Object[] }) => {
        const first = opt.selected?.[0];
        if (!first) {
          onSelectRef.current(null);
          return;
        }
        // @ts-expect-error custom prop
        const boxId: string | undefined = first.data?.boxId;
        onSelectRef.current(boxId ?? null);
      };

      const onDeselect = () => {
        onSelectRef.current(null);
      };

      fabricCanvas.on("mouse:down", onMouseDown);
      fabricCanvas.on("mouse:move", onMouseMove);
      fabricCanvas.on("mouse:up", onMouseUp);
      fabricCanvas.on("object:modified", onObjectModified);
      fabricCanvas.on("selection:created", onSelection);
      fabricCanvas.on("selection:updated", onSelection);
      fabricCanvas.on("selection:cleared", onDeselect);

      cleanupHandlers = () => {
        fabricCanvas?.off("mouse:down", onMouseDown as never);
        fabricCanvas?.off("mouse:move", onMouseMove as never);
        fabricCanvas?.off("mouse:up", onMouseUp as never);
        fabricCanvas?.off("object:modified", onObjectModified as never);
        fabricCanvas?.off("selection:created", onSelection as never);
        fabricCanvas?.off("selection:updated", onSelection as never);
        fabricCanvas?.off("selection:cleared", onDeselect as never);
      };
    })();

    return () => {
      active = false;
      cleanupHandlers?.();
      fabricCanvasRef.current = null;
      fabricCanvas?.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageNumber, pageWidth, pageHeight]);

  // Rehydrate when boxes change externally
  useEffect(() => {
    const fabricCanvas = fabricCanvasRef.current;
    if (!fabricCanvas) return;
    const currentIds = new Set(
      fabricCanvas.getObjects().map((o) => {
        // @ts-expect-error custom prop
        return o.data?.boxId as string | undefined;
      })
    );
    const nextIds = new Set(boxes.filter((b) => b.page === pageNumber).map((b) => b.id));
    const needsRehydrate =
      currentIds.size !== nextIds.size ||
      [...nextIds].some((id) => !currentIds.has(id));

    if (!needsRehydrate) return;

    // Remove objetos extra
    for (const obj of fabricCanvas.getObjects()) {
      // @ts-expect-error custom prop
      const id: string | undefined = obj.data?.boxId;
      if (!id || !nextIds.has(id)) {
        fabricCanvas.remove(obj);
      }
    }
    // Carrega fabric dinamicamente para adicionar novos objetos
    void (async () => {
      const fabricMod = (await import("fabric")) as FabricModule;
      const existing = new Set(
        fabricCanvas.getObjects().map((o) => {
          // @ts-expect-error custom prop
          return o.data?.boxId as string | undefined;
        })
      );
      for (const box of boxes.filter((b) => b.page === pageNumber)) {
        if (existing.has(box.id)) continue;
        const color = box.color || (box.role ? COLOR_BY_ROLE[box.role] : "#64748b");
        const rect = new fabricMod.Rect({
          left: box.x * pageWidth,
          top: box.y * pageHeight,
          width: box.width * pageWidth,
          height: box.height * pageHeight,
          fill: `${color}1a`,
          stroke: color,
          strokeWidth: 2,
          strokeDashArray: [6, 4],
          cornerColor: color,
          borderColor: color,
          transparentCorners: false,
          hasRotatingPoint: false,
          lockRotation: true,
        });
        // @ts-expect-error custom prop
        rect.data = { boxId: box.id };
        fabricCanvas.add(rect);
      }
      fabricCanvas.requestRenderAll();
    })();
  }, [boxes, pageNumber, pageWidth, pageHeight]);

  return (
    <canvas
      ref={canvasRef}
      style={{ position: "absolute", inset: 0, pointerEvents: "auto" }}
    />
  );
}
