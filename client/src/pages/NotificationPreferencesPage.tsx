import { useState, useEffect, useRef, useCallback } from 'react';
import { ApiService } from '../services/api';

interface NotificationPreference {
  type: string;
  email: boolean;
  sms: boolean;
  in_app: boolean;
}

const NOTIFICATION_TYPES = [
  { key: 'signature_requested', label: 'Signature Requested', description: 'When someone requests your signature' },
  { key: 'signature_completed', label: 'Signature Completed', description: 'When a signature is completed on your document' },
  { key: 'document_shared', label: 'Document Shared', description: 'When a document is shared with you' },
  { key: 'reminder', label: 'Reminders', description: 'Deadline and follow-up reminders' },
  { key: 'system', label: 'System', description: 'System updates and announcements' },
];

const DEFAULT_PREFERENCES: NotificationPreference[] = NOTIFICATION_TYPES.map((t) => ({
  type: t.key,
  email: true,
  sms: false,
  in_app: true,
}));

function NotificationPreferencesPage() {
  const [preferences, setPreferences] = useState<NotificationPreference[]>(DEFAULT_PREFERENCES);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [toast, setToast] = useState<string>('');
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const fetchPreferences = async (): Promise<void> => {
      try {
        const response = await ApiService.get<{ preferences: NotificationPreference[] }>('/notifications/preferences');
        if (response.success && response.data?.preferences) {
          // Merge with defaults so all types are present
          const loaded = response.data.preferences;
          const merged = NOTIFICATION_TYPES.map((t) => {
            const found = loaded.find((p) => p.type === t.key);
            return found || { type: t.key, email: true, sms: false, in_app: true };
          });
          setPreferences(merged);
        }
      } catch {
        /* use defaults */
      } finally {
        setLoading(false);
      }
    };
    fetchPreferences();
  }, []);

  const savePreferences = useCallback(async (prefs: NotificationPreference[]): Promise<void> => {
    setSaving(true);
    try {
      const res = await ApiService.put('/notifications/preferences', { preferences: prefs });
      if (res.success) {
        setToast('Preferences saved');
        setTimeout(() => setToast(''), 3000);
      }
    } catch {
      /* ignore */
    } finally {
      setSaving(false);
    }
  }, []);

  const handleToggle = (type: string, channel: 'email' | 'sms' | 'in_app'): void => {
    const updated = preferences.map((p) =>
      p.type === type ? { ...p, [channel]: !p[channel] } : p
    );
    setPreferences(updated);

    // Debounced save
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      savePreferences(updated);
    }, 800);
  };

  const handleResetDefaults = (): void => {
    setPreferences(DEFAULT_PREFERENCES);
    savePreferences(DEFAULT_PREFERENCES);
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Notification Preferences</h1>
          <p className="text-sm text-gray-500 mt-1">Choose how you want to be notified</p>
        </div>
        <button
          onClick={handleResetDefaults}
          className="border border-gray-300 text-gray-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
        >
          Reset to Defaults
        </button>
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-green-600 text-white px-5 py-3 rounded-lg shadow-lg text-sm font-medium animate-pulse">
          {toast}
        </div>
      )}

      {loading ? (
        <div className="bg-white rounded-xl shadow-sm p-12 text-center">
          <p className="text-gray-500">Loading preferences...</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          {/* Header row */}
          <div className="grid grid-cols-[1fr_80px_80px_80px] gap-2 px-6 py-3 bg-gray-50 border-b border-gray-100">
            <div className="text-sm font-semibold text-gray-600">Notification Type</div>
            <div className="text-sm font-semibold text-gray-600 text-center">Email</div>
            <div className="text-sm font-semibold text-gray-600 text-center">SMS</div>
            <div className="text-sm font-semibold text-gray-600 text-center">In-App</div>
          </div>

          {/* Preference rows */}
          <div className="divide-y divide-gray-50">
            {NOTIFICATION_TYPES.map((nt) => {
              const pref = preferences.find((p) => p.type === nt.key);
              if (!pref) return null;
              return (
                <div key={nt.key} className="grid grid-cols-[1fr_80px_80px_80px] gap-2 px-6 py-4 items-center hover:bg-gray-50 transition-colors">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{nt.label}</p>
                    <p className="text-xs text-gray-500">{nt.description}</p>
                  </div>
                  {(['email', 'sms', 'in_app'] as const).map((channel) => (
                    <div key={channel} className="flex justify-center">
                      <button
                        onClick={() => handleToggle(nt.key, channel)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          pref[channel] ? 'bg-indigo-600' : 'bg-gray-300'
                        }`}
                        aria-label={`Toggle ${channel} for ${nt.label}`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            pref[channel] ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>

          {/* Saving indicator */}
          {saving && (
            <div className="px-6 py-2 bg-indigo-50 border-t border-indigo-100 text-xs text-indigo-600 font-medium">
              Saving preferences...
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default NotificationPreferencesPage;
