import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ApiService } from '../services/api';
import { useAuth } from '../context/AuthContext';
import DocumentViewer from '../components/DocumentViewer';
import SignatureFieldOverlay from '../components/SignatureFieldOverlay';
import SignaturePadComponent from '../components/SignaturePadComponent';
import {
  SignatureField,
  FieldType,
  FIELD_TYPE_LABELS,
} from '../types/signatureFields';

interface Signer {
  id: string;
  email: string;
  name: string;
  status: 'pending' | 'signed' | 'declined';
  signed_at: string | null;
  order: number;
  last_reminder_sent?: string | null;
  reminder_interval_hours?: number;
}

interface Workflow {
  id: string;
  document_id: string;
  document_name: string;
  workflow_type: 'sequential' | 'parallel';
  status: 'draft' | 'active' | 'completed' | 'cancelled';
  created_at: string;
  updated_at: string;
  signers: Signer[];
  signature_fields?: {
    id: string;
    type: string;
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
}

interface WorkflowEvent {
  id: string;
  actor: string;
  action: string;
  timestamp: string;
  ip_address: string;
  details?: string;
}

function formatMetadata(metadata: Record<string, any>): string | undefined {
  const parts: string[] = [];
  if (metadata.recipient_email) parts.push(`Recipient: ${metadata.recipient_email}`);
  if (metadata.fields_signed) parts.push(`Fields signed: ${metadata.fields_signed}`);
  if (metadata.signing_method) parts.push(`Method: ${metadata.signing_method}`);
  if (metadata.recipient_count) parts.push(`Recipients: ${metadata.recipient_count}`);
  if (metadata.notified_count) parts.push(`Notified: ${metadata.notified_count}`);
  return parts.length > 0 ? parts.join(' | ') : undefined;
}

function WorkflowDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [events, setEvents] = useState<WorkflowEvent[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  const [starting, setStarting] = useState<boolean>(false);
  const [sendingReminder, setSendingReminder] = useState<string>('');
  const [showReminderPanel, setShowReminderPanel] = useState<boolean>(false);
  const [reminderIntervals, setReminderIntervals] = useState<Record<string, number>>({});
  const [savingReminders, setSavingReminders] = useState<boolean>(false);
  const [showHistory, setShowHistory] = useState<boolean>(false);
  const [exporting, setExporting] = useState<boolean>(false);
  const [cancelling, setCancelling] = useState<boolean>(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState<boolean>(false);
  const [showSignPrompt, setShowSignPrompt] = useState<boolean>(true);

  // Saved signature state
  const [savedSignature, setSavedSignature] = useState<string | null>(null);
  const [savedSignatureChecked, setSavedSignatureChecked] = useState<boolean>(false);

  // Recipient editing state
  const [editingRecipients, setEditingRecipients] = useState<boolean>(false);
  const [editRecipients, setEditRecipients] = useState<{ email: string; name: string; order: number }[]>([]);
  const [newRecEmail, setNewRecEmail] = useState<string>('');
  const [newRecName, setNewRecName] = useState<string>('');
  const [savingRecipients, setSavingRecipients] = useState<boolean>(false);

  // Self-signing state
  const [showSigningView, setShowSigningView] = useState<boolean>(false);
  const [signFields, setSignFields] = useState<SignatureField[]>([]);
  const [activeField, setActiveField] = useState<SignatureField | null>(null);
  const [selfSigning, setSelfSigning] = useState<boolean>(false);
  const [textValue, setTextValue] = useState<string>('');
  const [dateValue, setDateValue] = useState<string>(new Date().toLocaleDateString());
  const [currentPage, setCurrentPage] = useState<number>(1);

  const fetchWorkflow = useCallback(async (): Promise<void> => {
    try {
      const response = await ApiService.get<{ workflow: any }>(`/workflows/${id}`);
      if (response.success && response.data) {
        const raw = response.data.workflow;

        // Map server response to client Workflow shape
        const mapped: Workflow = {
          id: raw.id,
          document_id: raw.document_id,
          document_name: raw.document_name || '',
          workflow_type: raw.workflow_type,
          status: raw.status,
          created_at: raw.created_at,
          updated_at: raw.updated_at,
          signers: (raw.signers || raw.recipients || []).map((r: any) => ({
            id: r.id,
            email: r.email || r.signer_email,
            name: r.name || r.signer_name,
            status: r.status,
            signed_at: r.signed_at,
            order: r.order ?? r.signing_order,
            last_reminder_sent: r.last_reminder_sent,
            reminder_interval_hours: r.reminder_interval_hours,
          })),
          signature_fields: (raw.signature_fields || raw.fields || []).map((f: any, i: number) => {
            // Find recipient_index from recipient_id
            const recipients = raw.signers || raw.recipients || [];
            const recipientIndex = f.recipient_index ?? recipients.findIndex((r: any) => r.id === f.recipient_id);
            return {
              id: f.id,
              type: f.type || f.field_type,
              page: f.page,
              x: f.x,
              y: f.y,
              width: f.width,
              height: f.height,
              recipient_index: recipientIndex >= 0 ? recipientIndex : i,
              required: f.required !== false,
              value: f.value || f.signature_data,
              completed: f.completed || !!f.signed_at,
            };
          }),
        };

        setWorkflow(mapped);
        const intervals: Record<string, number> = {};
        mapped.signers.forEach((s) => {
          intervals[s.id] = s.reminder_interval_hours || 24;
        });
        setReminderIntervals(intervals);

        // Map signature fields for signing view
        if (mapped.signature_fields) {
          setSignFields(mapped.signature_fields.map((f) => ({
            id: f.id,
            type: f.type as FieldType,
            page: f.page,
            x: f.x,
            y: f.y,
            width: f.width,
            height: f.height,
            recipientIndex: f.recipient_index,
            required: f.required,
            value: f.value,
            completed: f.completed || false,
          })));
        }
      }
    } catch {
      setError('Failed to load workflow');
    } finally {
      setLoading(false);
    }
  }, [id]);

  const fetchHistory = useCallback(async (): Promise<void> => {
    try {
      const response = await ApiService.get<any>(`/workflows/${id}/history`);
      if (response.success && response.data) {
        const rawEvents = response.data.history || response.data.events || [];
        const mapped: WorkflowEvent[] = rawEvents.map((e: any) => ({
          id: e.id,
          actor: e.actor || e.actor_email || '',
          action: e.action || '',
          timestamp: e.timestamp || e.created_at || '',
          ip_address: e.ip_address || e.actor_ip || '',
          details: e.details || (e.metadata ? formatMetadata(e.metadata) : undefined),
        }));
        setEvents(mapped);
      }
    } catch {
      // silent
    }
  }, [id]);

  useEffect(() => {
    fetchWorkflow();
    fetchHistory();
  }, [fetchWorkflow, fetchHistory]);

  // Poll for status updates
  useEffect(() => {
    if (!workflow || workflow.status === 'completed' || workflow.status === 'cancelled') return;
    const interval = setInterval(() => {
      ApiService.get<any>(`/workflows/${id}/status`).then((res) => {
        if (res.success && res.data) {
          // Status endpoint returns res.data.status (not res.data.workflow)
          const statusData = res.data.status || res.data.workflow;
          if (!statusData) return;
          setWorkflow((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              status: statusData.status || prev.status,
              signers: prev.signers.map((s) => {
                const updated = (statusData.recipients || []).find(
                  (r: any) => r.id === s.id || (r.signer_email || r.email) === s.email
                );
                return updated ? { ...s, status: updated.status, signed_at: updated.signed_at } : s;
              }),
            };
          });
        }
      });
    }, 10000);
    return () => clearInterval(interval);
  }, [id, workflow?.status]);

  // Fetch saved signature when entering signing view, and auto-populate fields
  useEffect(() => {
    if (!showSigningView || savedSignatureChecked || !workflow) return;
    setSavedSignatureChecked(true);

    const signerIdx = workflow.signers.findIndex((s) => s.email === user?.email);

    ApiService.get<{ userSignatures: { signature_type: string; signature_data?: string }[] }>('/user-signatures').then((res) => {
      if (res.success && res.data) {
        const drawn = res.data.userSignatures.find((s) => s.signature_type === 'drawn' && s.signature_data);
        if (drawn?.signature_data) {
          setSavedSignature(drawn.signature_data);
          // Auto-populate all unfilled signature/initials fields for this signer
          setSignFields((prev) => prev.map((f) => {
            if ((f.type === 'signature' || f.type === 'initials') && f.recipientIndex === signerIdx && !f.completed) {
              return { ...f, value: drawn.signature_data!, completed: true };
            }
            return f;
          }));
        }
      }
    });
  }, [showSigningView, savedSignatureChecked, workflow, user?.email]);

  const handleStart = async (): Promise<void> => {
    setStarting(true);
    setError('');
    try {
      const response = await ApiService.post(`/workflows/${id}/start`, {});
      if (response.success) {
        setSuccess('Workflow started successfully');
        fetchWorkflow();
        fetchHistory();
      } else {
        setError(response.error || 'Failed to start workflow');
      }
    } catch {
      setError('An unexpected error occurred');
    } finally {
      setStarting(false);
    }
  };

  const handleCancel = async (): Promise<void> => {
    setCancelling(true);
    setError('');
    setShowCancelConfirm(false);
    try {
      const response = await ApiService.post(`/workflows/${id}/cancel`, {});
      if (response.success) {
        setSuccess('Workflow cancelled');
        fetchWorkflow();
        fetchHistory();
      } else {
        setError(response.error || 'Failed to cancel workflow');
      }
    } catch {
      setError('An unexpected error occurred');
    } finally {
      setCancelling(false);
    }
  };

  const handleSendReminder = async (signerId?: string): Promise<void> => {
    setSendingReminder(signerId || 'all');
    setError('');
    try {
      const body: Record<string, any> = {};
      if (signerId) body.recipientId = signerId;
      const response = await ApiService.post(`/workflows/${id}/remind`, body);
      if (response.success) {
        setSuccess('Reminder sent successfully');
        fetchWorkflow();
      } else {
        setError(response.error || 'Failed to send reminder');
      }
    } catch {
      setError('An unexpected error occurred');
    } finally {
      setSendingReminder('');
    }
  };

  const handleSaveReminders = async (): Promise<void> => {
    setSavingReminders(true);
    setError('');
    try {
      const response = await ApiService.put(`/workflows/${id}/reminders`, {
        reminders: Object.entries(reminderIntervals).map(([signer_id, interval_hours]) => ({
          signer_id,
          interval_hours,
        })),
      });
      if (response.success) {
        setSuccess('Reminder settings saved');
        setShowReminderPanel(false);
      } else {
        setError(response.error || 'Failed to save reminder settings');
      }
    } catch {
      setError('An unexpected error occurred');
    } finally {
      setSavingReminders(false);
    }
  };

  const handleExportHistory = async (format: 'pdf' | 'csv'): Promise<void> => {
    setExporting(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/workflows/${id}/history/export?format=${format}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `workflow-history-${id?.slice(0, 8)}.${format}`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch {
      setError('Failed to export history');
    } finally {
      setExporting(false);
    }
  };

  // Self-signing handlers
  const mySignerEntry = workflow?.signers.find((s) => s.email === user?.email);
  const mySignerIndex = workflow?.signers.findIndex((s) => s.email === user?.email) ?? -1;
  const canSelfSign = workflow?.status === 'active' && mySignerEntry?.status === 'pending';

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
    setSignFields((prev) =>
      prev.map((f) =>
        f.id === activeField.id ? { ...f, value: dataUrl, completed: true } : f
      )
    );
    setActiveField(null);
  }, [activeField]);

