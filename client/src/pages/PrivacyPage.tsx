import { Link } from 'react-router-dom';

function PrivacyPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-16">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Privacy Policy</h1>
      <p className="text-gray-500 mb-10">Last updated: April 9, 2026</p>

      <div className="prose prose-gray max-w-none space-y-8">
        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">1. Introduction</h2>
          <p className="text-gray-600 leading-relaxed">
            ProjexLight ("we", "us", "our") operates eDocSign. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our Service.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">2. Information We Collect</h2>
          <h3 className="text-lg font-medium text-gray-800 mb-2">Account Information</h3>
          <ul className="list-disc pl-6 text-gray-600 space-y-1 mb-4">
            <li>Name, email address, and password (hashed)</li>
            <li>OAuth profile data (Google, LinkedIn) if you use social sign-in</li>
            <li>Billing information processed securely through Stripe</li>
          </ul>
          <h3 className="text-lg font-medium text-gray-800 mb-2">Documents and Signatures</h3>
          <ul className="list-disc pl-6 text-gray-600 space-y-1 mb-4">
            <li>Documents you upload for signing</li>
            <li>Electronic signatures (drawn, typed, or uploaded)</li>
            <li>Signing workflow data and audit trails</li>
          </ul>
          <h3 className="text-lg font-medium text-gray-800 mb-2">Usage Data</h3>
          <ul className="list-disc pl-6 text-gray-600 space-y-1">
            <li>IP address, browser type, and device information</li>
            <li>Pages visited and actions taken within the Service</li>
            <li>Timestamps of signing activity for compliance purposes</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">3. How We Use Your Information</h2>
          <ul className="list-disc pl-6 text-gray-600 space-y-2">
            <li>To provide, maintain, and improve the Service</li>
            <li>To process document signing workflows and generate signing certificates</li>
            <li>To send transactional emails (verification codes, signing requests, completion notifications)</li>
            <li>To process payments and manage subscriptions</li>
            <li>To maintain audit trails for legal compliance (E-SIGN Act, UETA)</li>
            <li>To detect and prevent fraud or unauthorized access</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">4. Data Storage and Security</h2>
          <p className="text-gray-600 leading-relaxed">
            Your documents are stored securely on Amazon Web Services (AWS) S3 with server-side encryption. Application data is stored in PostgreSQL databases with encrypted connections. Passwords are hashed using bcrypt. We use HTTPS/TLS for all data in transit.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">5. Third-Party Services</h2>
          <p className="text-gray-600 leading-relaxed mb-3">We use the following third-party services:</p>
          <ul className="list-disc pl-6 text-gray-600 space-y-2">
            <li><strong>Amazon Web Services (AWS)</strong> — document storage and hosting</li>
            <li><strong>Stripe</strong> — payment processing (we never store your card details)</li>
            <li><strong>SendGrid</strong> — transactional email delivery</li>
            <li><strong>Google OAuth / LinkedIn OAuth</strong> — social sign-in (we only receive your name and email)</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">6. Data Sharing</h2>
          <p className="text-gray-600 leading-relaxed">
            We do not sell your personal information. We share data only as necessary to provide the Service (e.g., sending your document to signers you designate), comply with legal obligations, or protect our rights. Document contents are never shared with third parties except the signing participants you specify.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">7. Data Retention</h2>
          <p className="text-gray-600 leading-relaxed">
            We retain your account data for as long as your account is active. Documents and signing certificates are retained for the duration of your subscription. Upon account deletion, we remove your personal data within 30 days, except where retention is required by law.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">8. Your Rights</h2>
          <p className="text-gray-600 leading-relaxed mb-3">You have the right to:</p>
          <ul className="list-disc pl-6 text-gray-600 space-y-2">
            <li>Access your personal data</li>
            <li>Correct inaccurate information</li>
            <li>Request deletion of your account and data</li>
            <li>Export your documents</li>
            <li>Withdraw consent for optional data processing</li>
          </ul>
          <p className="text-gray-600 leading-relaxed mt-3">
            To exercise these rights, contact us at{' '}
            <a href="mailto:support@projexlight.com" className="text-indigo-600 hover:text-indigo-700">support@projexlight.com</a>.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">9. Cookies</h2>
          <p className="text-gray-600 leading-relaxed">
            We use essential cookies and local storage for authentication (JWT tokens). We do not use tracking cookies or third-party analytics cookies.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">10. Children's Privacy</h2>
          <p className="text-gray-600 leading-relaxed">
            The Service is not intended for users under 18 years of age. We do not knowingly collect personal information from children.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">11. Changes to This Policy</h2>
          <p className="text-gray-600 leading-relaxed">
            We may update this Privacy Policy from time to time. We will notify registered users of material changes via email. The updated policy will be effective upon posting.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">12. Contact Us</h2>
          <p className="text-gray-600 leading-relaxed">
            If you have questions or concerns about this Privacy Policy, contact us at{' '}
            <a href="mailto:support@projexlight.com" className="text-indigo-600 hover:text-indigo-700">support@projexlight.com</a>.
          </p>
        </section>
      </div>

      <div className="mt-12 pt-8 border-t border-gray-200 text-center text-sm text-gray-500">
        <Link to="/terms" className="text-indigo-600 hover:text-indigo-700 mr-6">Terms of Service</Link>
        <Link to="/" className="text-indigo-600 hover:text-indigo-700">Back to Home</Link>
      </div>
    </div>
  );
}

export default PrivacyPage;
