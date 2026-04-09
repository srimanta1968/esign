import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

type Tab = 'manual' | 'team' | 'api';

interface Step {
  number: number;
  title: string;
  description: string;
  link?: string;
  linkLabel?: string;
  optional?: boolean;
  completedWhenLoggedIn?: boolean;
}

interface Phase {
  title: string;
  steps: Step[];
}

const phases: Phase[] = [
  {
    title: 'Phase 1: Setup',
    steps: [
      {
        number: 1,
        title: 'Create Your Account',
        description: "Sign up at eDocSign and verify your email. You're all set!",
        link: '/register',
        linkLabel: 'Go to Register',
        completedWhenLoggedIn: true,
      },
      {
        number: 2,
        title: 'Upload Your First Document',
        description: 'Upload a PDF, DOC, or image file. Supported formats: PDF, DOCX, PNG, JPEG.',
        link: '/upload',
        linkLabel: 'Upload Document',
      },
      {
        number: 3,
        title: 'Create Your Signature',
        description: 'Draw, type, or upload your signature. This will be saved and auto-applied to future documents.',
        link: '/signatures/create',
        linkLabel: 'Create Signature',
      },
      {
        number: 4,
        title: 'Choose a Plan',
        description: 'Start free with 3 docs/month or upgrade for more.',
        link: '/pricing',
        linkLabel: 'View Pricing',
        optional: true,
      },
    ],
  },
  {
    title: 'Phase 2: Sending Documents',
    steps: [
      {
        number: 5,
        title: 'Create a Signing Workflow',
        description: 'Select a document, add recipients, choose sequential or parallel signing, and place signature fields on the document.',
        link: '/workflows/create',
        linkLabel: 'Create Workflow',
      },
      {
        number: 6,
        title: 'Add Yourself as Signer',
        description: "Click 'Add Myself' to include yourself as a signer. Your saved signature will be auto-applied.",
      },
      {
        number: 7,
        title: 'Start the Workflow',
        description: "Click 'Start Workflow' to send signing emails to recipients. Sequential workflows notify one signer at a time.",
      },
    ],
  },
  {
    title: 'Phase 3: Tracking & Completion',
    steps: [
      {
        number: 8,
        title: 'Track Progress',
        description: 'Monitor signing progress on the Dashboard or Workflows page. Get email notifications as each person signs.',
        link: '/workflows',
        linkLabel: 'View Workflows',
      },
      {
        number: 9,
        title: 'Download Signed Documents',
        description: "Once all parties sign, you'll receive an email with a link to download the signed PDF and signing certificate.",
      },
      {
        number: 10,
        title: 'Manage Templates',
        description: 'Save frequently used documents as templates for quick reuse.',
        link: '/templates',
        linkLabel: 'View Templates',
      },
    ],
  },
];

