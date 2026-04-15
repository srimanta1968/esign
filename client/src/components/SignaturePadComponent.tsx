import { useRef, useState, useEffect, useCallback } from 'react';

interface Point {
  x: number;
  y: number;
  pressure: number;
  time: number;
}

interface SignaturePadProps {
  onSave?: (dataUrl: string) => void;
  width?: number;
  height?: number;
}

function SignaturePadComponent({ onSave, height = 200 }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState<boolean>(false);
  const [history, setHistory] = useState<ImageData[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const [hasContent, setHasContent] = useState<boolean>(false);
  const lastPoint = useRef<Point | null>(null);

  const initCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);
    canvas.style.height = `${height}px`;

    ctx.strokeStyle = '#1e3a5f';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Save initial blank state
    const initial = ctx.getImageData(0, 0, canvas.width, canvas.height);
    setHistory([initial]);
    setHistoryIndex(0);
  }, [height]);

  useEffect(() => {
    initCanvas();
    const handleResize = (): void => { initCanvas(); };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [initCanvas]);

  const getPoint = (e: React.PointerEvent<HTMLCanvasElement>): Point => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      pressure: e.pressure || 0.5,
      time: Date.now(),
    };
  };

  const drawSegment = (from: Point, to: Point): void => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Variable width based on pressure and speed
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const dt = to.time - from.time || 1;
    const speed = dist / dt;
    const pressureWidth = to.pressure * 3;
    const speedWidth = Math.max(0.5, 3 - speed * 0.5);
    const lineWidth = Math.max(1, Math.min(4, (pressureWidth + speedWidth) / 2));

    ctx.beginPath();
    ctx.lineWidth = lineWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>): void => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.setPointerCapture(e.pointerId);
    setIsDrawing(true);
    const point = getPoint(e);
    lastPoint.current = point;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#1e3a5f';
      ctx.beginPath();
      ctx.arc(point.x, point.y, 1.2, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>): void => {
    if (!isDrawing || !lastPoint.current) return;
    e.preventDefault();
    const point = getPoint(e);
    drawSegment(lastPoint.current, point);
    lastPoint.current = point;
    setHasContent(true);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>): void => {
    if (!isDrawing) return;
    e.preventDefault();
    setIsDrawing(false);
    lastPoint.current = null;

    // Save state for undo
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(imageData);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  const undo = (): void => {
    if (historyIndex <= 0) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const newIndex = historyIndex - 1;
    ctx.putImageData(history[newIndex], 0, 0);
    setHistoryIndex(newIndex);
    setHasContent(newIndex > 0);
  };

  const redo = (): void => {
    if (historyIndex >= history.length - 1) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const newIndex = historyIndex + 1;
    ctx.putImageData(history[newIndex], 0, 0);
    setHistoryIndex(newIndex);
    setHasContent(true);
  };

  const clear = (): void => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const blankState = ctx.getImageData(0, 0, canvas.width, canvas.height);
    setHistory([blankState]);
    setHistoryIndex(0);
    setHasContent(false);
  };

  const getDataUrl = (): string => {
    const canvas = canvasRef.current;
    if (!canvas) return '';
    return canvas.toDataURL('image/png');
  };

  const handleSave = (): void => {
    if (onSave && hasContent) {
      onSave(getDataUrl());
    }
  };

  return (
    <div className="w-full">
      <div className="relative border-2 border-dashed border-gray-300 rounded-lg bg-white overflow-hidden">
        <canvas
          ref={canvasRef}
          className="w-full cursor-crosshair"
          style={{ touchAction: 'none', height: `${height}px` }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
        />
        {!hasContent && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <p className="text-gray-300 text-sm">Draw your signature here</p>
          </div>
        )}
      </div>
      <div className="flex items-center justify-between mt-3">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={undo}
            disabled={historyIndex <= 0}
            className="px-3 py-1.5 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-30"
          >
            Undo
          </button>
          <button
            type="button"
            onClick={redo}
            disabled={historyIndex >= history.length - 1}
            className="px-3 py-1.5 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-30"
          >
            Redo
          </button>
          <button
            type="button"
            onClick={clear}
            className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            Clear
          </button>
        </div>
        {onSave && (
          <button
            type="button"
            onClick={handleSave}
            disabled={!hasContent}
            className="bg-indigo-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50"
          >
            Save Signature
          </button>
        )}
      </div>
    </div>
  );
}

export default SignaturePadComponent;
