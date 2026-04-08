import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Layout from './components/common/Layout';
import HomePage from './pages/HomePage';
import RegisterPage from './pages/RegisterPage';
import LoginPage from './pages/LoginPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import DashboardPage from './pages/DashboardPage';
import UploadPage from './pages/UploadPage';
import DocumentDetailPage from './pages/DocumentDetailPage';
import DocumentSearchPage from './pages/DocumentSearchPage';
import SignatureRequestPage from './pages/SignatureRequestPage';
import SignaturesPage from './pages/SignaturesPage';
import SignDocumentPage from './pages/SignDocumentPage';
import ProfilePage from './pages/ProfilePage';
import AdminUsersPage from './pages/AdminUsersPage';
import TemplatesPage from './pages/TemplatesPage';
import AuditLogPage from './pages/AuditLogPage';
import ComplianceDashboardPage from './pages/ComplianceDashboardPage';
import NotificationPreferencesPage from './pages/NotificationPreferencesPage';
import WorkflowCreatePage from './pages/WorkflowCreatePage';
import WorkflowDetailPage from './pages/WorkflowDetailPage';
import SignatureCreatorPage from './pages/SignatureCreatorPage';
import SignatureConfirmPage from './pages/SignatureConfirmPage';
import PublicSignPage from './pages/PublicSignPage';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public signing page - NO Layout wrapper */}
          <Route path="/sign-document/:token" element={<PublicSignPage />} />

          {/* All other routes wrapped in Layout */}
          <Route
            path="*"
            element={
              <Layout>
                <Routes>
                  <Route path="/" element={<HomePage />} />
                  <Route path="/register" element={<RegisterPage />} />
                  <Route path="/login" element={<LoginPage />} />
                  <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                  <Route path="/reset-password" element={<ResetPasswordPage />} />
                  <Route path="/dashboard" element={<DashboardPage />} />
                  <Route path="/upload" element={<UploadPage />} />
                  <Route path="/documents/:id" element={<DocumentDetailPage />} />
                  <Route path="/documents/search" element={<DocumentSearchPage />} />
                  <Route path="/templates" element={<TemplatesPage />} />
                  <Route path="/profile" element={<ProfilePage />} />
                  <Route path="/admin/users" element={<AdminUsersPage />} />
                  <Route path="/signatures/request/:documentId" element={<SignatureRequestPage />} />
                  <Route path="/signatures" element={<SignaturesPage />} />
                  <Route path="/sign/:signatureId" element={<SignDocumentPage />} />
                  <Route path="/sign/:signatureId/confirm" element={<SignatureConfirmPage />} />
                  <Route path="/signatures/create" element={<SignatureCreatorPage />} />
                  <Route path="/workflows/create" element={<WorkflowCreatePage />} />
                  <Route path="/workflows/:id" element={<WorkflowDetailPage />} />
                  <Route path="/admin/audit-logs" element={<AuditLogPage />} />
                  <Route path="/admin/compliance" element={<ComplianceDashboardPage />} />
                  <Route path="/settings/notifications" element={<NotificationPreferencesPage />} />
                </Routes>
              </Layout>
            }
          />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
