import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ApiService } from '../services/api';

interface PlanFeature {
  text: string;
}

interface Plan {
  id: string;
  name: string;
  monthlyPrice: string;
  annualPrice: string;
  annualMonthly: string;
  perUser?: boolean;
  features: PlanFeature[];
  cta: string;
  popular?: boolean;
  highlight?: boolean;
}

const plans: Plan[] = [
  {
    id: 'free',
    name: 'Free',
    monthlyPrice: '$0',
    annualPrice: '$0',
    annualMonthly: '$0',
    features: [
      { text: '3 documents/month' },
      { text: 'Unlimited signers' },
      { text: 'Basic audit trail' },
      { text: '"Powered by eDocSign" badge' },
    ],
    cta: 'Get Started Free',
  },
  {
    id: 'solo',
    name: 'Solo',
    monthlyPrice: '$3.99',
    annualPrice: '$39',
    annualMonthly: '$3.25',
    features: [
      { text: '50 documents/month' },
      { text: 'Unlimited signers' },
      { text: 'Templates & audit logs' },
      { text: 'No branding badge' },
    ],
    cta: 'Start Solo',
    popular: true,
  },
  {
    id: 'team',
    name: 'Team',
    monthlyPrice: '$8.99',
    annualPrice: '$89',
    annualMonthly: '$7.42',
    perUser: true,
    features: [
      { text: '200 documents/month' },
      { text: 'Shared templates' },
      { text: 'Team dashboard' },
      { text: 'Basic branding' },
      { text: 'Reminders & integrations' },
    ],
    cta: 'Start Team',
  },
  {
    id: 'scale',
    name: 'Scale',
    monthlyPrice: '$59',
    annualPrice: '$590',
    annualMonthly: '$49.17',
    features: [
      { text: '1,000 documents/month' },
      { text: 'API access' },
      { text: 'White-label' },
      { text: 'Priority support' },
    ],
    cta: 'Start Scale',
  },
];

function PricingPage() {
  const [annual, setAnnual] = useState(false);
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const handleSelectPlan = async (plan: Plan) => {
    if (plan.id === 'free') {
      navigate('/register');
      return;
    }

    if (!isAuthenticated) {
      navigate(`/register?returnUrl=/pricing`);
      return;
    }

    setLoadingPlan(plan.id);
    try {
      const response = await ApiService.post<{ url: string }>('/billing/checkout', {
        plan: plan.id,
        interval: annual ? 'year' : 'month',
      });
      if (response.success && response.data?.url) {
        window.location.href = response.data.url;
      }
    } catch {
      // Silently handle
    } finally {
      setLoadingPlan(null);
    }
  };

  return (
    <div className="py-16 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-3">Simple, transparent pricing</h1>
          <p className="text-lg text-gray-500">Start free, upgrade when you need more</p>
        </div>

        {/* Monthly / Annual toggle */}
        <div className="flex items-center justify-center gap-3 mb-12">
          <span className={`text-sm font-medium ${!annual ? 'text-gray-900' : 'text-gray-500'}`}>Monthly</span>
          <button
            onClick={() => setAnnual(!annual)}
            className={`relative w-14 h-7 rounded-full transition-colors ${annual ? 'bg-indigo-600' : 'bg-gray-300'}`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform ${annual ? 'translate-x-7' : ''}`}
            />
          </button>
          <span className={`text-sm font-medium ${annual ? 'text-gray-900' : 'text-gray-500'}`}>
            Annual
            <span className="ml-1.5 inline-block bg-green-100 text-green-700 text-xs font-semibold px-2 py-0.5 rounded-full">
              ~20% off
            </span>
          </span>
        </div>

        {/* Plan cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={`relative rounded-2xl border-2 p-6 flex flex-col ${
                plan.popular
                  ? 'border-indigo-600 shadow-lg shadow-indigo-100'
                  : 'border-gray-200'
              } bg-white`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-indigo-600 text-white text-xs font-semibold px-3 py-1 rounded-full">
                  Most Popular
                </div>
              )}

              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-1">{plan.name}</h3>
                <div className="flex items-end gap-1">
                  <span className="text-4xl font-bold text-gray-900">
                    {annual ? plan.annualMonthly : plan.monthlyPrice}
                  </span>
                  <span className="text-gray-500 text-sm mb-1">
                    /{plan.perUser ? 'user/' : ''}mo
                  </span>
                </div>
                {annual && plan.id !== 'free' && (
                  <p className="text-xs text-gray-400 mt-1">
                    Billed {plan.annualPrice}{plan.perUser ? '/user' : ''}/year
                  </p>
                )}
              </div>

              <ul className="space-y-3 mb-8 flex-1">
                {plan.features.map((feature, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                    <svg className="w-5 h-5 text-indigo-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {feature.text}
                  </li>
                ))}
              </ul>

              <button
                onClick={() => handleSelectPlan(plan)}
                disabled={loadingPlan === plan.id}
                className={`w-full py-2.5 rounded-lg text-sm font-semibold transition-colors ${
                  plan.popular
                    ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                    : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
                } disabled:opacity-50`}
              >
                {loadingPlan === plan.id ? 'Redirecting...' : plan.cta}
              </button>
            </div>
          ))}
        </div>

        {/* FAQ-like footer */}
        <div className="mt-16 text-center">
          <p className="text-gray-500 text-sm">
            All plans include SSL encryption, SOC 2 compliance, and 99.9% uptime SLA.
          </p>
          <p className="text-gray-400 text-xs mt-2">
            Prices in USD. Cancel anytime. No hidden fees.
          </p>
        </div>
      </div>
    </div>
  );
}

export default PricingPage;
