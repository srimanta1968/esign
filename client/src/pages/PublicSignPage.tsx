import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import DocumentViewer from '../components/DocumentViewer';
import SignatureFieldOverlay from '../components/SignatureFieldOverlay';
import SignaturePadComponent from '../components/SignaturePadComponent';
import {
  SignatureField,
  FieldType,
  FIELD_TYPE_LABELS,
} from '../types/signatureFields';

interface SigningContext {
  document_url: string;
  document_name: string;
  signer_name: string;
  signer_email: string;
  signer_index: number;
  recipients: { email: string; name: string; order: number }[];
  fields: {
    id: string;
    type: FieldType;
    page: number;
    x: number;
    y: number;
    width: number;
    height: number;
    recipient_index: number;
    required: boolean;
    value?: string;
    completed?: boolean;
  }[];
  workflow_name?: string;
}

function PublicSignPage() {
  const { token } = useParams<{ token: string }>();
  const [context, setContext] = useState<SigningContext | null>(null);
  const [fields, setFields] = useState<SignatureField[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [activeField, setActiveField] = useState<SignatureField | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [completed, setCompleted] = useState<boolean>(false);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Modal input states
  const [textValue, setTextValue] = useState<string>('');
  const [dateValue, setDateValue] = useState<string>(new Date().toLocaleDateString());

  useEffect(() => {
    const fetchContext = async () => {
      try {
        const res = await fetch(`/api/sign/${token}`);
        const data = await res.json();
        if (data.success && data.data) {
          setContext(data.data);
          // Map server fields to our SignatureField type
          const mapped: SignatureField[] = data.data.fields.map((f: any) => ({
            id: f.id,
            type: f.type as FieldType,
            page: f.page,
            x: f.x,
            y: f.y,
            width: f.width,
            height: f.height,
            recipientIndex: f.recipient_index,
            required: f.required,
            value: f.value || undefined,
            completed: f.completed || false,
          }));
          setFields(mapped);
        } else {
          setError(data.error || 'Invalid or expired signing link');
        }
      } catch {
        setError('Failed to load signing context');
      } finally {
        setLoading(false);
      }
    };
    fetchContext();
  }, [token]);

  const handleFieldClick = useCallback((field: SignatureField) => {
    if (field.completed) return;
    setActiveField(field);
    if (field.type === 'date') {
      setDateValue(new Date().toLocaleDateString());
    } else if (field.type === 'text') {
      setTextValue(field.value || '');
    }
  }, []);

  const handleSignatureCapture = useCallback((dataUrl: string) => {
    if (!activeField) return;
    setFields((prev) =>
      prev.map((f) =>
        f.id === activeField.id ? { ...f, value: dataUrl, completed: true } : f
      )
    );
    setActiveField(null);
  }, [activeField]);

  const handleDateConfirm = useCallback(() => {
    if (!activeField) return;
    setFields((prev) =>
      prev.map((f) =>
        f.id === activeField.id ? { ...f, value: dateValue, completed: true } : f
      )
    );
    setActiveField(null);
  }, [activeField, dateValue]);

  const handleTextConfirm = useCallback(() => {
    if (!activeField || !textValue.trim()) return;
    setFields((prev) =>
      prev.map((f) =>
        f.id === activeField.id ? { ...f, value: textValue.trim(), completed: true } : f
      )
    );
    setActiveField(null);
    setTextValue('');
  }, [activeField, textValue]);

  const handleCompleteSigning = async () => {
    setSubmitting(true);
    setError('');
    try {
      const fieldValues = fields
        .filter((f) => f.recipientIndex === context?.signer_index && f.completed)
        .map((f) => ({
          field_id: f.id,
          value: f.value,
        }));

      const res = await fetch(`/api/sign/${token}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields: fieldValues }),
      });
      const data = await res.json();
      if (data.success) {
        setCompleted(true);
      } else {
        setError(data.error || 'Failed to complete signing');
      }
    } catch {
      setError('An unexpected error occurred');
    } finally {
      setSubmitting(false);
    }
  };

  // Calculate completion
  const myFields = fields.filter((f) => f.recipientIndex === context?.signer_index);
  const requiredFields = myFields.filter((f) => f.required);
  const completedRequired = requiredFields.filter((f) => f.completed);
  const allRequiredDone = requiredFields.length > 0 && completedRequired.length === requiredFields.length;
  const completedCount = myFields.filter((f) => f.completed).length;

  const renderOverlay = useCallback((pageNumber: number, dimensions: { width: number; height: number }) => {
    return (
      <SignatureFieldOverlay
        fields={fields}
        pageNumber={pageNumber}
        pageDimensions={dimensions}
        mode="sign"
        recipients={context?.recipients || []}
        currentSignerIndex={context?.signer_index}
        onFieldClick={handleFieldClick}
      />
    );
  }, [fields, context, handleFieldClick]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500">Loading document...</p>
        </div>
      </div>
    );
  }

  if (error && !context) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-4">
          <svg className="w-16 h-16 text-red-400 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Unable to Load Document</h2>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  if (completed) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-4">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Document Signed!</h2>
          <p className="text-gray-600 mb-6">
            Thank you for signing. You will receive a confirmation email shortly.
          </p>
          <div className="bg-white rounded-xl shadow-sm p-6 text-left">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Document</span>
                <span className="font-medium text-gray-900">{context?.document_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Signed by</span>
                <span className="font-medium text-gray-900">{context?.signer_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Date</span>
                <span className="font-medium text-gray-900">{new Date().toLocaleDateString()}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg className="w-7 h-7 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span className="text-lg font-bold text-indigo-600">eDocSign</span>
          </div>
          <div className="text-sm text-gray-600">
            Signing as <span className="font-medium text-gray-900">{context?.signer_name}</span>
          </div>
        </div>
      </header>

      {/* Signing progress bar */}
      <div className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{context?.document_name}</h2>
            <p className="text-sm text-gray-500">
              {completedCount} of {myFields.length} fields completed
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="w-32 bg-gray-200 rounded-full h-2">
              <div
                className="bg-indigo-600 h-2 rounded-full transition-all duration-500"
                style={{ width: `${myFields.length > 0 ? (completedCount / myFields.length) * 100 : 0}%` }}
              />
            </div>
            <button
              onClick={handleCompleteSigning}
              disabled={!allRequiredDone || submitting}
              className="bg-indigo-600 text-white px-5 py-2 rounded-lg font-medium text-sm hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Submitting...' : 'Complete Signing'}
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="max-w-7xl mx-auto px-4 mt-4">
          <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm">{error}</div>
        </div>
      )}

      {/* Document */}
      <div className="flex-1 p-4">
        <div className="max-w-5xl mx-auto">
          <DocumentViewer
            pdfUrl={context?.document_url || ''}
            currentPage={currentPage}
            onPageChange={setCurrentPage}
            renderOverlay={renderOverlay}
            className="h-[calc(100vh-220px)] rounded-lg overflow-hidden"
          />
        </div>
      </div>

      {/* Signing Modal */}
      {activeField && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  {FIELD_TYPE_LABELS[activeField.type]}
                </h3>
                <button
                  onClick={() => setActiveField(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Signature type */}
              {activeField.type === 'signature' && (
                <div>
                  <p className="text-sm text-gray-600 mb-3">Draw your signature below:</p>
                  <SignaturePadComponent onSave={handleSignatureCapture} height={200} />
                </div>
              )}

              {/* Initials type */}
              {activeField.type === 'initials' && (
                <div>
                  <p className="text-sm text-gray-600 mb-3">Draw your initials below:</p>
                  <SignaturePadComponent onSave={handleSignatureCapture} height={120} />
                </div>
              )}

              {/* Date type */}
              {activeField.type === 'date' && (
                <div>
                  <p className="text-sm text-gray-600 mb-3">Confirm or edit the date:</p>
                  <input
                    type="text"
                    value={dateValue}
                    onChange={(e) => setDateValue(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none mb-4"
                  />
                  <button
                    onClick={handleDateConfirm}
                    className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium text-sm hover:bg-indigo-700 transition-colors"
                  >
                    Confirm Date
                  </button>
                </div>
              )}

              {/* Text type */}
              {activeField.type === 'text' && (
                <div>
                  <p className="text-sm text-gray-600 mb-3">Enter text:</p>
                  <input
                    type="text"
                    value={textValue}
                    onChange={(e) => setTextValue(e.target.value)}
                    placeholder="Type here..."
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none mb-4"
                    autoFocus
                    onKeyDown={(e) => e.key === 'Enter' && handleTextConfirm()}
                  />
                  <button
                    onClick={handleTextConfirm}
                    disabled={!textValue.trim()}
                    className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium text-sm hover:bg-indigo-700 transition-colors disabled:opacity-50"
                  >
                    Confirm
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default PublicSignPage;
