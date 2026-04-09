import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { ApiService } from '../services/api';
import { useAuth } from '../context/AuthContext';
import SignatureFieldPlacer from '../components/SignatureFieldPlacer';
import { SignatureField, RECIPIENT_COLORS } from '../types/signatureFields';

interface Document {
  id: string;
  original_name: string;
  file_path: string;
}

interface Recipient {
  email: string;
  name: string;
  order: number;
}

const STEPS = [
  { label: 'Document', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
  { label: 'Recipients', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z' },
  { label: 'Place Fields', icon: 'M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z' },
  { label: 'Review & Send', icon: 'M9 5l7 7-7 7' },
];

function WorkflowCreatePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const preselectedDocId = searchParams.get('documentId') || '';

  const [step, setStep] = useState<number>(0);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string>(preselectedDocId);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [newEmail, setNewEmail] = useState<string>('');
  const [newName, setNewName] = useState<string>('');
  const [workflowType, setWorkflowType] = useState<'sequential' | 'parallel'>('sequential');
  const [signatureFields, setSignatureFields] = useState<SignatureField[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [fetchingDocs, setFetchingDocs] = useState<boolean>(true);

  useEffect(() => {
    const fetchDocuments = async (): Promise<void> => {
      try {
        const response = await ApiService.get<{ documents: Document[] }>('/documents');
        if (response.success && response.data) {
          setDocuments(response.data.documents);
        }
      } catch {
        setError('Failed to load documents');
      } finally {
        setFetchingDocs(false);
      }
    };
    fetchDocuments();
  }, []);

  const addRecipient = (): void => {
    if (!newEmail.trim() || !newName.trim()) return;
    if (recipients.some((r) => r.email === newEmail.trim())) {
      setError('Recipient already added');
      return;
    }
    setError('');
    setRecipients([
      ...recipients,
      { email: newEmail.trim(), name: newName.trim(), order: recipients.length + 1 },
    ]);
    setNewEmail('');
    setNewName('');
  };

  const addMyself = (): void => {
    if (!user?.email) return;
    if (recipients.some((r) => r.email === user.email)) {
      setError('You are already added as a recipient');
      return;
    }
    setError('');
    setRecipients([
      ...recipients,
      { email: user.email, name: user.name || user.email, order: recipients.length + 1 },
    ]);
  };

  const removeRecipient = (index: number): void => {
    // Also remove fields assigned to this recipient, and re-index fields for higher recipients
    const newRecipients = recipients.filter((_, i) => i !== index).map((r, i) => ({ ...r, order: i + 1 }));
    const newFields = signatureFields
      .filter((f) => f.recipientIndex !== index)
      .map((f) => ({
        ...f,
        recipientIndex: f.recipientIndex > index ? f.recipientIndex - 1 : f.recipientIndex,
      }));
    setRecipients(newRecipients);
    setSignatureFields(newFields);
  };

  const moveRecipient = (index: number, direction: 'up' | 'down'): void => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === recipients.length - 1) return;
    const newRecipients = [...recipients];
    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    [newRecipients[index], newRecipients[swapIndex]] = [newRecipients[swapIndex], newRecipients[index]];
    setRecipients(newRecipients.map((r, i) => ({ ...r, order: i + 1 })));
    // Swap field recipient indices
    const newFields = signatureFields.map((f) => {
      if (f.recipientIndex === index) return { ...f, recipientIndex: swapIndex };
      if (f.recipientIndex === swapIndex) return { ...f, recipientIndex: index };
      return f;
    });
    setSignatureFields(newFields);
  };

  const validateStep = (stepNum: number): string | null => {
    switch (stepNum) {
      case 0:
        if (!selectedDocumentId) return 'Please select a document';
        return null;
      case 1:
        if (recipients.length === 0) return 'Please add at least one recipient';
        return null;
      case 2: {
        // Check each recipient has at least one signature field
        const recipientsWithSig = new Set(
          signatureFields.filter((f) => f.type === 'signature').map((f) => f.recipientIndex)
        );
        const missing = recipients.filter((_, i) => !recipientsWithSig.has(i));
        if (missing.length > 0) {
          return `Missing signature field for: ${missing.map((r) => r.name).join(', ')}`;
        }
        return null;
      }
      default:
        return null;
    }
  };

  const goNext = (): void => {
    const err = validateStep(step);
    if (err) {
      setError(err);
      return;
    }
    setError('');
    setStep(step + 1);
  };

  const goBack = (): void => {
    setError('');
    setStep(step - 1);
  };

  const handleSubmit = async (): Promise<void> => {
    setError('');
    setLoading(true);
    try {
      const response = await ApiService.post<{ workflow: { id: string } }>('/workflows', {
        document_id: selectedDocumentId,
        workflow_type: workflowType,
        recipients: recipients.map((r) => ({
          email: r.email,
          name: r.name,
          order: r.order,
        })),
        signature_fields: signatureFields.map((f) => ({
          type: f.type,
          page: f.page,
          x: f.x,
          y: f.y,
          width: f.width,
          height: f.height,
          recipient_index: f.recipientIndex,
          required: f.required,
        })),
      });

      if (response.success && response.data) {
        navigate(`/workflows/${response.data.workflow.id}`);
      } else {
        setError(response.error || 'Failed to create workflow');
      }
    } catch {
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const selectedDoc = documents.find((d) => d.id === selectedDocumentId);
  const pdfUrl = selectedDocumentId ? `/api/documents/${selectedDocumentId}/file` : '';

  // Validation for step 2
  const recipientsWithSig = new Set(
    signatureFields.filter((f) => f.type === 'signature').map((f) => f.recipientIndex)
  );

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Create Signing Workflow</h2>
        <Link to="/dashboard" className="text-gray-500 hover:text-gray-700 text-sm font-medium">
          Back to Dashboard
        </Link>
      </div>

      {/* Progress Stepper */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {STEPS.map((s, i) => (
            <div key={s.label} className="flex items-center flex-1">
              <div className="flex flex-col items-center flex-1">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                    i < step
                      ? 'bg-green-500 text-white'
                      : i === step
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-200 text-gray-500'
                  }`}
                >
                  {i < step ? (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={s.icon} />
                    </svg>
                  )}
                </div>
                <span className={`mt-2 text-xs font-medium ${i <= step ? 'text-indigo-600' : 'text-gray-400'}`}>
                  {s.label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`h-0.5 flex-1 mx-2 ${i < step ? 'bg-green-500' : 'bg-gray-200'}`} />
              )}
            </div>
          ))}
        </div>
      </div>

      {error && <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg mb-6 text-sm">{error}</div>}

      {/* Step 0: Document Selection */}
      {step === 0 && (
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Select Document</h3>
          {fetchingDocs ? (
            <p className="text-gray-500 text-sm">Loading documents...</p>
          ) : (
            <select
              value={selectedDocumentId}
              onChange={(e) => setSelectedDocumentId(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
            >
              <option value="">-- Select a document --</option>
              {documents.map((doc) => (
                <option key={doc.id} value={doc.id}>
                  {doc.original_name || doc.file_path}
                </option>
              ))}
            </select>
          )}

          {/* Workflow Type */}
          <div className="mt-6">
            <h4 className="text-sm font-semibold text-gray-900 mb-3">Workflow Type</h4>
            <div className="flex gap-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="workflowType"
                  value="sequential"
                  checked={workflowType === 'sequential'}
                  onChange={() => setWorkflowType('sequential')}
                  className="text-indigo-600 focus:ring-indigo-500"
                />
                <div>
                  <span className="font-medium text-gray-900">Sequential</span>
                  <p className="text-sm text-gray-500">Signers sign one after another in order</p>
                </div>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="workflowType"
                  value="parallel"
                  checked={workflowType === 'parallel'}
                  onChange={() => setWorkflowType('parallel')}
                  className="text-indigo-600 focus:ring-indigo-500"
                />
                <div>
                  <span className="font-medium text-gray-900">Parallel</span>
                  <p className="text-sm text-gray-500">All signers can sign simultaneously</p>
                </div>
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Step 1: Recipients */}
      {step === 1 && (
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Recipients</h3>

          {/* Add recipient inputs */}
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Name"
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
              onKeyDown={(e) => e.key === 'Enter' && addRecipient()}
            />
            <input
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="Email"
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
              onKeyDown={(e) => e.key === 'Enter' && addRecipient()}
            />
            <button
              type="button"
              onClick={addRecipient}
              className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg font-medium hover:bg-gray-200 transition-colors text-sm whitespace-nowrap"
            >
              Add Recipient
            </button>
          </div>

          {/* Add Myself button */}
          {user && (
            <button
              type="button"
              onClick={addMyself}
              className="mb-4 text-indigo-600 hover:text-indigo-700 text-sm font-medium flex items-center gap-1"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              Add Myself ({user.name || user.email})
            </button>
          )}

          {/* Recipient list */}
          {recipients.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-4">No recipients added yet</p>
          ) : (
            <div className="space-y-2">
              {recipients.map((recipient, index) => {
                const colorIdx = index % RECIPIENT_COLORS.length;
                const c = RECIPIENT_COLORS[colorIdx];
                return (
                  <div
                    key={recipient.email}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-7 h-7 flex items-center justify-center rounded-full text-white text-sm font-semibold"
                        style={{ backgroundColor: c.hex }}
                      >
                        {recipient.order}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 text-sm">{recipient.name}</p>
                        <p className="text-gray-500 text-xs">{recipient.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {workflowType === 'sequential' && (
                        <>
                          <button
                            type="button"
                            onClick={() => moveRecipient(index, 'up')}
                            disabled={index === 0}
                            className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                            title="Move up"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            onClick={() => moveRecipient(index, 'down')}
                            disabled={index === recipients.length - 1}
                            className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                            title="Move down"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>
                        </>
                      )}
                      <button
                        type="button"
                        onClick={() => removeRecipient(index)}
                        className="p-1 text-red-400 hover:text-red-600 ml-1"
                        title="Remove"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Step 2: Place Fields */}
      {step === 2 && (
        <div>
          {/* Validation warnings */}
          {recipients.some((_, i) => !recipientsWithSig.has(i)) && (
            <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded-lg mb-4 text-sm">
              <strong>Note:</strong> Each recipient needs at least one signature field.
              {recipients
                .filter((_, i) => !recipientsWithSig.has(i))
                .map((r, idx) => {
                  const origIdx = recipients.indexOf(r);
                  const c = RECIPIENT_COLORS[origIdx % RECIPIENT_COLORS.length];
                  return (
                    <span key={r.email} className="inline-flex items-center gap-1 ml-2">
                      <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: c.hex }} />
                      <span className="font-medium">{r.name}</span>
                      {idx < recipients.filter((_, i) => !recipientsWithSig.has(i)).length - 1 && ','}
                    </span>
                  );
                })}
            </div>
          )}
          <SignatureFieldPlacer
            pdfUrl={pdfUrl}
            recipients={recipients}
            fields={signatureFields}
            onFieldsChange={setSignatureFields}
          />
        </div>
      )}

      {/* Step 3: Review & Send */}
      {step === 3 && (
        <div className="space-y-6">
          {/* Document summary */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Review Workflow</h3>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">Document</p>
                <p className="font-medium text-gray-900">{selectedDoc?.original_name || selectedDoc?.file_path || 'Unknown'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Workflow Type</p>
                <p className="font-medium text-gray-900 capitalize">{workflowType}</p>
              </div>
            </div>
          </div>

          {/* Recipients summary */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h4 className="text-sm font-semibold text-gray-900 mb-3">Recipients ({recipients.length})</h4>
            <div className="space-y-2">
              {recipients.map((r, index) => {
                const c = RECIPIENT_COLORS[index % RECIPIENT_COLORS.length];
                const rFields = signatureFields.filter((f) => f.recipientIndex === index);
                return (
                  <div key={r.email} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-6 h-6 rounded-full" style={{ backgroundColor: c.hex }} />
                      <div>
                        <p className="font-medium text-gray-900 text-sm">{r.name}</p>
                        <p className="text-gray-500 text-xs">{r.email}</p>
                      </div>
                    </div>
                    <span className="text-xs text-gray-500">
                      {rFields.length} field{rFields.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Fields summary */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h4 className="text-sm font-semibold text-gray-900 mb-3">Signature Fields ({signatureFields.length})</h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {['signature', 'initials', 'date', 'text'].map((type) => {
                const count = signatureFields.filter((f) => f.type === type).length;
                return (
                  <div key={type} className="bg-gray-50 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-gray-900">{count}</p>
                    <p className="text-xs text-gray-500 capitalize">{type}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Navigation buttons */}
      <div className="flex items-center justify-between mt-6">
        <div>
          {step > 0 && (
            <button
              type="button"
              onClick={goBack}
              className="px-6 py-2 text-gray-600 hover:text-gray-800 font-medium"
            >
              Back
            </button>
          )}
        </div>
        <div className="flex gap-4">
          <Link to="/dashboard" className="px-6 py-2 text-gray-600 hover:text-gray-800 font-medium">
            Cancel
          </Link>
          {step < STEPS.length - 1 ? (
            <button
              type="button"
              onClick={goNext}
              className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-indigo-700 transition-colors"
            >
              Next
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading}
              className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create & Send Workflow'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default WorkflowCreatePage;
