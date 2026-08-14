'use client';

import { useEffect, useRef, useState } from 'react';

interface ScratchCardProps {
  /** Вміст під покриттям (знижка). */
  children: React.ReactNode;
  /** Викликається один раз, коли стерто достатньо (~40%). */
  onReveal: () => void;
  /** true — показати одразу відкритою (знижка вже активована раніше). */
  revealed?: boolean;
}

const REVEAL_THRESHOLD = 0.4; // частка стертого, після якої відкриваємо все
const BRUSH_RADIUS = 26;

// Кольори покриття — canvas не читає CSS-токени, тому hex продубльовані
// з globals.css: ink #201e1d (фон), cream #f5ead8 (текст-підказка).
const COVER_BG = '#201e1d';
const COVER_TEXT = '#f5ead8';

export function ScratchCard({ children, onReveal, revealed = false }: ScratchCardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [done, setDone] = useState(revealed);
  const doneRef = useRef(revealed);
  const scratching = useRef(false);
  const strokes = useRef(0);

  useEffect(() => {
    if (doneRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const { width, height } = canvas.getBoundingClientRect();
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    ctx.fillStyle = COVER_BG;
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = COVER_TEXT;
    ctx.font = '600 16px var(--font-manrope), sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Потри тут', width / 2, height / 2 - 14);
    ctx.font = '28px sans-serif';
    ctx.fillText('👆', width / 2, height / 2 + 18);
  }, []);

  const finish = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    setDone(true);
    onReveal();
  };

  // Частка прозорих пікселів; семплюємо кожен 16-й піксель — цього досить.
  const erasedRatio = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    const data = ctx.getImageData(0, 0, w, h).data;
    let clear = 0;
    let total = 0;
    for (let i = 3; i < data.length; i += 64) {
      total += 1;
      if (data[i] === 0) clear += 1;
    }
    return total ? clear / total : 0;
  };

  const scratchAt = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(clientX - rect.left, clientY - rect.top, BRUSH_RADIUS, 0, Math.PI * 2);
    ctx.fill();

    strokes.current += 1;
    if (strokes.current % 12 === 0) {
      if (erasedRatio(ctx, canvas.width, canvas.height) >= REVEAL_THRESHOLD) finish();
    }
  };

  return (
    <div className="relative w-full max-w-[280px] overflow-hidden rounded-3xl shadow-soft">
      <div className="flex aspect-[4/5] w-full flex-col items-center justify-center bg-card p-6 text-center dark:bg-night-card">
        {children}
      </div>
      {!done && (
        <canvas
          ref={canvasRef}
          className="absolute inset-0 h-full w-full touch-none"
          onPointerDown={(e) => {
            scratching.current = true;
            (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
            scratchAt(e.clientX, e.clientY);
          }}
          onPointerMove={(e) => {
            if (scratching.current) scratchAt(e.clientX, e.clientY);
          }}
          onPointerUp={() => {
            scratching.current = false;
            // Фінальна перевірка після відпускання — раптом поріг щойно пройдено.
            const canvas = canvasRef.current;
            const ctx = canvas?.getContext('2d');
            if (canvas && ctx && erasedRatio(ctx, canvas.width, canvas.height) >= REVEAL_THRESHOLD) {
              finish();
            }
          }}
        />
      )}
    </div>
  );
}
