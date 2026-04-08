import { useState, useEffect, useRef, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';

// Configure worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

interface DocumentViewerProps {
  /** URL to the PDF file */
  pdfUrl: string;
  /** Current page (1-indexed), controlled externally */
  currentPage?: number;
  /** Callback when page changes */
  onPageChange?: (page: number) => void;
  /** Callback when total pages is known */
  onTotalPages?: (total: number) => void;
  /** Zoom level (1 = 100%) */
  zoom?: number;
  /** Overlay content rendered on top of each page */
  renderOverlay?: (pageNumber: number, dimensions: { width: number; height: number }) => React.ReactNode;
  /** CSS class for the container */
  className?: string;
}

function DocumentViewer({
  pdfUrl,
  currentPage: controlledPage,
  onPageChange,
  onTotalPages,
  zoom: controlledZoom,
  renderOverlay,
  className = '',
}: DocumentViewerProps) {
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [totalPages, setTotalPages] = useState<number>(0);
  const [internalPage, setInternalPage] = useState<number>(1);
  const [internalZoom, setInternalZoom] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [pageDimensions, setPageDimensions] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
  const [resizeKey, setResizeKey] = useState<number>(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const renderTaskRef = useRef<pdfjsLib.RenderTask | null>(null);

  const currentPage = controlledPage ?? internalPage;
  const zoom = controlledZoom ?? internalZoom;

  const setCurrentPage = useCallback((page: number) => {
    if (onPageChange) {
      onPageChange(page);
    } else {
      setInternalPage(page);
    }
  }, [onPageChange]);

  const setZoom = useCallback((z: number) => {
    setInternalZoom(z);
  }, []);

  // Load PDF
  useEffect(() => {
    if (!pdfUrl) return;
    setLoading(true);
    setError('');

    const loadingTask = pdfjsLib.getDocument(pdfUrl);
    loadingTask.promise.then(
      (doc) => {
        setPdfDoc(doc);
        setTotalPages(doc.numPages);
        if (onTotalPages) onTotalPages(doc.numPages);
        setLoading(false);
      },
      (err) => {
        console.error('PDF load error:', err);
        setError('Failed to load PDF document');
        setLoading(false);
      }
    );

    return () => {
      loadingTask.destroy();
    };
  }, [pdfUrl, onTotalPages]);

  // Render current page
  useEffect(() => {
    if (!pdfDoc || !canvasRef.current) return;

    const renderPage = async () => {
      // Cancel any ongoing render
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
        renderTaskRef.current = null;
      }

      try {
        const page = await pdfDoc.getPage(currentPage);
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Calculate scale to fit container width
        const containerWidth = containerRef.current?.clientWidth || 800;
        const viewport = page.getViewport({ scale: 1 });
        const baseScale = (containerWidth - 40) / viewport.width; // 40px padding
        const scale = baseScale * zoom;
        const scaledViewport = page.getViewport({ scale });

        const dpr = window.devicePixelRatio || 1;
        canvas.width = scaledViewport.width * dpr;
        canvas.height = scaledViewport.height * dpr;
        canvas.style.width = `${scaledViewport.width}px`;
        canvas.style.height = `${scaledViewport.height}px`;

        ctx.scale(dpr, dpr);

        setPageDimensions({ width: scaledViewport.width, height: scaledViewport.height });

        const renderContext = {
          canvasContext: ctx,
          viewport: scaledViewport,
        };

        const task = page.render(renderContext);
        renderTaskRef.current = task;
        await task.promise;
        renderTaskRef.current = null;
      } catch (err: unknown) {
        if (err && typeof err === 'object' && 'name' in err && (err as { name: string }).name !== 'RenderingCancelledException') {
          console.error('Render error:', err);
        }
      }
    };

    renderPage();
  }, [pdfDoc, currentPage, zoom, resizeKey]);

  // Re-render on resize
  useEffect(() => {
    const handleResize = () => {
      setResizeKey((k) => k + 1);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const goToPage = (page: number) => {
    const clamped = Math.max(1, Math.min(page, totalPages));
    setCurrentPage(clamped);
  };

  const zoomIn = () => setZoom(Math.min(3, zoom + 0.25));
  const zoomOut = () => setZoom(Math.max(0.5, zoom - 0.25));
  const fitWidth = () => setZoom(1);

  if (loading) {
    return (
      <div className={`flex items-center justify-center py-20 ${className}`}>
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500 text-sm">Loading document...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`flex items-center justify-center py-20 ${className}`}>
        <div className="text-center">
          <svg className="w-12 h-12 text-red-400 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <p className="text-red-600 text-sm font-medium">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col ${className}`} ref={containerRef}>
      {/* Toolbar */}
      <div className="flex items-center justify-between bg-gray-800 text-white px-4 py-2 rounded-t-lg text-sm flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => goToPage(currentPage - 1)}
            disabled={currentPage <= 1}
            className="px-2 py-1 bg-gray-700 rounded hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <span className="px-2 whitespace-nowrap">
            Page{' '}
            <input
              type="number"
              min={1}
              max={totalPages}
              value={currentPage}
              onChange={(e) => goToPage(parseInt(e.target.value) || 1)}
              className="w-12 bg-gray-700 text-white text-center rounded px-1 py-0.5 border border-gray-600 focus:border-indigo-400 outline-none"
            />{' '}
            of {totalPages}
          </span>
          <button
            onClick={() => goToPage(currentPage + 1)}
            disabled={currentPage >= totalPages}
            className="px-2 py-1 bg-gray-700 rounded hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={zoomOut}
            disabled={zoom <= 0.5}
            className="px-2 py-1 bg-gray-700 rounded hover:bg-gray-600 disabled:opacity-40 transition-colors"
            title="Zoom out"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
            </svg>
          </button>
          <span className="px-2 min-w-[3rem] text-center">{Math.round(zoom * 100)}%</span>
          <button
            onClick={zoomIn}
            disabled={zoom >= 3}
            className="px-2 py-1 bg-gray-700 rounded hover:bg-gray-600 disabled:opacity-40 transition-colors"
            title="Zoom in"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
          <button
            onClick={fitWidth}
            className="px-2 py-1 bg-gray-700 rounded hover:bg-gray-600 transition-colors text-xs"
            title="Fit width"
          >
            Fit
          </button>
        </div>
      </div>

      {/* Document area */}
      <div className="flex-1 overflow-auto bg-gray-200 flex justify-center p-5">
        <div className="relative inline-block shadow-lg">
          <canvas ref={canvasRef} className="block bg-white" />
          {/* Overlay layer for signature fields */}
          {renderOverlay && pageDimensions.width > 0 && (
            <div
              className="absolute inset-0"
              style={{ width: pageDimensions.width, height: pageDimensions.height }}
            >
              {renderOverlay(currentPage, pageDimensions)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default DocumentViewer;
