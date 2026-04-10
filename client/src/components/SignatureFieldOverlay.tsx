import { useState, useRef, useCallback } from 'react';
import {
  SignatureField,
  RECIPIENT_COLORS,
  FIELD_TYPE_LABELS,
  FIELD_TYPE_ICONS,
} from '../types/signatureFields';

interface Recipient {
  email: string;
  name: string;
  order: number;
}

interface SignatureFieldOverlayProps {
  fields: SignatureField[];
  pageNumber: number;
  pageDimensions: { width: number; height: number };
  mode: 'edit' | 'sign';
  recipients?: Recipient[];
  /** Index of current signer (sign mode) */
  currentSignerIndex?: number;
  onFieldUpdate?: (id: string, updates: Partial<SignatureField>) => void;
  onFieldDelete?: (id: string) => void;
  onFieldClick?: (field: SignatureField) => void;
}

function SignatureFieldOverlay({
  fields,
  pageNumber,
  pageDimensions,
  mode,
  recipients = [],
  currentSignerIndex,
  onFieldUpdate,
  onFieldDelete,
  onFieldClick,
}: SignatureFieldOverlayProps) {
  const pageFields = fields.filter((f) => f.page === pageNumber);

  return (
    <div className="absolute inset-0" style={{ width: pageDimensions.width, height: pageDimensions.height }}>
      {pageFields.map((field) => (
        <FieldBox
          key={field.id}
          field={field}
          pageDimensions={pageDimensions}
          mode={mode}
          recipients={recipients}
          currentSignerIndex={currentSignerIndex}
          onUpdate={onFieldUpdate}
          onDelete={onFieldDelete}
          onClick={onFieldClick}
        />
      ))}
    </div>
  );
}

interface FieldBoxProps {
  field: SignatureField;
  pageDimensions: { width: number; height: number };
  mode: 'edit' | 'sign';
  recipients: Recipient[];
  currentSignerIndex?: number;
  onUpdate?: (id: string, updates: Partial<SignatureField>) => void;
  onDelete?: (id: string) => void;
  onClick?: (field: SignatureField) => void;
}