  const handleDateConfirm = useCallback(() => {
    if (!activeField) return;
    setSignFields((prev) =>
      prev.map((f) =>
        f.id === activeField.id ? { ...f, value: dateValue, completed: true } : f
      )
    );
    setActiveField(null);
  }, [activeField, dateValue]);

  const handleTextConfirm = useCallback(() => {
    if (!activeField || !textValue.trim()) return;
    setSignFields((prev) =>
      prev.map((f) =>
        f.id === activeField.id ? { ...f, value: textValue.trim(), completed: true } : f
      )
    );
    setActiveField(null);
    setTextValue('');
  }, [activeField, textValue]);

  const [showSignConfirm, setShowSignConfirm] = useState<boolean>(false);

  const handleSelfSign = async () => {
    setSelfSigning(true);
    setError('');
    try {
      const signatures = signFields
        .filter((f) => f.recipientIndex === mySignerIndex && f.completed)
        .map((f) => ({
          fieldId: f.id,
          signatureData: f.value || '',
          signatureType: (f.type === 'signature' || f.type === 'initials') ? 'drawn' : f.type,
        }));

      const response = await ApiService.post(`/workflows/${id}/self-sign`, {
        signatures,
      });

      if (response.success) {
        // Auto-save signature for future use if user didn't have one
        if (!savedSignature) {
          const drawnSig = signatures.find((s) => s.signatureType === 'drawn' && s.signatureData);
          if (drawnSig) {
            ApiService.post('/user-signatures', {
              signature_type: 'drawn',
              signature_data: drawnSig.signatureData,
            }).then((saveRes) => {
              if (saveRes.success) {
                setSavedSignature(drawnSig.signatureData);
                setSuccess('Document signed successfully! Your signature has been saved for future use.');
              }
            }).catch(() => {});
          }
        }
        if (savedSignature) {
          setSuccess('Document signed successfully!');
        }
        setShowSigningView(false);
        fetchWorkflow();
        fetchHistory();
      } else {
        setError(response.error || 'Failed to sign document');
      }
    } catch {
      setError('An unexpected error occurred');
    } finally {
      setSelfSigning(false);
    }
  };

