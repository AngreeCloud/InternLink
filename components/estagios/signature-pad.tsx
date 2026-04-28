"use client";

import { useCallback, useEffect, useImperativeHandle, useRef, forwardRef } from "react";

export type SignaturePadHandle = {
  clear: () => void;
  toDataUrl: () => string | null;
  isEmpty: () => boolean;
};

type SignaturePadProps = {
  width?: number;
  height?: number;
  className?: string;
  strokeColor?: string;
  strokeWidth?: number;
};

export const SignaturePad = forwardRef<SignaturePadHandle, SignaturePadProps>(function SignaturePad(
  { width = 480, height = 160, className, strokeColor = "#0f172a", strokeWidth = 2.2 },
  ref
) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const hasContentRef = useRef(false);

  const getContext = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    return canvas.getContext("2d");
  }, []);

  const resize = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = strokeWidth;
      ctx.fillStyle = "rgba(0,0,0,0)";
      ctx.clearRect(0, 0, width, height);
    }
  }, [width, height, strokeColor, strokeWidth]);

  useEffect(() => {
    resize();
  }, [resize]);

  const eventPos = (e: PointerEvent): { x: number; y: number } => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const handleDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.setPointerCapture(e.pointerId);
    drawingRef.current = true;
    const pos = eventPos(e.nativeEvent);
    lastPointRef.current = pos;
    const ctx = getContext();
    if (!ctx) return;
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    ctx.lineTo(pos.x + 0.01, pos.y + 0.01);
    ctx.stroke();
    hasContentRef.current = true;
  };

  const handleMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    const ctx = getContext();
    if (!ctx) return;
    const pos = eventPos(e.nativeEvent);
    const last = lastPointRef.current || pos;
    ctx.beginPath();
    ctx.moveTo(last.x, last.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    lastPointRef.current = pos;
    hasContentRef.current = true;
  };

  const handleUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (canvas && canvas.hasPointerCapture(e.pointerId)) {
      canvas.releasePointerCapture(e.pointerId);
    }
    drawingRef.current = false;
    lastPointRef.current = null;
  };

  useImperativeHandle(
    ref,
    () => ({
      clear: () => {
        const ctx = getContext();
        if (ctx) ctx.clearRect(0, 0, width, height);
        hasContentRef.current = false;
      },
      toDataUrl: () => {
        if (!hasContentRef.current) return null;
        const canvas = canvasRef.current;
        if (!canvas) return null;
        return canvas.toDataURL("image/png");
      },
      isEmpty: () => !hasContentRef.current,
    }),
    [getContext, width, height]
  );

  return (
    <div className={className}>
      <canvas
        ref={canvasRef}
        onPointerDown={handleDown}
        onPointerMove={handleMove}
        onPointerUp={handleUp}
        onPointerCancel={handleUp}
        style={{
          border: "1px dashed var(--border, #e5e7eb)",
          borderRadius: 8,
          background: "#fff",
          touchAction: "none",
          cursor: "crosshair",
        }}
      />
    </div>
  );
});
