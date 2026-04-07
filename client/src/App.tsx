import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import HomePage from './pages/HomePage';
import RegisterPage from './pages/RegisterPage';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import UploadPage from './pages/UploadPage';
import SignatureRequestPage from './pages/SignatureRequestPage';
import SignaturesPage from './pages/SignaturesPage';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/upload" element={<UploadPage />} />
          <Route path="/signatures/request/:documentId" element={<SignatureRequestPage />} />
          <Route path="/signatures" element={<SignaturesPage />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