  const myFields = signFields.filter((f) => f.recipientIndex === mySignerIndex);
  const myRequiredFields = myFields.filter((f) => f.required);
  const myCompletedRequired = myRequiredFields.filter((f) => f.completed);
  const allMyRequiredDone = myRequiredFields.length > 0 && myCompletedRequired.length === myRequiredFields.length;

  const renderSignOverlay = useCallback((pageNumber: number, dimensions: { width: number; height: number }) => {
    const recipients = workflow?.signers.map((s) => ({ email: s.email, name: s.name, order: s.order })) || [];
    return (
      <SignatureFieldOverlay
        fields={signFields}
        pageNumber={pageNumber}
        pageDimensions={dimensions}
        mode="sign"
        recipients={recipients}
        currentSignerIndex={mySignerIndex}
        onFieldClick={handleFieldClick}
      />
    );
  }, [signFields, workflow, mySignerIndex, handleFieldClick]);

  const signerStatusColor = (status: string): string => {
    switch (status) {
      case 'signed': return 'text-green-700 bg-green-50 border-green-200';
      case 'declined': return 'text-red-700 bg-red-50 border-red-200';
      default: return 'text-yellow-700 bg-yellow-50 border-yellow-200';
    }
  };

  const signerStatusIcon = (status: string): JSX.Element => {
    switch (status) {
      case 'signed':
        return (
          <svg className="w-5 h-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        );
      case 'declined':
        return (
          <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        );
      default:
        return (
          <svg className="w-5 h-5 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
    }
  };

  const eventActionIcon = (action: string): string => {
    if (action.includes('created')) return 'bg-blue-500';
    if (action.includes('started')) return 'bg-indigo-500';
    if (action.includes('signed')) return 'bg-green-500';
    if (action.includes('declined')) return 'bg-red-500';
    if (action.includes('reminder')) return 'bg-yellow-500';
    if (action.includes('completed')) return 'bg-emerald-500';
    return 'bg-gray-500';
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20"><p className="text-gray-500">Loading...</p></div>;
  }

  if (!workflow) {
    return <div className="flex items-center justify-center py-20"><p className="text-gray-500">Workflow not found</p></div>;
  }

  // Self-signing view
  if (showSigningView) {
    const pdfUrl = `/api/documents/${workflow.document_id}/file`;
    return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900">Sign Document: {workflow.document_name}</h2>
          <button
            onClick={() => setShowSigningView(false)}
            className="text-gray-500 hover:text-gray-700 text-sm font-medium"
          >
            Back to Workflow
          </button>
        </div>

        {error && <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg mb-4 text-sm">{error}</div>}

        {/* Auto-populated notice */}
        {savedSignature && allMyRequiredDone && (
          <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 mb-4 flex items-center gap-3">
            <svg className="w-5 h-5 text-green-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <p className="text-sm text-green-800">
              Your saved signature has been applied to all fields. Click <strong>Complete Signing</strong> to finish, or tap any field to redraw.
            </p>
          </div>
        )}

        {/* Progress */}
        <div className="bg-white rounded-lg shadow-sm px-4 py-3 mb-4 flex items-center justify-between">
          <p className="text-sm text-gray-600">
            {myFields.filter((f) => f.completed).length} of {myFields.length} fields completed
          </p>
          <button
            onClick={() => setShowSignConfirm(true)}
            disabled={!allMyRequiredDone || selfSigning}
            className="bg-indigo-600 text-white px-5 py-2 rounded-lg font-medium text-sm hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {selfSigning ? 'Signing...' : 'Complete Signing'}
          </button>
        </div>

        {/* Sign confirmation dialog */}
        {showSignConfirm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                  <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900">Confirm Signature</h3>
              </div>
              <p className="text-sm text-gray-600 mb-2">
                You are about to sign <strong>{workflow.document_name || 'this document'}</strong>.
              </p>
              <p className="text-sm text-gray-600 mb-6">
                {myFields.filter(f => f.completed).length} field(s) completed. By signing, you agree to the terms of this document. This action cannot be undone.
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowSignConfirm(false)}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800 text-sm font-medium"
                >
                  Go Back
                </button>
                <button
                  onClick={() => { setShowSignConfirm(false); handleSelfSign(); }}
                  className="bg-green-600 text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-green-700 transition-colors"
                >
                  Confirm & Sign
                </button>
              </div>
            </div>
          </div>
        )}

        <DocumentViewer
          pdfUrl={pdfUrl}
          currentPage={currentPage}
          onPageChange={setCurrentPage}
          renderOverlay={renderSignOverlay}
          className="h-[70vh] rounded-lg overflow-hidden"
        />

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

                {activeField.type === 'signature' && (
                  <div>
                    {savedSignature ? (
                      <div>
                        <p className="text-sm text-gray-600 mb-3">Your saved signature:</p>
                        <div className="border border-gray-200 rounded-lg p-4 bg-gray-50 mb-3 flex items-center justify-center">
                          <img src={savedSignature} alt="Saved signature" className="h-16 object-contain" />
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleSignatureCapture(savedSignature)}
                            className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium text-sm hover:bg-indigo-700 transition-colors"
                          >
                            Use This Signature
                          </button>
                          <button
                            onClick={() => setSavedSignature(null)}
                            className="text-gray-600 hover:text-gray-800 px-4 py-2 text-sm font-medium"
                          >
                            Draw New
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <p className="text-sm text-gray-600 mb-3">Draw your signature below:</p>
                        <SignaturePadComponent onSave={handleSignatureCapture} height={200} />
                      </div>
                    )}
                  </div>
                )}

                {activeField.type === 'initials' && (
                  <div>
                    <p className="text-sm text-gray-600 mb-3">Draw your initials below:</p>
                    <SignaturePadComponent onSave={handleSignatureCapture} height={120} />
                  </div>
                )}

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

  const completedCount = workflow.signers.filter((s) => s.status === 'signed').length;
  const totalCount = workflow.signers.length;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const workflowStatusColor = (status: string): string => {
    switch (status) {
      case 'active': return 'text-blue-700 bg-blue-50';
      case 'completed': return 'text-green-700 bg-green-50';
      case 'cancelled': return 'text-red-700 bg-red-50';
      default: return 'text-gray-700 bg-gray-50';
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {error && <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg mb-6 text-sm">{error}</div>}
      {success && <div className="bg-green-50 text-green-600 px-4 py-3 rounded-lg mb-6 text-sm">{success}</div>}

      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h2 className="text-2xl font-bold text-gray-900">Workflow</h2>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${workflowStatusColor(workflow.status)}`}>
                {workflow.status}
              </span>
            </div>
            <p className="text-gray-600">{workflow.document_name || 'Document'}</p>
            <p className="text-sm text-gray-400 mt-1">
              {workflow.workflow_type === 'sequential' ? 'Sequential' : 'Parallel'} signing
              &middot; Created {new Date(workflow.created_at).toLocaleDateString()}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {canSelfSign && (
              <button
                onClick={() => setShowSigningView(true)}
                className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
              >
                Sign Now
              </button>
            )}
            {workflow.status === 'draft' && (
              <>
                <button
                  onClick={handleStart}
                  disabled={starting}
                  className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50"
                >
                  {starting ? 'Starting...' : 'Start Workflow'}
                </button>
                <button
                  onClick={() => {
                    setEditRecipients(workflow.signers.map((s) => ({ email: s.email, name: s.name, order: s.order })));
                    setEditingRecipients(true);
                    setNewRecEmail('');
                    setNewRecName('');
                  }}
                  className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
                >
                  Edit Recipients
                </button>
              </>
            )}
            {workflow.status === 'active' && (
              <>
                <button
                  onClick={() => handleSendReminder()}
                  disabled={!!sendingReminder}
                  className="bg-yellow-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-yellow-600 transition-colors disabled:opacity-50"
                >
                  {sendingReminder === 'all' ? 'Sending...' : 'Send Reminder'}
                </button>
                <button
                  onClick={() => setShowReminderPanel(!showReminderPanel)}
                  className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
                >
                  Reminder Settings
                </button>
              </>
            )}
            {(workflow.status === 'draft' || workflow.status === 'active') && (
              <button
                onClick={() => setShowCancelConfirm(true)}
                disabled={cancelling}
                className="text-red-500 hover:text-red-700 px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50"
              >
                {cancelling ? 'Cancelling...' : 'Cancel Workflow'}
              </button>
            )}
            <button
              onClick={() => { setShowHistory(!showHistory); if (!showHistory) fetchHistory(); }}
              className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
            >
              {showHistory ? 'Hide History' : 'View History'}
            </button>
            <Link to="/workflows" className="px-4 py-2 text-gray-500 hover:text-gray-700 text-sm font-medium">
              Back
            </Link>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mt-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Signing Progress</span>
            <span className="text-sm text-gray-500">{completedCount} of {totalCount} signed ({progressPercent}%)</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div
              className="bg-indigo-600 h-3 rounded-full transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Self-sign banner */}
      {canSelfSign && showSignPrompt && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </div>
            <div>
              <p className="font-semibold text-indigo-900">It's your turn to sign</p>
              <p className="text-sm text-indigo-700">You have signature fields waiting for your signature on this document.</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setShowSigningView(true)}
              className="bg-indigo-600 text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors"
            >
              Sign Now
            </button>
            <button
              onClick={() => setShowSignPrompt(false)}
              className="text-indigo-400 hover:text-indigo-600 p-1"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Cancel confirmation dialog */}
      {showCancelConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Cancel Workflow?</h3>
            <p className="text-sm text-gray-600 mb-6">
              This will invalidate all signing links and notify pending recipients. This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowCancelConfirm(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 text-sm font-medium"
              >
                Keep Workflow
              </button>
              <button
                onClick={handleCancel}
                disabled={cancelling}
                className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {cancelling ? 'Cancelling...' : 'Yes, Cancel Workflow'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Recipients Panel */}
      {editingRecipients && workflow.status === 'draft' && (
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Edit Recipients</h3>
          <div className="space-y-3 mb-4">
            {editRecipients
              .sort((a, b) => a.order - b.order)
              .map((rec, idx) => (
                <div key={idx} className="flex items-center gap-3 bg-gray-50 rounded-lg p-3">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-200 text-gray-600 font-semibold text-sm">
                    {rec.order}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{rec.name || rec.email}</p>
                    <p className="text-xs text-gray-500">{rec.email}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        if (idx === 0) return;
                        const updated = [...editRecipients].sort((a, b) => a.order - b.order);
                        const prevOrder = updated[idx - 1].order;
                        updated[idx - 1].order = updated[idx].order;
                        updated[idx].order = prevOrder;
                        setEditRecipients([...updated]);
                      }}
                      disabled={idx === 0}
                      className="text-gray-400 hover:text-gray-600 disabled:opacity-30 p-1"
                      title="Move up"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                      </svg>
                    </button>
                    <button
                      onClick={() => {
                        const sorted = [...editRecipients].sort((a, b) => a.order - b.order);
                        if (idx === sorted.length - 1) return;
                        const nextOrder = sorted[idx + 1].order;
                        sorted[idx + 1].order = sorted[idx].order;
                        sorted[idx].order = nextOrder;
                        setEditRecipients([...sorted]);
                      }}
                      disabled={idx === editRecipients.length - 1}
                      className="text-gray-400 hover:text-gray-600 disabled:opacity-30 p-1"
                      title="Move down"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    <button
                      onClick={() => {
                        const sorted = [...editRecipients].sort((a, b) => a.order - b.order);
                        sorted.splice(idx, 1);
                        // Re-number orders
                        sorted.forEach((r, i) => { r.order = i + 1; });
                        setEditRecipients([...sorted]);
                      }}
                      className="text-red-400 hover:text-red-600 p-1 ml-1"
                      title="Remove"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
          </div>

          {/* Add recipient form */}
          <div className="flex items-end gap-3 mb-4">
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
              <input
                type="email"
                value={newRecEmail}
                onChange={(e) => setNewRecEmail(e.target.value)}
                placeholder="recipient@example.com"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-600 mb-1">Name</label>
              <input
                type="text"
                value={newRecName}
                onChange={(e) => setNewRecName(e.target.value)}
                placeholder="Recipient name"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
              />
            </div>
            <button
              onClick={() => {
                if (!newRecEmail.trim()) return;
                const maxOrder = editRecipients.length > 0 ? Math.max(...editRecipients.map((r) => r.order)) : 0;
                setEditRecipients([...editRecipients, { email: newRecEmail.trim(), name: newRecName.trim(), order: maxOrder + 1 }]);
                setNewRecEmail('');
                setNewRecName('');
              }}
              disabled={!newRecEmail.trim()}
              className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50"
            >
              Add
            </button>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                if (!user?.email) return;
                const alreadyAdded = editRecipients.some((r) => r.email === user.email);
                if (alreadyAdded) return;
                const maxOrder = editRecipients.length > 0 ? Math.max(...editRecipients.map((r) => r.order)) : 0;
                setEditRecipients([...editRecipients, { email: user.email, name: user.name || '', order: maxOrder + 1 }]);
              }}
              className="text-indigo-600 hover:text-indigo-700 text-sm font-medium"
            >
              Add Myself
            </button>
            <div className="flex-1" />
            <button
              onClick={async () => {
                setSavingRecipients(true);
                setError('');
                try {
                  const response = await ApiService.put(`/workflows/${id}`, {
                    recipients: editRecipients.map((r) => ({
                      signer_email: r.email,
                      signer_name: r.name,
                      signing_order: r.order,
                    })),
                  });
                  if (response.success) {
                    setSuccess('Recipients updated');
                    setEditingRecipients(false);
                    fetchWorkflow();
                  } else {
                    setError(response.error || 'Failed to update recipients');
                  }
                } catch {
                  setError('An unexpected error occurred');
                } finally {
                  setSavingRecipients(false);
                }
              }}
              disabled={savingRecipients}
              className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50"
            >
              {savingRecipients ? 'Saving...' : 'Save'}
            </button>
            <button
              onClick={() => setEditingRecipients(false)}
              className="text-gray-500 hover:text-gray-700 text-sm font-medium px-4 py-2"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Reminder Settings Panel */}
      {showReminderPanel && (
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Reminder Settings</h3>
          <p className="text-sm text-gray-500 mb-4">Configure automatic reminder intervals per recipient (in hours).</p>
          <div className="space-y-3">
            {workflow.signers.map((signer) => (
              <div key={signer.id} className="flex items-center gap-4">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">{signer.name || signer.email}</p>
                  <p className="text-xs text-gray-500">{signer.email}</p>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    max={168}
                    value={reminderIntervals[signer.id] || 24}
                    onChange={(e) =>
                      setReminderIntervals({ ...reminderIntervals, [signer.id]: parseInt(e.target.value) || 24 })
                    }
                    className="w-20 px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                  />
                  <span className="text-sm text-gray-500">hours</span>
                </div>
                {signer.last_reminder_sent && (
                  <p className="text-xs text-gray-400">
                    Last: {new Date(signer.last_reminder_sent).toLocaleString()}
                  </p>
                )}
              </div>
            ))}
          </div>
          <div className="mt-4 flex gap-3">
            <button
              onClick={handleSaveReminders}
              disabled={savingReminders}
              className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50"
            >
              {savingReminders ? 'Saving...' : 'Save Settings'}
            </button>
            <button
              onClick={() => setShowReminderPanel(false)}
              className="text-gray-500 hover:text-gray-700 text-sm font-medium px-4 py-2"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Signer Status Cards */}
      <div className="bg-white rounded-xl shadow-sm mb-6">
        <div className="p-6 border-b border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900">Signers</h3>
        </div>
        <div className="divide-y divide-gray-100">
          {workflow.signers
            .sort((a, b) => a.order - b.order)
            .map((signer) => (
              <div key={signer.id} className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 text-gray-600 font-semibold text-sm">
                    {signer.order}
                  </div>
                  {signerStatusIcon(signer.status)}
                  <div>
                    <p className="font-medium text-gray-900">
                      {signer.name || signer.email}
                      {signer.email === user?.email && (
                        <span className="ml-2 text-xs text-indigo-600 font-normal">(you)</span>
                      )}
                    </p>
                    <p className="text-sm text-gray-500">{signer.email}</p>
                    {signer.signed_at && (
                      <p className="text-xs text-gray-400 mt-0.5">
                        Signed {new Date(signer.signed_at).toLocaleString()}
                      </p>
                    )}
                    {signer.last_reminder_sent && (
                      <p className="text-xs text-gray-400">
                        Last reminder: {new Date(signer.last_reminder_sent).toLocaleString()}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium border ${signerStatusColor(signer.status)}`}>
                    {signer.status}
                  </span>
                  {workflow.status === 'active' && signer.status === 'pending' && signer.email === user?.email && (
                    <button
                      onClick={() => setShowSigningView(true)}
                      className="bg-green-600 text-white px-3 py-1 rounded-lg text-xs font-medium hover:bg-green-700 transition-colors"
                    >
                      Sign Now
                    </button>
                  )}
                  {workflow.status === 'active' && signer.status === 'pending' && signer.email !== user?.email && (
                    <button
                      onClick={() => handleSendReminder(signer.id)}
                      disabled={sendingReminder === signer.id}
                      className="text-yellow-600 hover:text-yellow-700 text-xs font-medium"
                    >
                      {sendingReminder === signer.id ? 'Sending...' : 'Remind'}
                    </button>
                  )}
                </div>
              </div>
            ))}
        </div>
      </div>

