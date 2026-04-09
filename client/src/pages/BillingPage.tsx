import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ApiService } from '../services/api';

interface BillingData {
  plan: string;
  status: string;
  usage: {
    documents_sent: number;
    documents_limit: number;
  };
  current_period_end: string | null;
}

function BillingPage() {
  const [billing, setBilling] = useState<BillingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [portalLoading, setPortalLoading] = useState(false);

  useEffect(() => {
    const fetchBilling = async () => {
      try {
        const response = await ApiService.get<BillingData>('/billing/subscription');
        if (response.success && response.data) {
          setBilling(response.data);
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    };
    fetchBilling();
  }, []);

  const handleManageSubscription = async () => {
    setPortalLoading(true);
    try {
      const response = await ApiService.post<{ url: string }>('/billing/portal', {});
      if (response.success && response.data?.url) {
        window.location.href = response.data.url;
      }
    } catch {
      // ignore
    } finally {
      setPortalLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    );
  }

  const isFree = !billing || billing.plan === 'free';
  const usagePercent = billing
    ? Math.min(100, Math.round((billing.usage.documents_sent / billing.usage.documents_limit) * 100))
    : 0;

  const statusColors: Record<string, string> = {
    active: 'bg-green-100 text-green-700',
    trialing: 'bg-blue-100 text-blue-700',
    past_due: 'bg-yellow-100 text-yellow-700',
    canceled: 'bg-red-100 text-red-700',
  };

  return (
    <div className="py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-8">Billing & Subscription</h1>

        {/* Current Plan */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Current Plan</h2>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-2xl font-bold text-indigo-600 capitalize">
                  {billing?.plan || 'Free'}
                </span>
                {billing && billing.status && (
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${statusColors[billing.status] || 'bg-gray-100 text-gray-600'}`}>
                    {billing.status}
                  </span>
                )}
              </div>
            </div>
          </div>

          {isFree && (
            <div className="bg-indigo-50 rounded-lg p-4 mb-4">
              <p className="text-sm text-indigo-800">
                You're on the Free plan. Upgrade for more documents and features.
              </p>
            </div>
          )}

          {/* Usage bar */}
          {billing && (
            <div className="mb-4">
              <div className="flex items-center justify-between text-sm mb-1.5">
                <span className="text-gray-600">Documents used this month</span>
                <span className="font-medium text-gray-900">
                  {billing.usage.documents_sent} of {billing.usage.documents_limit}
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div
                  className={`h-2.5 rounded-full transition-all ${
                    usagePercent >= 90 ? 'bg-red-500' : usagePercent >= 70 ? 'bg-yellow-500' : 'bg-indigo-600'
                  }`}
                  style={{ width: `${usagePercent}%` }}
                />
              </div>
            </div>
          )}

          {/* Next billing date */}
          {billing?.current_period_end && !isFree && (
            <p className="text-sm text-gray-500">
              Next billing date:{' '}
              <span className="font-medium text-gray-700">
                {new Date(billing.current_period_end).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </span>
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-3">
          <Link
            to="/pricing"
            className="bg-indigo-600 text-white px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors"
          >
            {isFree ? 'Upgrade Plan' : 'Change Plan'}
          </Link>
          {!isFree && (
            <button
              onClick={handleManageSubscription}
              disabled={portalLoading}
              className="bg-white border border-gray-300 text-gray-700 px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              {portalLoading ? 'Loading...' : 'Manage Subscription'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default BillingPage;
