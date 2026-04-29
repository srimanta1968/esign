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
  workflow: { id: string; status: string; workflow_type: string };
  document: { id: string; name: string; file_type: string; mime_type: string } | null;
  recipient: { id: string; email: string; name: string; status: string; signing_order: number };
  sender: { name: string; email: string } | null;
  fields: {
    id: string;
    field_type: FieldType;
    page: number;
    x: number;
    y: number;
    width: number;
    height: number;
    required: boolean;
  }[];
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
  const [alreadySigned, setAlreadySigned] = useState<{ name: string; email: string; signed_at: string | null; document_name: string } | null>(null);
  const [cancelledInfo, setCancelledInfo] = useState<{ name: string; email: string; document_name: string } | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [welcomeOpen, setWelcomeOpen] = useState<boolean>(true);

  // Modal input states
  const [textValue, setTextValue] = useState<string>('');
  const [dateValue, setDateValue] = useState<string>(new Date().toLocaleDateString());

  useEffect(() => {
    const fetchContext = async () => {
      try {
        const res = await fetch(`/api/sign/${token}`);
        const data = await res.json();
        if (data.success && data.data && data.data.cancelled) {
          setCancelledInfo({
            name: data.data.recipient?.name || '',
            email: data.data.recipient?.email || '',
            document_name: data.data.document?.name || 'Document',
          });
        } else if (data.success && data.data && data.data.already_signed) {
          setAlreadySigned({
            name: data.data.recipient?.name || '',
            email: data.data.recipient?.email || '',
            signed_at: data.data.recipient?.signed_at || null,
            document_name: data.data.document?.name || 'Document',
          });
        } else if (data.success && data.data) {
          setContext(data.data);
          // Notify backend that the signing page has been opened (idempotent)
          fetch(`/api/sign/${token}/started`, { method: 'POST' }).catch(() => {});
          // Map server fields to our SignatureField type
          const mapped: SignatureField[] = data.data.fields.map((f: any) => ({
            id: f.id,
            type: f.field_type as FieldType,
            page: f.page,
            x: f.x,
            y: f.y,
            width: f.width,
            height: f.height,
            recipientIndex: 0,
            required: f.required,
            label: f.label ?? null,
            value: undefined,
            completed: false,
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
      const signatures = fields
        .filter((f) => f.completed)
        .map((f) => ({
          fieldId: f.id,
          signatureData: f.value || '',
          signatureType: (f.type === 'signature' || f.type === 'initials') ? 'drawn' : f.type,
        }));

      const res = await fetch(`/api/sign/${token}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signatures }),
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

  // Calculate completion — all fields belong to the current signer
  const requiredFields = fields.filter((f) => f.required);
  const completedRequired = requiredFields.filter((f) => f.completed);
  const allRequiredDone = requiredFields.length > 0 && completedRequired.length === requiredFields.length;
  const completedCount = fields.filter((f) => f.completed).length;

  // Next unsigned field in reading order: (page asc, y asc, x asc), required first
  const nextField = (() => {
    const pending = fields.filter((f) => !f.completed);
    if (pending.length === 0) return null;
    const sorted = [...pending].sort((a, b) => {
      if ((a.required ? 0 : 1) !== (b.required ? 0 : 1)) return (a.required ? 0 : 1) - (b.required ? 0 : 1);
      if (a.page !== b.page) return a.page - b.page;
      if (a.y !== b.y) return a.y - b.y;
      return a.x - b.x;
    });
    return sorted[0];
  })();

  const nextButtonLabel = completedCount === 0 ? 'Start' : (nextField ? 'Next' : 'Finish');

  const handleJumpToNext = useCallback(() => {
    if (!nextField) return;
    setWelcomeOpen(false);
    if (nextField.page !== currentPage) setCurrentPage(nextField.page);
    // Allow the page to render before scrolling/opening the modal.
    setTimeout(() => {
      const el = document.querySelector<HTMLElement>(`[data-field-id="${nextField.id}"]`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      handleFieldClick(nextField);
    }, nextField.page !== currentPage ? 250 : 0);
  }, [nextField, currentPage, handleFieldClick]);

  const handleJumpToField = useCallback((field: SignatureField) => {
    setWelcomeOpen(false);
    if (field.page !== currentPage) setCurrentPage(field.page);
    setTimeout(() => {
      const el = document.querySelector<HTMLElement>(`[data-field-id="${field.id}"]`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      if (!field.completed) handleFieldClick(field);
    }, field.page !== currentPage ? 250 : 0);
  }, [currentPage, handleFieldClick]);

  const renderOverlay = useCallback((pageNumber: number, dimensions: { width: number; height: number }) => {
    return (
      <SignatureFieldOverlay
        fields={fields}
        pageNumber={pageNumber}
        pageDimensions={dimensions}
        mode="sign"
        recipients={[]}
        currentSignerIndex={0}
        nextFieldId={nextField?.id ?? null}
        onFieldClick={handleFieldClick}
      />
    );
  }, [fields, nextField, handleFieldClick]);

  const downloadUrl = `/api/sign/${token}/document?download=1`;
  const viewUrl = `/api/sign/${token}/document`;

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

  if (cancelledInfo) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-4">
          <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Signing Request Cancelled</h2>
          <p className="text-gray-600 mb-6">
            The sender has cancelled this signing request. No signature is required — this link is no longer active.
          </p>
          <div className="bg-white rounded-xl shadow-sm p-6 text-left">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Document</span>
                <span className="font-medium text-gray-900">{cancelledInfo.document_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Requested for</span>
                <span className="font-medium text-gray-900">{cancelledInfo.name || cancelledInfo.email}</span>
              </div>
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-6">
            If you believe this was cancelled in error, please contact the sender.
          </p>
        </div>
      </div>
    );
  }

  if (alreadySigned) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-4">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Already Signed</h2>
          <p className="text-gray-600 mb-6">
            This document has already been signed. No further action is needed.
          </p>
          <div className="bg-white rounded-xl shadow-sm p-6 text-left">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Document</span>
                <span className="font-medium text-gray-900">{alreadySigned.document_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Signed by</span>
                <span className="font-medium text-gray-900">{alreadySigned.name || alreadySigned.email}</span>
              </div>
              {alreadySigned.signed_at && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Signed on</span>
                  <span className="font-medium text-gray-900">{new Date(alreadySigned.signed_at).toLocaleString()}</span>
                </div>
              )}
            </div>
          </div>
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
                <span className="font-medium text-gray-900">{context?.document?.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Signed by</span>
                <span className="font-medium text-gray-900">{context?.recipient.name || context?.recipient.email}</span>
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
            Signing as <span className="font-medium text-gray-900">{context?.recipient.name || context?.recipient.email}</span>
          </div>
        </div>
      </header>

      {/* Signing progress bar */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 sticky top-[52px] z-40 shadow-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{context?.document?.name}</h2>
            <p className="text-sm text-gray-500">
              {completedCount} of {fields.length} fields completed
            </p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="w-32 bg-gray-200 rounded-full h-2">
              <div
                className="bg-indigo-600 h-2 rounded-full transition-all duration-500"
                style={{ width: `${fields.length > 0 ? (completedCount / fields.length) * 100 : 0}%` }}
              />
            </div>
            <a
              href={downloadUrl}
              className="inline-flex items-center gap-1.5 text-sm text-gray-700 hover:text-indigo-600 border border-gray-300 hover:border-indigo-400 rounded-lg px-3 py-2 font-medium transition-colors"
              title="Download the document to review before signing"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" />
              </svg>
              Download
            </a>
            {nextField && (
              <button
                onClick={handleJumpToNext}
                className="bg-yellow-400 hover:bg-yellow-500 text-gray-900 px-5 py-2 rounded-lg font-semibold text-sm transition-colors inline-flex items-center gap-1.5 shadow-sm"
                title={completedCount === 0 ? 'Begin signing this document' : 'Jump to the next field that needs your input'}
              >
                {nextButtonLabel}
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            )}
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
            pdfUrl={viewUrl}
            currentPage={currentPage}
            onPageChange={setCurrentPage}
            renderOverlay={renderOverlay}
            className="h-[calc(100vh-220px)] rounded-lg overflow-hidden"
          />
        </div>
      </div>

      {/* Welcome / pre-sign summary card */}
      {welcomeOpen && context && fields.length > 0 && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-1">You've been asked to sign a document</h3>
              <p className="text-sm text-gray-500 mb-4">
                Review the document on the next screen, then sign at the highlighted fields.
                You can download a copy first if you'd like to read it offline.
              </p>

              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4 space-y-2 text-sm">
                <div className="flex justify-between gap-4">
                  <span className="text-gray-500 shrink-0">Document</span>
                  <span className="font-medium text-gray-900 text-right truncate">{context.document?.name}</span>
                </div>
                {context.sender && (
                  <div className="flex justify-between gap-4">
                    <span className="text-gray-500 shrink-0">From</span>
                    <span className="font-medium text-gray-900 text-right truncate">
                      {context.sender.name}
                      {context.sender.email ? ` (${context.sender.email})` : ''}
                    </span>
                  </div>
                )}
                <div className="flex justify-between gap-4">
                  <span className="text-gray-500 shrink-0">Signing as</span>
                  <span className="font-medium text-gray-900 text-right truncate">{context.recipient.name || context.recipient.email}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-gray-500 shrink-0">Fields to sign</span>
                  <span className="font-medium text-gray-900">{fields.length}</span>
                </div>
              </div>

              {fields.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Fields</p>
                  <ul className="border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-48 overflow-y-auto">
                    {fields.map((f, idx) => (
                      <li key={f.id}>
                        <button
                          type="button"
                          onClick={() => handleJumpToField(f)}
                          className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-gray-50 text-left"
                        >
                          <span className="text-gray-900">
                            {idx + 1}. {f.type === 'text' && f.label ? f.label : FIELD_TYPE_LABELS[f.type]}
                            {f.required && <span className="ml-1.5 text-[10px] text-red-600 font-semibold">REQUIRED</span>}
                          </span>
                          <span className="text-xs text-gray-500">Page {f.page}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-2">
                <a
                  href={downloadUrl}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 border border-gray-300 hover:border-indigo-400 text-gray-700 hover:text-indigo-600 rounded-lg px-4 py-2.5 font-medium text-sm transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" />
                  </svg>
                  Download to review
                </a>
                <button
                  type="button"
                  onClick={() => setWelcomeOpen(false)}
                  className="flex-1 border border-gray-300 hover:border-gray-400 text-gray-700 rounded-lg px-4 py-2.5 font-medium text-sm transition-colors"
                >
                  Browse document
                </button>
                <button
                  type="button"
                  onClick={handleJumpToNext}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg px-4 py-2.5 font-semibold text-sm transition-colors"
                >
                  Start signing
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Signing Modal */}
      {activeField && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  {activeField.type === 'text' && activeField.label
                    ? activeField.label
                    : FIELD_TYPE_LABELS[activeField.type]}
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
                  <p className="text-sm text-gray-600 mb-3">
                    {activeField.label ? `Enter your ${activeField.label.toLowerCase()}:` : 'Enter text:'}
                  </p>
                  <input
                    type={/email/i.test(activeField.label || '') ? 'email' : /phone|mobile/i.test(activeField.label || '') ? 'tel' : 'text'}
                    value={textValue}
                    onChange={(e) => setTextValue(e.target.value)}
                    placeholder={activeField.label ? `Enter ${activeField.label}` : 'Type here...'}
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