      {/* History / Timeline */}
      {showHistory && (
        <div className="bg-white rounded-xl shadow-sm mb-6">
          <div className="p-6 border-b border-gray-100 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">Workflow History</h3>
            <div className="flex items-center gap-3">
              {/* Compliance badges */}
              <span className="px-2 py-1 bg-blue-50 text-blue-700 text-xs font-semibold rounded border border-blue-200">
                ESIGN
              </span>
              <span className="px-2 py-1 bg-blue-50 text-blue-700 text-xs font-semibold rounded border border-blue-200">
                UETA
              </span>
              <div className="flex gap-1 ml-2">
                <button
                  onClick={() => handleExportHistory('pdf')}
                  disabled={exporting}
                  className="bg-gray-100 text-gray-700 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-gray-200 transition-colors disabled:opacity-50"
                >
                  Export PDF
                </button>
                <button
                  onClick={() => handleExportHistory('csv')}
                  disabled={exporting}
                  className="bg-gray-100 text-gray-700 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-gray-200 transition-colors disabled:opacity-50"
                >
                  Export CSV
                </button>
              </div>
            </div>
          </div>
          <div className="p-6">
            {events.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-4">No history events yet</p>
            ) : (
              <div className="relative">
                {/* Timeline line */}
                <div className="absolute left-3 top-2 bottom-2 w-0.5 bg-gray-200" />
                <div className="space-y-4">
                  {events.map((event) => (
                    <div key={event.id} className="relative flex gap-4 pl-8">
                      <div className={`absolute left-1.5 top-1.5 w-3 h-3 rounded-full ${eventActionIcon(event.action)} ring-2 ring-white`} />
                      <div className="flex-1">
                        <div className="flex items-baseline gap-2 flex-wrap">
                          <span className="font-medium text-gray-900 text-sm">{event.actor}</span>
                          <span className="text-gray-600 text-sm">{event.action}</span>
                        </div>
                        <div className="flex items-center gap-3 mt-0.5">
                          <span className="text-xs text-gray-400">{new Date(event.timestamp).toLocaleString()}</span>
                          {event.ip_address && (
                            <span className="text-xs text-gray-400">IP: {event.ip_address}</span>
                          )}
                        </div>
                        {event.details && (
                          <p className="text-xs text-gray-500 mt-1">{event.details}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default WorkflowDetailPage;
