import { Link } from 'react-router-dom';

function HomePage() {
  return (
    <div className="overflow-hidden">
      {/* ───────────────── 1. Hero Section ───────────────── */}
      <section className="bg-gradient-to-br from-indigo-600 via-indigo-700 to-purple-800 relative">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(255,255,255,0.1)_0%,_transparent_60%)]" />
        <div className="max-w-7xl mx-auto px-4 py-24 md:py-32 text-center relative z-10">
          <span className="inline-block bg-white/15 backdrop-blur text-white text-sm font-semibold px-5 py-1.5 rounded-full mb-8 border border-white/20">
            The #1 Affordable E-Signature Platform
          </span>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold text-white mb-6 leading-tight tracking-tight">
            Sign Documents Securely, Anywhere&nbsp;&mdash;<br className="hidden md:block" />
            <span className="text-indigo-200">at a Fraction of the Cost</span>
          </h1>
          <p className="text-lg md:text-xl text-indigo-100 max-w-3xl mx-auto mb-10 leading-relaxed">
            Upload, sign, and manage agreements end-to-end. Starting at just{' '}
            <span className="font-bold text-white">$3.99/month</span> &mdash; up to 75% cheaper than
            DocuSign, Adobe Sign, and Dropbox Sign.
          </p>
          <div className="flex gap-4 justify-center flex-wrap mb-4">
            <Link
              to="/register"
              className="bg-white text-indigo-700 px-8 py-3.5 rounded-lg text-lg font-bold hover:bg-indigo-50 transition-colors shadow-lg shadow-indigo-900/30"
            >
              Start Free &mdash; No Credit Card
            </Link>
            <Link
              to="/pricing"
              className="border-2 border-white/60 text-white px-8 py-3.5 rounded-lg text-lg font-semibold hover:bg-white/10 transition-colors"
            >
              See Pricing
            </Link>
          </div>
          <p className="text-indigo-200 text-sm mb-10">
            Free plan includes 3 documents/month. No credit card required.
          </p>
          <p className="text-indigo-300 text-sm font-medium">
            Trusted by freelancers, realtors, lawyers, and SMBs worldwide
          </p>
        </div>
      </section>

      {/* ───────────────── 2. Why eDocSign vs Competitors ───────────────── */}
      <section className="py-20 bg-white">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-bold text-center text-gray-900 mb-4">
            Why Pay More? eDocSign vs The Competition
          </h2>
          <p className="text-gray-500 text-center mb-12 max-w-2xl mx-auto">
            Get the same powerful features at a fraction of the price.
          </p>

          <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
            <table className="w-full text-sm md:text-base">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left py-4 px-5 font-semibold text-gray-700">Feature</th>
                  <th className="py-4 px-5 font-bold text-indigo-700 bg-indigo-50">eDocSign</th>
                  <th className="py-4 px-5 font-semibold text-gray-500">DocuSign</th>
                  <th className="py-4 px-5 font-semibold text-gray-500">Adobe Sign</th>
                  <th className="py-4 px-5 font-semibold text-gray-500">Dropbox Sign</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {[
                  ['Entry Price', '$3.99/mo', '$15/mo', '$15\u201320/mo', '$15/mo'],
                  ['Free Plan', 'Yes \u2014 3 docs', 'No', 'No', 'No'],
                  ['Unlimited Signers', 'All plans', 'Standard+', 'Business+', 'All'],
                  ['Audit Trail', 'All plans', 'Standard+', 'Business+', 'All'],
                  ['Templates', 'Solo+', 'Standard+', 'Business+', 'Essentials+'],
                  ['Team Collaboration', '$8.99/user', '$45/user', '$25/user', '$15/user'],
                  ['API Access', '$59/mo', 'Custom', 'Enterprise', 'Business+'],
                ].map(([feature, edoc, docu, adobe, dropbox], i) => (
                  <tr key={i} className="hover:bg-gray-50/50">
                    <td className="py-3.5 px-5 font-medium text-gray-800">{feature}</td>
                    <td className="py-3.5 px-5 text-center bg-indigo-50/50">
                      <span className="inline-flex items-center gap-1.5 text-green-700 font-semibold">
                        <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                        {edoc}
                      </span>
                    </td>
                    <td className="py-3.5 px-5 text-center text-gray-400">{docu}</td>
                    <td className="py-3.5 px-5 text-center text-gray-400">{adobe}</td>
                    <td className="py-3.5 px-5 text-center text-gray-400">{dropbox}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-gray-400 text-center mt-4">
            Prices as of 2026. Based on publicly available pricing.
          </p>
        </div>
      </section>

      {/* ───────────────── 3. How It Works ───────────────── */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-bold text-center text-gray-900 mb-4">
            Get Documents Signed in 4 Simple Steps
          </h2>
          <p className="text-gray-500 text-center mb-14 max-w-xl mx-auto">
            From upload to signed PDF in minutes.
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              {
                step: 1,
                title: 'Upload Document',
                desc: 'Upload PDF, DOC, or images. Stored securely on AWS S3.',
                icon: (
                  <svg className="w-7 h-7 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                ),
              },
              {
                step: 2,
                title: 'Add Recipients & Place Fields',
                desc: 'Add signers, set signing order, and drag signature fields onto the document.',
                icon: (
                  <svg className="w-7 h-7 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                ),
              },
              {
                step: 3,
                title: 'Send for Signing',
                desc: 'Recipients get a secure email link. No account needed to sign.',
                icon: (
                  <svg className="w-7 h-7 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                ),
              },
              {
                step: 4,
                title: 'Track, Sign & Download',
                desc: 'Track progress in real-time. Get the signed PDF and signing certificate.',
                icon: (
                  <svg className="w-7 h-7 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                ),
              },
            ].map(({ step, title, desc, icon }) => (
              <div key={step} className="bg-white rounded-2xl p-7 shadow-sm border border-gray-100 text-center relative">
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-indigo-600 text-white text-sm font-bold flex items-center justify-center shadow">
                  {step}
                </div>
                <div className="w-14 h-14 bg-indigo-50 rounded-xl flex items-center justify-center mx-auto mb-4 mt-2">
                  {icon}
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ───────────────── 4. Features Grid ───────────────── */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-bold text-center text-gray-900 mb-4">
            Everything You Need for Document Signing
          </h2>
          <p className="text-gray-500 text-center mb-14 max-w-xl mx-auto">
            Powerful features to streamline your document workflow
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                title: 'Document Upload & Storage',
                desc: 'S3-backed, unlimited formats',
                color: 'blue',
                icon: (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                ),
              },
              {
                title: 'E-Signatures',
                desc: 'Draw, type, upload, or reuse saved signatures',
                color: 'green',
                icon: (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                ),
              },
              {
                title: 'Sequential & Parallel Signing',
                desc: 'Control signing order or send to all at once',
                color: 'purple',
                icon: (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h8m-8 6h16" />
                  </svg>
                ),
              },
              {
                title: 'Real-time Status Tracking',
                desc: 'Dashboard shows all workflow progress',
                color: 'orange',
                icon: (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                ),
              },
              {
                title: 'Signing Certificates',
                desc: 'SHA-256 hash, ESIGN/UETA compliant, full audit trail',
                color: 'teal',
                icon: (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                  </svg>
                ),
              },
              {
                title: 'Team Collaboration',
                desc: 'Shared templates, shared document quotas, role management',
                color: 'pink',
                icon: (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                ),
              },
              {
                title: 'Email Notifications',
                desc: 'Auto-notify signers, progress updates to creators',
                color: 'yellow',
                icon: (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                ),
              },
              {
                title: 'API & Integrations',
                desc: 'REST API with API keys for embedding signing into your app',
                color: 'indigo',
                icon: (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                  </svg>
                ),
              },
            ].map(({ title, desc, color, icon }, i) => {
              const colorMap: Record<string, string> = {
                blue: 'bg-blue-100 text-blue-600',
                green: 'bg-green-100 text-green-600',
                purple: 'bg-purple-100 text-purple-600',
                orange: 'bg-orange-100 text-orange-600',
                teal: 'bg-teal-100 text-teal-600',
                pink: 'bg-pink-100 text-pink-600',
                yellow: 'bg-yellow-100 text-yellow-600',
                indigo: 'bg-indigo-100 text-indigo-600',
              };
              return (
                <div
                  key={i}
                  className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow"
                >
                  <div className={`w-12 h-12 rounded-lg flex items-center justify-center mb-4 ${colorMap[color]}`}>
                    {icon}
                  </div>
                  <h4 className="text-lg font-semibold text-gray-900 mb-2">{title}</h4>
                  <p className="text-gray-500 text-sm leading-relaxed">{desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ───────────────── 5. Pricing Preview ───────────────── */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-bold text-center text-gray-900 mb-4">
            Simple, Transparent Pricing
          </h2>
          <p className="text-gray-500 text-center mb-14 max-w-xl mx-auto">
            No hidden fees. Upgrade or downgrade anytime.
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                name: 'Free',
                price: '$0',
                period: 'forever',
                limit: '3 documents/month',
                features: ['1 sender', 'E-signatures', 'Email notifications'],
                cta: 'Get Started',
                highlighted: false,
              },
              {
                name: 'Solo',
                price: '$3.99',
                period: '/month',
                limit: '50 documents/month',
                features: ['Templates', 'Signing certificates', 'Priority support'],
                cta: 'Start Solo',
                highlighted: true,
              },
              {
                name: 'Team',
                price: '$8.99',
                period: '/user/month',
                limit: '200 shared documents/month',
                features: ['Team collaboration', 'Shared templates', 'Role management'],
                cta: 'Start Team',
                highlighted: false,
              },
              {
                name: 'Scale',
                price: '$59',
                period: '/month',
                limit: '1,000 documents/month',
                features: ['API access', 'Custom branding', 'Dedicated support'],
                cta: 'Start Scale',
                highlighted: false,
              },
            ].map((plan, i) => (
              <div
                key={i}
                className={`rounded-2xl p-7 flex flex-col relative ${
                  plan.highlighted
                    ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-200 ring-2 ring-indigo-600'
                    : 'bg-white border border-gray-200 shadow-sm'
                }`}
              >
                {plan.highlighted && (
                  <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-green-500 text-white text-xs font-bold px-4 py-1 rounded-full shadow">
                    Most Popular
                  </span>
                )}
                <h3 className={`text-lg font-bold mb-1 ${plan.highlighted ? 'text-indigo-100' : 'text-gray-500'}`}>
                  {plan.name}
                </h3>
                <div className="mb-4">
                  <span className={`text-4xl font-extrabold ${plan.highlighted ? 'text-white' : 'text-gray-900'}`}>
                    {plan.price}
                  </span>
                  <span className={`text-sm ml-1 ${plan.highlighted ? 'text-indigo-200' : 'text-gray-400'}`}>
                    {plan.period}
                  </span>
                </div>
                <p className={`text-sm font-medium mb-5 ${plan.highlighted ? 'text-indigo-200' : 'text-gray-500'}`}>
                  {plan.limit}
                </p>
                <ul className="space-y-2.5 mb-7 flex-1">
                  {plan.features.map((f, j) => (
                    <li key={j} className="flex items-center gap-2 text-sm">
                      <svg
                        className={`w-4 h-4 flex-shrink-0 ${plan.highlighted ? 'text-green-300' : 'text-green-500'}`}
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                      <span className={plan.highlighted ? 'text-indigo-50' : 'text-gray-600'}>{f}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  to="/register"
                  className={`block text-center py-2.5 rounded-lg font-semibold text-sm transition-colors ${
                    plan.highlighted
                      ? 'bg-white text-indigo-700 hover:bg-indigo-50'
                      : 'bg-indigo-600 text-white hover:bg-indigo-700'
                  }`}
                >
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>
          <div className="text-center mt-8">
            <Link to="/pricing" className="text-indigo-600 font-semibold hover:text-indigo-700 transition-colors">
              View Full Pricing &rarr;
            </Link>
          </div>
        </div>
      </section>

      {/* ───────────────── 6. Industry Use Cases ───────────────── */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-bold text-center text-gray-900 mb-4">
            Built for Every Industry
          </h2>
          <p className="text-gray-500 text-center mb-14 max-w-xl mx-auto">
            Trusted by professionals across every sector.
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                title: 'Real Estate',
                desc: 'Listing agreements, offers, rental contracts signed in minutes.',
                icon: (
                  <svg className="w-8 h-8 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0h4" />
                  </svg>
                ),
              },
              {
                title: 'Freelancers & Consultants',
                desc: 'MSAs, SOWs, retainer agreements \u2014 send and track effortlessly.',
                icon: (
                  <svg className="w-8 h-8 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m8 0H8m8 0a2 2 0 012 2v6M8 6a2 2 0 00-2 2v6" />
                  </svg>
                ),
              },
              {
                title: 'HR & Recruiting',
                desc: 'Offer letters, NDAs, onboarding packs \u2014 streamline the hiring process.',
                icon: (
                  <svg className="w-8 h-8 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                ),
              },
              {
                title: 'Legal & Finance',
                desc: 'Contracts, compliance docs, partnership agreements with full audit trail.',
                icon: (
                  <svg className="w-8 h-8 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
                  </svg>
                ),
              },
            ].map(({ title, desc, icon }, i) => (
              <div
                key={i}
                className="bg-gray-50 rounded-2xl p-7 border border-gray-100 hover:shadow-md transition-shadow"
              >
                <div className="w-14 h-14 bg-indigo-50 rounded-xl flex items-center justify-center mb-5">
                  {icon}
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">{title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ───────────────── 7. Trust & Security ───────────────── */}
      <section className="py-20 bg-gray-900">
        <div className="max-w-5xl mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Enterprise-Grade Security for Every Plan
          </h2>
          <p className="text-gray-400 mb-14 max-w-xl mx-auto">
            Your documents are protected with industry-leading security standards.
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
            {[
              {
                title: 'AWS S3 Encrypted Storage',
                icon: (
                  <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                ),
              },
              {
                title: 'ESIGN Act & UETA Compliant',
                icon: (
                  <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                ),
              },
              {
                title: 'SHA-256 Document Hash',
                icon: (
                  <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                ),
              },
              {
                title: 'Full Audit Trail with IP Logging',
                icon: (
                  <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  </svg>
                ),
              },
            ].map(({ title, icon }, i) => (
              <div key={i} className="bg-gray-800 rounded-xl p-6 border border-gray-700">
                <div className="w-12 h-12 bg-green-500/20 rounded-lg flex items-center justify-center mx-auto mb-4 text-green-400">
                  {icon}
                </div>
                <p className="text-white font-semibold text-sm">{title}</p>
              </div>
            ))}
          </div>
          <span className="inline-block bg-green-500/15 text-green-400 text-sm font-semibold px-5 py-2 rounded-full border border-green-500/30">
            SOC 2 roadmap in progress
          </span>
        </div>
      </section>

      {/* ───────────────── 8. Testimonials ───────────────── */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-bold text-center text-gray-900 mb-4">
            What Our Users Say
          </h2>
          <p className="text-gray-500 text-center mb-14 max-w-xl mx-auto">
            Join thousands of professionals who trust eDocSign.
          </p>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                quote:
                  'I switched from DocuSign and I am saving over $100/year. eDocSign does everything I need for client contracts and proposals.',
                name: 'Alex P.',
                role: 'Freelance Designer',
              },
              {
                quote:
                  'Our team closes deals faster now. Listing agreements and offers get signed the same day. The audit trail gives our clients confidence.',
                name: 'Maria S.',
                role: 'Real Estate Agent',
              },
              {
                quote:
                  'We onboard new hires with offer letters and NDAs through eDocSign. The team plan pays for itself in the first week.',
                name: 'James R.',
                role: 'Small Business Owner',
              },
            ].map(({ quote, name, role }, i) => (
              <div key={i} className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100">
                <div className="flex gap-1 mb-4">
                  {[...Array(5)].map((_, j) => (
                    <svg key={j} className="w-5 h-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                </div>
                <p className="text-gray-600 leading-relaxed mb-6 italic">&ldquo;{quote}&rdquo;</p>
                <div>
                  <p className="font-semibold text-gray-900">{name}</p>
                  <p className="text-sm text-gray-400">{role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ───────────────── 9. Final CTA ───────────────── */}
      <section className="bg-gradient-to-br from-indigo-600 via-indigo-700 to-purple-800 py-20">
        <div className="max-w-4xl mx-auto text-center px-4">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Ready to Save 75% on E-Signatures?
          </h2>
          <p className="text-indigo-100 text-lg mb-10 max-w-2xl mx-auto">
            Start free today. Upgrade only when you need more.
          </p>
          <Link
            to="/register"
            className="inline-block bg-white text-indigo-700 px-10 py-4 rounded-lg text-lg font-bold hover:bg-indigo-50 transition-colors shadow-lg shadow-indigo-900/30"
          >
            Create Free Account
          </Link>
          <p className="text-indigo-200 text-sm mt-6">
            Questions? Contact us at{' '}
            <a href="mailto:support@edocsign.com" className="underline hover:text-white transition-colors">
              support@edocsign.com
            </a>
          </p>
        </div>
      </section>
    </div>
  );
}

export default HomePage;
