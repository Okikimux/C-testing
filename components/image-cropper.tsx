'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Crop, Minus, Plus, X } from 'lucide-react';
import { baseNameOf, canvasToFile, clampCenter, renderSquare, zoomRange } from '../lib/image-tools';

const MAX_ZOOM = 4;

export type ImageCropperProps = {
  file: File;
  title?: string;
  subtitle?: string;
  confirmLabel?: string;
  /** Receives the square photo. Throw to show an error inside the cropper; the parent closes it on success. */
  onConfirm: (square: File) => Promise<void> | void;
  onCancel: () => void;
};

/** Renders a File as an <img>, releasing its object URL when it changes or unmounts. */
export function FileImage({ file, alt }: { file: File; alt: string }) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    const next = URL.createObjectURL(file);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [file]);
  // eslint-disable-next-line @next/next/no-img-element
  return url ? <img src={url} alt={alt} /> : null;
}

/** Square (1:1) photo cropper. Every CARTOMUX listing photo is square so it fits cards and the product page. */
export function ImageCropper({ file, title = 'Crop photo', subtitle, confirmLabel = 'Use photo', onConfirm, onCancel }: ImageCropperProps) {
  const [url, setUrl] = useState('');
  const imageRef = useRef<HTMLImageElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState(0);
  const [natural, setNatural] = useState<{ width: number; height: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [center, setCenter] = useState({ x: 0, y: 0 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  /* The newest values live in a ref too, so rapid pointer events never read stale state. */
  const live = useRef({ zoom: 1, x: 0, y: 0 });
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ distance: number; zoom: number } | null>(null);

  useEffect(() => {
    const next = URL.createObjectURL(file);
    setUrl(next);
    setNatural(null);
    setError('');
    return () => URL.revokeObjectURL(next);
  }, [file]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const observer = new ResizeObserver(entries => setSize(Math.round(entries[0].contentRect.width)));
    observer.observe(stage);
    setSize(Math.round(stage.getBoundingClientRect().width));
    return () => observer.disconnect();
  }, []);

  const range = useMemo(() => (natural && size ? zoomRange(natural.width, natural.height, size) : null), [natural, size]);
  const minZoom = range ? Math.min(1, range.fit / range.fill) : 1;
  const scale = range ? zoom * range.fill : 1;

  const apply = useCallback((nextZoom: number, x: number, y: number) => {
    if (!natural || !range) return;
    const bounded = Math.min(MAX_ZOOM, Math.max(minZoom, nextZoom));
    const centered = clampCenter(natural.width, natural.height, { viewport: size, scale: bounded * range.fill, centerX: x, centerY: y });
    live.current = { zoom: bounded, x: centered.centerX, y: centered.centerY };
    setZoom(bounded);
    setCenter({ x: centered.centerX, y: centered.centerY });
  }, [natural, range, minZoom, size]);

  // Start every photo filling the square, centred.
  useEffect(() => {
    if (natural) apply(1, natural.width / 2, natural.height / 2);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [natural]);

  // Keep the framing when the dialog is resized (rotating a phone, for example).
  useEffect(() => {
    if (natural && size) apply(live.current.zoom, live.current.x, live.current.y);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size]);

  // Mouse wheel / trackpad zoom needs a non-passive listener so the page does not scroll.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      apply(live.current.zoom * Math.exp(-event.deltaY * 0.0018), live.current.x, live.current.y);
    };
    stage.addEventListener('wheel', onWheel, { passive: false });
    return () => stage.removeEventListener('wheel', onWheel);
  }, [apply]);

  const cancelRef = useRef(onCancel);
  cancelRef.current = onCancel;

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    sheetRef.current?.focus();
    return () => { document.body.style.overflow = previous; };
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape' && !busy) cancelRef.current(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [busy]);

  function pointerDown(event: React.PointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = Array.from(pointers.current.values());
      pinch.current = { distance: Math.hypot(a.x - b.x, a.y - b.y) || 1, zoom: live.current.zoom };
    }
  }
  function pointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const previous = pointers.current.get(event.pointerId);
    if (!previous) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.current.size === 2 && pinch.current) {
      const [a, b] = Array.from(pointers.current.values());
      const distance = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      apply(pinch.current.zoom * (distance / pinch.current.distance), live.current.x, live.current.y);
    } else if (pointers.current.size === 1) {
      const currentScale = live.current.zoom * (range?.fill || 1);
      apply(live.current.zoom, live.current.x - (event.clientX - previous.x) / currentScale, live.current.y - (event.clientY - previous.y) / currentScale);
    }
  }
  function pointerUp(event: React.PointerEvent<HTMLDivElement>) {
    pointers.current.delete(event.pointerId);
    pinch.current = null;
  }
  function keyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const step = 24 / scale;
    const moves: Record<string, [number, number]> = { ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] };
    if (moves[event.key]) { event.preventDefault(); apply(live.current.zoom, live.current.x - moves[event.key][0], live.current.y - moves[event.key][1]); }
    else if (event.key === '+' || event.key === '=') { event.preventDefault(); apply(live.current.zoom * 1.12, live.current.x, live.current.y); }
    else if (event.key === '-') { event.preventDefault(); apply(live.current.zoom / 1.12, live.current.x, live.current.y); }
  }

  const sliderValue = minZoom < MAX_ZOOM ? Math.round((Math.log(zoom / minZoom) / Math.log(MAX_ZOOM / minZoom)) * 1000) : 0;
  const fillActive = Math.abs(zoom - 1) < 0.02;
  const fitActive = minZoom < 0.98 && Math.abs(zoom - minZoom) < 0.02;
  const left = natural ? size / 2 - center.x * scale : 0;
  const top = natural ? size / 2 - center.y * scale : 0;
  const markSize = Math.max(10, size * 0.034);

  async function confirm() {
    const image = imageRef.current;
    if (!image || !natural || !size || busy) return;
    setBusy(true);
    setError('');
    try {
      const canvas = renderSquare(image, { viewport: size, scale, centerX: center.x, centerY: center.y });
      const square = await canvasToFile(canvas, `${baseNameOf(file)}-square`, 0.94);
      await onConfirm(square);
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : 'This photo could not be cropped. Please try another image.');
      setBusy(false);
    }
  }

  return (
    <div className="sheetOverlay cropOverlay" onMouseDown={event => { if (event.target === event.currentTarget && !busy) onCancel(); }}>
      <div ref={sheetRef} tabIndex={-1} className="sheet cropSheet" role="dialog" aria-modal="true" aria-labelledby="crop-title">
        <div className="sheetHead">
          <span className="sheetIcon"><Crop size={22} /></span>
          <div className="sheetTitle"><h3 id="crop-title">{title}</h3><p>{subtitle || 'Drag to position your photo. Pinch or use the slider to zoom.'}</p></div>
          <button type="button" className="iconBtn" aria-label="Cancel crop" onClick={onCancel} disabled={busy}><X size={18} /></button>
        </div>

        <div
          ref={stageRef}
          className="cropStage"
          tabIndex={0}
          role="application"
          aria-label="Photo crop area. Use arrow keys to move and plus or minus to zoom."
          onPointerDown={pointerDown}
          onPointerMove={pointerMove}
          onPointerUp={pointerUp}
          onPointerCancel={pointerUp}
          onKeyDown={keyDown}
        >
          {url && <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="cropBackdrop" src={url} alt="" aria-hidden="true" draggable={false} />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              ref={imageRef}
              className="cropImage"
              src={url}
              alt="Photo being cropped"
              draggable={false}
              onLoad={event => setNatural({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })}
              onError={() => setError('This photo could not be opened. Please choose a JPG, PNG or WebP image.')}
              style={natural ? { width: natural.width * scale, height: natural.height * scale, transform: `translate3d(${left}px, ${top}px, 0)` } : { opacity: 0 }}
            />
          </>}
          <div className="cropGrid" aria-hidden="true" />
          {size > 0 && <div className="cropMark" aria-hidden="true" style={{ fontSize: markSize, right: size * 0.035, bottom: size * 0.035 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/campusdrop-logo.png" alt="" style={{ height: markSize * 1.5 }} />
            <span>CARTOMUX</span>
          </div>}
        </div>

        <div className="cropControls">
          <button type="button" className="iconBtn" aria-label="Zoom out" onClick={() => apply(live.current.zoom / 1.2, live.current.x, live.current.y)} disabled={!natural}><Minus size={16} /></button>
          <input type="range" min={0} max={1000} value={sliderValue} aria-label="Zoom" disabled={!natural || minZoom >= MAX_ZOOM} onChange={event => apply(minZoom * Math.pow(MAX_ZOOM / minZoom, Number(event.target.value) / 1000), live.current.x, live.current.y)} />
          <button type="button" className="iconBtn" aria-label="Zoom in" onClick={() => apply(live.current.zoom * 1.2, live.current.x, live.current.y)} disabled={!natural}><Plus size={16} /></button>
        </div>
        <div className="segmented cropFit" role="group" aria-label="Photo framing">
          <button type="button" className={fillActive ? 'active' : ''} disabled={!natural} onClick={() => natural && apply(1, natural.width / 2, natural.height / 2)}>Fill square</button>
          <button type="button" className={fitActive ? 'active' : ''} disabled={!natural || minZoom >= 0.98} onClick={() => natural && apply(minZoom, natural.width / 2, natural.height / 2)}>Fit whole photo</button>
        </div>
        <p className="cropHint">The faint CARTOMUX watermark goes in the bottom-right corner, so keep your product clear of it.</p>

        {error && <div className="error" role="alert">{error}</div>}
        <div className="sheetActions">
          <button type="button" className="btn light" onClick={onCancel} disabled={busy}>Cancel</button>
          <button type="button" className="btn green" onClick={confirm} disabled={busy || !natural}>{busy ? 'Preparing...' : confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