const teamPhases: Phase[] = [
  {
    title: 'Step 1: Create Your Team',
    steps: [
      {
        number: 1,
        title: 'Go to Team Page',
        description: 'Navigate to the Team page from the top navigation bar. If you don\'t have a team yet, you\'ll see the option to create one.',
        link: '/team',
        linkLabel: 'Go to Team',
      },
      {
        number: 2,
        title: 'Choose Team or Scale Plan',
        description: 'Team Plan ($8.99/user/month): 200 shared documents/month, ideal for small teams of 3-10 people. Scale Plan ($59/month flat): 1,000 shared documents/month, unlimited users, API access, white-label — ideal for agencies and high-volume businesses.',
        link: '/pricing',
        linkLabel: 'Compare Plans',
      },
      {
        number: 3,
        title: 'Name Your Team',
        description: 'Enter your team or company name (e.g., "Acme Corp") and click Create Team. You become the team owner with full admin control.',
      },
    ],
  },
  {
    title: 'Step 2: Invite Your Team Members',
    steps: [
      {
        number: 4,
        title: 'Add Members by Email',
        description: 'On the Team page, enter team member email addresses and click Invite. You can invite multiple people at once by separating emails with commas. Each member gets an invite email with a "Join Team" button.',
        link: '/team',
        linkLabel: 'Invite Members',
      },
      {
        number: 5,
        title: 'Members Accept the Invite',
        description: 'Invited members click the link in their email. If they already have an eDocSign account, they log in and join. If not, they create a free account first, then automatically join your team.',
      },
      {
        number: 6,
        title: 'Assign Roles',
        description: 'As the team owner, you can assign roles: Owner (full control, billing), Admin (can invite/remove members), or Member (can use shared documents and templates). Change roles anytime from the Team page.',
      },
    ],
  },
  {
    title: 'Step 3: Work as a Team',
    steps: [
      {
        number: 7,
        title: 'Shared Document Quota',
        description: 'All team members share one document pool. Team plan: 200 docs/month shared. Scale plan: 1,000 docs/month shared. When any member uploads a document or creates a workflow, it counts against the team\'s shared quota — not individual limits.',
      },
      {
        number: 8,
        title: 'Shared Templates',
        description: 'Team members can access shared document templates. Create a template once, and everyone on the team can use it to send documents for signature.',
        link: '/templates',
        linkLabel: 'Manage Templates',
      },
      {
        number: 9,
        title: 'Monitor Team Usage',
        description: 'Track your team\'s document usage on the Team page and Billing page. See how many documents have been used this month, by whom, and how many remain in your shared pool.',
        link: '/settings/billing',
        linkLabel: 'View Billing',
      },
    ],
  },
  {
    title: 'Step 4: Manage Billing',
    steps: [
      {
        number: 10,
        title: 'Per-Seat Billing (Team Plan)',
        description: 'Team plan charges $8.99 per user per month. When you add a member, billing automatically adjusts. When you remove a member, the charge decreases. Annual billing saves ~20%: $89/user/year.',
      },
      {
        number: 11,
        title: 'Flat Rate (Scale Plan)',
        description: 'Scale plan is $59/month flat regardless of team size. Includes 1,000 docs/month, API access, and white-label. Best for agencies or teams sending high volumes.',
      },
      {
        number: 12,
        title: 'Manage Subscription',
        description: 'Go to Billing settings to upgrade, downgrade, or manage your subscription. You can also access the Stripe customer portal to update payment methods or view invoices.',
        link: '/settings/billing',
        linkLabel: 'Billing Settings',
      },
    ],
  },
];

const curlExamples = [
  {
    title: 'Upload a document',
    code: `curl -X POST https://api.edocsign.com/api/documents \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -F "file=@contract.pdf"`,
  },
  {
    title: 'Create a workflow',
    code: `curl -X POST https://api.edocsign.com/api/workflows \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"document_id": "...", "workflow_type": "sequential", "recipients": [...]}'`,
  },
  {
    title: 'Check workflow status',
    code: `curl https://api.edocsign.com/api/workflows/{id}/status \\
  -H "Authorization: Bearer YOUR_API_KEY"`,
  },
];

