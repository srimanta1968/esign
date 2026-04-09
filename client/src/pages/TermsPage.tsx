import { Link } from 'react-router-dom';

function TermsPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-16">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Terms of Service</h1>
      <p className="text-gray-500 mb-10">Last updated: April 9, 2026</p>

      <div className="prose prose-gray max-w-none space-y-8">
        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">1. Acceptance of Terms</h2>
          <p className="text-gray-600 leading-relaxed">
            By accessing or using eDocSign ("Service"), operated by ProjexLight, you agree to be bound by these Terms of Service. If you do not agree, you may not use the Service.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">2. Description of Service</h2>
          <p className="text-gray-600 leading-relaxed">
            eDocSign provides electronic document signing, management, workflow automation, and compliance tools. The Service allows users to upload documents, create signing workflows, collect electronic signatures, and generate signing certificates.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">3. Account Registration</h2>
          <p className="text-gray-600 leading-relaxed">
            You must provide accurate, complete information when creating an account. You are responsible for maintaining the security of your account credentials and for all activity under your account. You must notify us immediately of any unauthorized access.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">4. Electronic Signatures</h2>
          <p className="text-gray-600 leading-relaxed">
            Electronic signatures created through eDocSign are intended to comply with the U.S. Electronic Signatures in Global and National Commerce Act (E-SIGN Act) and the Uniform Electronic Transactions Act (UETA). By using the Service, you consent to conducting transactions electronically and acknowledge that electronic signatures carry the same legal weight as handwritten signatures.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">5. User Responsibilities</h2>
          <ul className="list-disc pl-6 text-gray-600 space-y-2">
            <li>You must not upload documents containing malware, illegal content, or content that infringes on third-party rights.</li>
            <li>You are responsible for obtaining proper authorization before requesting signatures from others.</li>
            <li>You must not use the Service for fraudulent purposes or to forge signatures.</li>
            <li>You must comply with all applicable laws and regulations in your jurisdiction.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">6. Subscription Plans and Billing</h2>
          <p className="text-gray-600 leading-relaxed">
            Paid plans are billed in advance on a monthly or annual basis. You may cancel at any time; access continues until the end of your current billing period. Refunds are not provided for partial billing periods. Free plan usage is subject to document limits as described on our pricing page.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">7. Data Storage and Security</h2>
          <p className="text-gray-600 leading-relaxed">
            Documents are stored securely using industry-standard encryption. We use AWS S3 for document storage and PostgreSQL for data. While we implement reasonable security measures, no system is completely secure, and we cannot guarantee absolute security of your data.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">8. Intellectual Property</h2>
          <p className="text-gray-600 leading-relaxed">
            You retain all rights to documents you upload. By using the Service, you grant us a limited license to process, store, and transmit your documents solely for the purpose of providing the Service. We do not claim ownership of your content.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">9. Limitation of Liability</h2>
          <p className="text-gray-600 leading-relaxed">
            To the maximum extent permitted by law, eDocSign and ProjexLight shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of the Service. Our total liability shall not exceed the amount paid by you in the 12 months preceding the claim.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">10. Termination</h2>
          <p className="text-gray-600 leading-relaxed">
            We may suspend or terminate your account if you violate these Terms. Upon termination, your right to use the Service ceases immediately. We may retain your data for a reasonable period to comply with legal obligations.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">11. Changes to Terms</h2>
          <p className="text-gray-600 leading-relaxed">
            We may update these Terms from time to time. We will notify registered users of material changes via email. Continued use of the Service after changes constitutes acceptance of the updated Terms.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">12. Contact</h2>
          <p className="text-gray-600 leading-relaxed">
            For questions about these Terms, contact us at{' '}
            <a href="mailto:support@projexlight.com" className="text-indigo-600 hover:text-indigo-700">support@projexlight.com</a>.
          </p>
        </section>
      </div>

      <div className="mt-12 pt-8 border-t border-gray-200 text-center text-sm text-gray-500">
        <Link to="/privacy" className="text-indigo-600 hover:text-indigo-700 mr-6">Privacy Policy</Link>
        <Link to="/" className="text-indigo-600 hover:text-indigo-700">Back to Home</Link>
      </div>
    </div>
  );
}

export default TermsPage;
