import { useState, useCallback } from 'react';
import DocumentViewer from './DocumentViewer';
import SignatureFieldOverlay from './SignatureFieldOverlay';
import {
  SignatureField,
  FieldType,
  RECIPIENT_COLORS,
  FIELD_TYPE_LABELS,
  FIELD_TYPE_ICONS,
  DEFAULT_FIELD_SIZE,
} from '../types/signatureFields';

interface Recipient {
  email: string;
  name: string;
  order: number;
}

interface SignatureFieldPlacerProps {
  pdfUrl: string;
  recipients: Recipient[];
  fields: SignatureField[];
  onFieldsChange: (fields: SignatureField[]) => void;
}

let fieldIdCounter = 0;
function generateFieldId(): string {
  fieldIdCounter += 1;
  return `field_${Date.now()}_${fieldIdCounter}`;
}

function SignatureFieldPlacer({
  pdfUrl,
  recipients,
  fields,
  onFieldsChange,
}: SignatureFieldPlacerProps) {
  const [selectedFieldType, setSelectedFieldType] = useState<FieldType | null>(null);
  const [selectedRecipientIndex, setSelectedRecipientIndex] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);

  const handleFieldUpdate = useCallback((id: string, updates: Partial<SignatureField>) => {
    onFieldsChange(fields.map((f) => (f.id === id ? { ...f, ...updates } : f)));
  }, [fields, onFieldsChange]);

  const handleFieldDelete = useCallback((id: string) => {
    onFieldsChange(fields.filter((f) => f.id !== id));
  }, [fields, onFieldsChange]);

  const handleDocumentClick = useCallback((e: React.MouseEvent<HTMLDivElement>, pageNumber: number, dimensions: { width: number; height: number }) => {
    if (!selectedFieldType) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const xPercent = (clickX / dimensions.width) * 100;
    const yPercent = (clickY / dimensions.height) * 100;
    const size = DEFAULT_FIELD_SIZE[selectedFieldType];

    // Center the field on click position
    const fieldX = Math.max(0, Math.min(100 - size.width, xPercent - size.width / 2));
    const fieldY = Math.max(0, Math.min(100 - size.height, yPercent - size.height / 2));

    const newField: SignatureField = {
      id: generateFieldId(),
      type: selectedFieldType,
      page: pageNumber,
      x: fieldX,
      y: fieldY,
      width: size.width,
      height: size.height,
      recipientIndex: selectedRecipientIndex,
      required: selectedFieldType === 'signature' || selectedFieldType === 'initials',
    };

    onFieldsChange([...fields, newField]);
  }, [selectedFieldType, selectedRecipientIndex, fields, onFieldsChange]);

  const fieldTypes: FieldType[] = ['signature', 'initials', 'date', 'text'];

  // Validation: check which recipients lack signature fields
  const recipientsWithSignature = new Set(
    fields.filter((f) => f.type === 'signature').map((f) => f.recipientIndex)
  );

  const renderOverlay = useCallback((pageNumber: number, dimensions: { width: number; height: number }) => {
    return (
      <div
        className={`absolute inset-0 ${selectedFieldType ? 'cursor-crosshair' : ''}`}
        onClick={(e) => handleDocumentClick(e, pageNumber, dimensions)}
      >
        <SignatureFieldOverlay
          fields={fields}
          pageNumber={pageNumber}
          pageDimensions={dimensions}
          mode="edit"
          recipients={recipients}
          onFieldUpdate={handleFieldUpdate}
          onFieldDelete={handleFieldDelete}
        />
      </div>
    );
  }, [selectedFieldType, fields, recipients, handleFieldUpdate, handleFieldDelete, handleDocumentClick]);

  return (
    <div className="flex flex-col lg:flex-row gap-4">
      {/* Sidebar toolbar */}
      <div className="lg:w-64 shrink-0 space-y-4">
        {/* Field type selector */}
        <div className="bg-white rounded-xl shadow-sm p-4">
          <h4 className="text-sm font-semibold text-gray-900 mb-3">Field Types</h4>
          <p className="text-xs text-gray-500 mb-3">Select a field type, then click on the document to place it.</p>
          <div className="grid grid-cols-2 lg:grid-cols-1 gap-2">
            {fieldTypes.map((type) => (
              <button
                key={type}
                onClick={() => setSelectedFieldType(selectedFieldType === type ? null : type)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors text-left ${
                  selectedFieldType === type
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                }`}
              >
                <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={FIELD_TYPE_ICONS[type]} />
                </svg>
                {FIELD_TYPE_LABELS[type]}
              </button>
            ))}
          </div>
          {selectedFieldType && (
            <div className="mt-3 p-2 bg-indigo-50 rounded-lg space-y-1">
              <p className="text-xs text-indigo-700">
                Click on the document to place a "{FIELD_TYPE_LABELS[selectedFieldType]}" field.
              </p>
              <p className="text-[11px] text-indigo-600">
                {selectedFieldType === 'signature' || selectedFieldType === 'initials'
                  ? `${recipients[selectedRecipientIndex]?.name || 'The selected recipient'} will sign this field.`
                  : `${recipients[selectedRecipientIndex]?.name || 'The selected recipient'} will fill in this field when signing.`}
              </p>
            </div>
          )}
        </div>

        {/* Recipient selector */}
        <div className="bg-white rounded-xl shadow-sm p-4">
          <h4 className="text-sm font-semibold text-gray-900 mb-1">Who fills this field?</h4>
          <p className="text-[11px] text-gray-500 mb-3">
            Every field — including text and date — is filled by the recipient you pick here, not the sender.
          </p>
          <div className="space-y-2">
            {recipients.map((r, index) => {
              const colorIdx = index % RECIPIENT_COLORS.length;
              const c = RECIPIENT_COLORS[colorIdx];
              const hasSignature = recipientsWithSignature.has(index);
              return (
                <button
                  key={r.email}
                  onClick={() => setSelectedRecipientIndex(index)}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors text-left ${
                    selectedRecipientIndex === index
                      ? `${c.bg} ${c.border} border-2`
                      : 'bg-gray-50 border-2 border-transparent hover:bg-gray-100'
                  }`}
                >
                  <div className={`w-3 h-3 rounded-full shrink-0`} style={{ backgroundColor: c.hex }} />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate text-xs">{r.name}</p>
                    <p className="text-gray-500 truncate text-[10px]">{r.email}</p>
                  </div>
                  {hasSignature ? (
                    <svg className="w-4 h-4 text-green-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <span className="text-[10px] text-red-500 font-medium shrink-0">No sig</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Field summary */}
        <div className="bg-white rounded-xl shadow-sm p-4">
          <h4 className="text-sm font-semibold text-gray-900 mb-3">
            Placed Fields ({fields.length})
          </h4>
          {fields.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-2">No fields placed yet</p>
          ) : (
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {fields.map((f) => {
                const cIdx = f.recipientIndex % RECIPIENT_COLORS.length;
                const c = RECIPIENT_COLORS[cIdx];
                const rName = recipients[f.recipientIndex]?.name || `Recipient ${f.recipientIndex + 1}`;
                return (
                  <div key={f.id} className={`flex items-center justify-between px-2 py-1.5 rounded ${c.bg} text-xs`}>
                    <div className="flex items-center gap-1.5 min-w-0">
                      <svg className={`w-3 h-3 shrink-0 ${c.text}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={FIELD_TYPE_ICONS[f.type]} />
                      </svg>
                      <span className={`font-medium ${c.text} truncate`}>{FIELD_TYPE_LABELS[f.type]}</span>
                      <span className="text-gray-500">- {rName}</span>
                      <span className="text-gray-400">P{f.page}</span>
                    </div>
                    <button
                      onClick={() => handleFieldDelete(f.id)}
                      className="text-red-400 hover:text-red-600 shrink-0 ml-1"
                    >
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Document viewer */}
      <div className="flex-1 min-w-0">
        <DocumentViewer
          pdfUrl={pdfUrl}
          currentPage={currentPage}
          onPageChange={setCurrentPage}
          renderOverlay={renderOverlay}
          className="h-[70vh] rounded-lg overflow-hidden"
        />
      </div>
    </div>
  );
}

export default SignatureFieldPlacer;
