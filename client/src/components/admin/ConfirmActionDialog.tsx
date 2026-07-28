import { useState, FormEvent } from 'react';
import { useAdminAuth } from '../../context/AdminAuthContext';

interface ConfirmActionDialogProps {
  title: string;
  /** Plain-language restatement of what is about to happen. */
  description: string;
  confirmLabel: string;
  /** Renders the confirm button in red for destructive actions. */
  destructive?: boolean;
  onCancel: () => void;
  /** Receives the typed reason once the session is elevated. */
  onConfirm: (reason: string) => Promise<{ ok: boolean; error?: string }>;
}

/**
 * Confirmation dialog for every mutating admin action.
 *
 * Enforces two things the API also enforces server-side, so the user finds out
 * before submitting rather than after: a reason is mandatory, and the session
 * must be elevated via step-up. If the session is not elevated the dialog
 * collects the password and elevates first.
 */
function ConfirmActionDialog({
  title,
  description,
  confirmLabel,
  destructive = false,
  onCancel,
  onConfirm,
}: ConfirmActionDialogProps) {
  const { elevated, stepUp } = useAdminAuth();

  const [reason, setReason] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);

  const needsElevation = !elevated;
  const canSubmit = reason.trim().length > 0 && (!needsElevation || password.length > 0);

  const handleSubmit = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    setError('');
    setSubmitting(true);

    if (needsElevation) {
      const elevation = await stepUp(password);
      if (!elevation.ok) {
        setSubmitting(false);
        setError(elevation.error || 'Password confirmation failed');
        return;
      }
    }

    const result = await onConfirm(reason.trim());
    setSubmitting(false);

    if (!result.ok) {
      setError(result.error || 'Action failed');
      return;
    }

    onCancel();
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center px-4 z-50">
      <form
        onSubmit={handleSubmit}
        className="bg-slate-900 border border-slate-800 rounded-xl p-6 w-full max-w-md space-y-4"
      >
        <div>
          <h2 className="text-base font-semibold text-slate-100">{title}</h2>
          <p className="text-sm text-slate-400 mt-1.5">{description}</p>
        </div>

        {error && (
          <div className="bg-red-950 border border-red-900 text-red-300 px-3 py-2 rounded-lg text-sm">
            {error}
          </div>
        )}

        <div>
          <label htmlFor="action-reason" className="block text-sm text-slate-400 mb-1.5">
            Reason <span className="text-slate-600">(recorded in the audit log)</span>
          </label>
          <textarea
            id="action-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            required
            className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>

        {needsElevation && (
          <div>
            <label htmlFor="action-password" className="block text-sm text-slate-400 mb-1.5">
              Confirm your password
            </label>
            <input
              id="action-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
            <p className="text-xs text-slate-600 mt-1.5">
              Mutating actions require re-confirming your password.
            </p>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-2 text-sm rounded-lg border border-slate-700 hover:bg-slate-800 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!canSubmit || submitting}
            className={`px-3 py-2 text-sm rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
              destructive ? 'bg-red-600 hover:bg-red-500' : 'bg-indigo-600 hover:bg-indigo-500'
            }`}
          >
            {submitting ? 'Working…' : confirmLabel}
          </button>
        </div>
      </form>
    </div>
  );
}

export default ConfirmActionDialog;