function GuidePage() {
  const { isAuthenticated } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('manual');
  const [expandedSteps, setExpandedSteps] = useState<Set<number>>(new Set([1]));

  const toggleStep = (stepNumber: number) => {
    setExpandedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(stepNumber)) {
        next.delete(stepNumber);
      } else {
        next.add(stepNumber);
      }
      return next;
    });
  };

  const getStepStatus = (step: Step): 'done' | 'todo' => {
    if (step.completedWhenLoggedIn && isAuthenticated) return 'done';
    return 'todo';
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-10">
      {/* Header */}
      <div className="text-center mb-10">
        <h1 className="text-3xl font-bold text-gray-900">eDocSign Workflow Guide</h1>
        <p className="mt-3 text-gray-500 max-w-2xl mx-auto">
          Master the complete eDocSign workflow — from uploading documents to collecting signatures and managing agreements.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex justify-center mb-8">
        <div className="inline-flex bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setActiveTab('manual')}
            className={`px-5 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'manual'
                ? 'bg-white text-indigo-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Manual Steps
          </button>
          <button
            onClick={() => setActiveTab('team')}
            className={`px-5 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'team'
                ? 'bg-white text-indigo-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Team & Scale Setup
          </button>
          <button
            onClick={() => setActiveTab('api')}
            className={`px-5 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'api'
                ? 'bg-white text-indigo-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            API Integration
          </button>
        </div>
      </div>

      {activeTab === 'manual' ? (
        <div className="flex gap-8 items-start">
          {/* Main content */}
          <div className="flex-1 min-w-0 space-y-8">
            {phases.map((phase) => (
              <div key={phase.title}>
                <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-indigo-500" />
                  {phase.title}
                </h2>
                <div className="space-y-3">
                  {phase.steps.map((step) => {
                    const status = getStepStatus(step);
                    const isExpanded = expandedSteps.has(step.number);
                    return (
                      <div
                        key={step.number}
                        className="bg-white border border-gray-200 rounded-lg overflow-hidden"
                      >
                        <button
                          onClick={() => toggleStep(step.number)}
                          className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-gray-50 transition-colors"
                        >
                          {/* Number badge */}
                          <span
                            className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                              status === 'done'
                                ? 'bg-green-100 text-green-700'
                                : 'bg-indigo-100 text-indigo-700'
                            }`}
                          >
                            {status === 'done' ? (
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                              </svg>
                            ) : (
                              step.number
                            )}
                          </span>

                          {/* Title */}
                          <span className="flex-1 font-medium text-gray-900">{step.title}</span>

                          {/* Badges */}
                          <div className="flex items-center gap-2 shrink-0">
                            {step.optional && (
                              <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                                Optional
                              </span>
                            )}
                            <span
                              className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                status === 'done'
                                  ? 'bg-green-100 text-green-700'
                                  : 'bg-gray-100 text-gray-500'
                              }`}
                            >
                              {status === 'done' ? 'Done' : 'To Do'}
                            </span>
                            <svg
                              className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </div>
                        </button>

                        {isExpanded && (
                          <div className="px-5 pb-4 pt-0 ml-12">
                            <p className="text-sm text-gray-600 leading-relaxed">{step.description}</p>
                            {step.link && (
                              <Link
                                to={step.link}
                                className="inline-flex items-center gap-1.5 mt-3 text-sm font-medium text-indigo-600 hover:text-indigo-700 transition-colors"
                              >
                                {step.linkLabel || 'Go'}
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                              </Link>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Sidebar */}
          <div className="hidden lg:block w-80 shrink-0 space-y-6">
            {/* How It Works */}
            <div className="bg-white border border-gray-200 rounded-lg p-5">
              <h3 className="font-semibold text-gray-900 mb-3">How It Works</h3>
              <ol className="space-y-2 text-sm text-gray-600">
                <li className="flex gap-2">
                  <span className="shrink-0 w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold">1</span>
                  Upload document
                </li>
                <li className="flex gap-2">
                  <span className="shrink-0 w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold">2</span>
                  Add recipients
                </li>
                <li className="flex gap-2">
                  <span className="shrink-0 w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold">3</span>
                  Place signature fields
                </li>
                <li className="flex gap-2">
                  <span className="shrink-0 w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold">4</span>
                  Send for signing
                </li>
                <li className="flex gap-2">
                  <span className="shrink-0 w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold">5</span>
                  Download signed copy
                </li>
              </ol>
            </div>

            {/* Supported Formats */}
            <div className="bg-white border border-gray-200 rounded-lg p-5">
              <h3 className="font-semibold text-gray-900 mb-3">Supported Formats</h3>
              <div className="flex flex-wrap gap-2">
                {['PDF', 'DOC', 'DOCX', 'PNG', 'JPEG'].map((fmt) => (
                  <span key={fmt} className="text-xs bg-gray-100 text-gray-700 px-2.5 py-1 rounded-md font-medium">
                    {fmt}
                  </span>
                ))}
              </div>
            </div>

            {/* Plan Limits */}
            <div className="bg-white border border-gray-200 rounded-lg p-5">
              <h3 className="font-semibold text-gray-900 mb-3">Plan Limits</h3>
              <ul className="space-y-2 text-sm text-gray-600">
                <li className="flex justify-between">
                  <span>Free</span>
                  <span className="font-medium text-gray-900">3 docs/mo</span>
                </li>
                <li className="flex justify-between">
                  <span>Solo</span>
                  <span className="font-medium text-gray-900">50 docs/mo</span>
                </li>
                <li className="flex justify-between">
                  <span>Team</span>
                  <span className="font-medium text-gray-900">200 docs/mo</span>
                </li>
                <li className="flex justify-between">
                  <span>Scale</span>
                  <span className="font-medium text-gray-900">1,000 docs/mo</span>
                </li>
              </ul>
              <Link
                to="/pricing"
                className="block mt-3 text-center text-sm font-medium text-indigo-600 hover:text-indigo-700"
              >
                Compare Plans
              </Link>
            </div>
          </div>
        </div>
      ) : activeTab === 'team' ? (
        /* Team & Scale Setup Tab */
        <div className="flex gap-8 items-start">
          <div className="flex-1 min-w-0 space-y-8">
            {teamPhases.map((phase) => (
              <div key={phase.title}>
                <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-indigo-500" />
                  {phase.title}
                </h2>
                <div className="space-y-3">
                  {phase.steps.map((step) => {
                    const isExpanded = expandedSteps.has(step.number + 100);
                    return (
                      <div key={step.number} className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                        <button
                          onClick={() => toggleStep(step.number + 100)}
                          className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-gray-50 transition-colors"
                        >
                          <span className="shrink-0 w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-sm font-bold">
                            {step.number}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-gray-900">{step.title}</p>
                          </div>
                          <svg className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                        {isExpanded && (
                          <div className="px-5 pb-4 pl-17">
                            <p className="text-sm text-gray-600 leading-relaxed ml-12">{step.description}</p>
                            {step.link && (
                              <Link to={step.link} className="inline-block mt-3 ml-12 text-sm text-indigo-600 font-medium hover:text-indigo-700">
                                {step.linkLabel} &rarr;
                              </Link>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Sidebar */}
          <div className="hidden lg:block w-72 shrink-0 space-y-6">
            <div className="bg-white border border-gray-200 rounded-lg p-5">
              <h3 className="font-semibold text-gray-900 mb-3">Plan Comparison</h3>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-2 text-gray-500 font-medium"></th>
                    <th className="text-center py-2 text-gray-500 font-medium">Team</th>
                    <th className="text-center py-2 text-gray-500 font-medium">Scale</th>
                  </tr>
                </thead>
                <tbody className="text-gray-700">
                  <tr className="border-b border-gray-50"><td className="py-2">Price</td><td className="text-center">$8.99/user</td><td className="text-center">$59 flat</td></tr>
                  <tr className="border-b border-gray-50"><td className="py-2">Docs/mo</td><td className="text-center">200</td><td className="text-center">1,000</td></tr>
                  <tr className="border-b border-gray-50"><td className="py-2">Users</td><td className="text-center">3+</td><td className="text-center">Unlimited</td></tr>
                  <tr className="border-b border-gray-50"><td className="py-2">Templates</td><td className="text-center">Shared</td><td className="text-center">Shared</td></tr>
                  <tr className="border-b border-gray-50"><td className="py-2">API</td><td className="text-center">-</td><td className="text-center">Yes</td></tr>
                  <tr><td className="py-2">White-label</td><td className="text-center">-</td><td className="text-center">Yes</td></tr>
                </tbody>
              </table>
            </div>
            <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-5">
              <h3 className="font-semibold text-indigo-900 mb-2">Need Help?</h3>
              <p className="text-sm text-indigo-700">Contact us at support@edocsign.com for help setting up your team or choosing the right plan.</p>
            </div>
          </div>
        </div>
      ) : (
        /* API Integration Tab */
        <div className="max-w-3xl mx-auto">
          <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Getting Started with the API</h2>
            <p className="text-sm text-gray-600 mb-4">
              Generate an API key from Settings to integrate eDocSign into your application.
            </p>
            <Link
              to="/settings/api-keys"
              className="inline-flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
              </svg>
              Manage API Keys
            </Link>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="font-semibold text-gray-900 mb-1">API Base URL</h3>
            <code className="block text-sm bg-gray-50 border border-gray-200 rounded-md px-3 py-2 mb-6 text-gray-700 font-mono">
              https://api.edocsign.com/api
            </code>

            <h3 className="font-semibold text-gray-900 mb-4">Code Examples</h3>
            <div className="space-y-5">
              {curlExamples.map((ex) => (
                <div key={ex.title}>
                  <p className="text-sm font-medium text-gray-700 mb-2">{ex.title}</p>
                  <pre className="text-xs bg-gray-900 text-gray-100 rounded-lg p-4 overflow-x-auto">
                    <code>{ex.code}</code>
                  </pre>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default GuidePage;