function FieldBox({
  field,
  pageDimensions,
  mode,
  recipients,
  currentSignerIndex,
  onUpdate,
  onDelete,
  onClick,
}: FieldBoxProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const dragStart = useRef<{ x: number; y: number; fieldX: number; fieldY: number }>({ x: 0, y: 0, fieldX: 0, fieldY: 0 });
  const resizeStart = useRef<{ x: number; y: number; w: number; h: number }>({ x: 0, y: 0, w: 0, h: 0 });
  const boxRef = useRef<HTMLDivElement>(null);

  const colorIndex = field.recipientIndex % RECIPIENT_COLORS.length;
  const colors = RECIPIENT_COLORS[colorIndex];
  const recipientName = recipients[field.recipientIndex]?.name || `Recipient ${field.recipientIndex + 1}`;
  const isCurrentSigner = currentSignerIndex === field.recipientIndex;
  const isCompleted = field.completed;

  // Convert percentage coords to pixels
  const left = (field.x / 100) * pageDimensions.width;
  const top = (field.y / 100) * pageDimensions.height;
  const width = (field.width / 100) * pageDimensions.width;
  const height = (field.height / 100) * pageDimensions.height;

  const handleDragStart = useCallback((e: React.MouseEvent) => {
    if (mode !== 'edit') return;
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY, fieldX: field.x, fieldY: field.y };

    const handleMove = (me: MouseEvent) => {
      const dx = me.clientX - dragStart.current.x;
      const dy = me.clientY - dragStart.current.y;
      const newX = dragStart.current.fieldX + (dx / pageDimensions.width) * 100;
      const newY = dragStart.current.fieldY + (dy / pageDimensions.height) * 100;
      const clampedX = Math.max(0, Math.min(100 - field.width, newX));
      const clampedY = Math.max(0, Math.min(100 - field.height, newY));
      onUpdate?.(field.id, { x: clampedX, y: clampedY });
    };

    const handleUp = () => {
      setIsDragging(false);
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleUp);
    };

    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleUp);
  }, [mode, field, pageDimensions, onUpdate]);

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    if (mode !== 'edit') return;
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    resizeStart.current = { x: e.clientX, y: e.clientY, w: field.width, h: field.height };

    const handleMove = (me: MouseEvent) => {
      const dx = me.clientX - resizeStart.current.x;
      const dy = me.clientY - resizeStart.current.y;
      const newW = resizeStart.current.w + (dx / pageDimensions.width) * 100;
      const newH = resizeStart.current.h + (dy / pageDimensions.height) * 100;
      const clampedW = Math.max(5, Math.min(100 - field.x, newW));
      const clampedH = Math.max(3, Math.min(100 - field.y, newH));
      onUpdate?.(field.id, { width: clampedW, height: clampedH });
    };

    const handleUp = () => {
      setIsResizing(false);
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleUp);
    };

    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleUp);
  }, [mode, field, pageDimensions, onUpdate]);

  const handleClick = (e: React.MouseEvent) => {
    // Always stop propagation so clicks on a field (including the synthetic
    // click fired after a drag) never bubble to the parent overlay and
    // accidentally place a new field at the drop location.
    e.stopPropagation();
    if (mode === 'sign' && isCurrentSigner && !isCompleted) {
      onClick?.(field);
    }
  };

  // Sign mode styling
  let borderStyle = `border-2 border-dashed ${colors.border}`;
  let bgStyle = `${colors.bg} bg-opacity-40`;
  let cursorStyle = mode === 'edit' ? 'cursor-move' : 'cursor-default';

  if (mode === 'sign') {
    if (isCompleted) {
      borderStyle = 'border-2 border-solid border-green-400';
      bgStyle = 'bg-green-50 bg-opacity-60';
    } else if (isCurrentSigner) {
      borderStyle = `border-2 border-solid ${colors.border} animate-pulse`;
      cursorStyle = 'cursor-pointer';
    } else {
      borderStyle = 'border-2 border-dashed border-gray-300';
      bgStyle = 'bg-gray-100 bg-opacity-40';
    }
  }

  return (
    <div
      ref={boxRef}
      className={`absolute ${borderStyle} ${bgStyle} ${cursorStyle} rounded-sm select-none group transition-shadow ${
        isDragging || isResizing ? 'ring-2 ring-indigo-400 shadow-lg z-20' : 'z-10 hover:shadow-md'
      }`}
      style={{
        left: `${left}px`,
        top: `${top}px`,
        width: `${width}px`,
        height: `${height}px`,
      }}
      onMouseDown={mode === 'edit' ? handleDragStart : undefined}
      onClick={handleClick}
    >
      {/* Field content */}
      <div className="flex items-center gap-1 px-1 py-0.5 overflow-hidden h-full">
        {isCompleted && mode === 'sign' ? (
          <div className="flex items-center justify-center w-full h-full">
            {field.value && (field.type === 'signature' || field.type === 'initials') ? (
              <img src={field.value} alt="Signed" className="max-w-full max-h-full object-contain" />
            ) : (
              <div className="flex items-center gap-1">
                <svg className="w-4 h-4 text-green-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-green-700 text-xs font-medium truncate">{field.value || 'Completed'}</span>
              </div>
            )}
          </div>
        ) : (
          <>
            <svg className={`w-3 h-3 shrink-0 ${mode === 'sign' && !isCurrentSigner ? 'text-gray-400' : colors.text}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={FIELD_TYPE_ICONS[field.type]} />
            </svg>
            <span className={`text-xs truncate ${mode === 'sign' && !isCurrentSigner ? 'text-gray-400' : colors.text}`}>
              {FIELD_TYPE_LABELS[field.type]}
            </span>
          </>
        )}
      </div>

      {/* Recipient tag (edit mode) */}
      {mode === 'edit' && (
        <div className={`absolute -top-5 left-0 ${colors.bg} ${colors.text} text-[10px] font-medium px-1.5 py-0.5 rounded-t whitespace-nowrap`}>
          {recipientName}
          {field.required && (
            <span className="ml-1 bg-red-100 text-red-600 px-1 rounded text-[9px]">Required</span>
          )}
        </div>
      )}

      {/* Sign mode: recipient tag */}
      {mode === 'sign' && !isCompleted && isCurrentSigner && (
        <div className={`absolute -top-5 left-0 ${colors.bg} ${colors.text} text-[10px] font-medium px-1.5 py-0.5 rounded-t whitespace-nowrap`}>
          Click to {field.type === 'signature' ? 'sign' : field.type === 'initials' ? 'initial' : 'fill'}
        </div>
      )}

      {/* Delete button (edit mode) */}
      {mode === 'edit' && (
        <button
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onDelete?.(field.id);
          }}
          className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600 text-xs shadow-sm"
          title="Delete field"
        >
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}

      {/* Resize handle (edit mode) */}
      {mode === 'edit' && (
        <div
          className="absolute bottom-0 right-0 w-3 h-3 cursor-se-resize opacity-0 group-hover:opacity-100 transition-opacity"
          onMouseDown={handleResizeStart}
        >
          <svg className="w-3 h-3 text-gray-500" viewBox="0 0 10 10">
            <path d="M9 1L1 9M9 5L5 9M9 9L9 9" stroke="currentColor" strokeWidth="1.5" fill="none" />
          </svg>
        </div>
      )}
    </div>
  );
}

export default SignatureFieldOverlay;
