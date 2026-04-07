import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Layout from './components/common/Layout';
import HomePage from './pages/HomePage';
import RegisterPage from './pages/RegisterPage';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import UploadPage from './pages/UploadPage';
import DocumentDetailPage from './pages/DocumentDetailPage';
import SignatureRequestPage from './pages/SignatureRequestPage';
import SignaturesPage from './pages/SignaturesPage';
import SignDocumentPage from './pages/SignDocumentPage';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Layout>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/upload" element={<UploadPage />} />
            <Route path="/documents/:id" element={<DocumentDetailPage />} />
            <Route path="/signatures/request/:documentId" element={<SignatureRequestPage />} />
            <Route path="/signatures" element={<SignaturesPage />} />
            <Route path="/sign/:signatureId" element={<SignDocumentPage />} />
          </Routes>
        </Layout>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
