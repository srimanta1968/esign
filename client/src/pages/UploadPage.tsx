import { useState, FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ApiService } from '../services/api';

function UploadPage() {
  const [filePath, setFilePath] = useState<string>('');
  const [originalName, setOriginalName] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await ApiService.post('/documents', { file_path: filePath, original_name: originalName });
      if (response.success) {
        navigate('/dashboard');
      } else {
        setError(response.error || 'Upload failed');
      }
    } catch {
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Upload Document</h2>

      {error && <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg mb-6 text-sm">{error}</div>}

      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm p-6 space-y-4">
        <div>
          <label htmlFor="filePath" className="block text-sm font-medium text-gray-700 mb-1">File Path</label>
          <input
            id="filePath"
            type="text"
            value={filePath}
            onChange={(e) => setFilePath(e.target.value)}
            required
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
            placeholder="/documents/contract.pdf"
          />
        </div>

        <div>
          <label htmlFor="originalName" className="block text-sm font-medium text-gray-700 mb-1">Document Name</label>
          <input
            id="originalName"
            type="text"
            value={originalName}
            onChange={(e) => setOriginalName(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
            placeholder="Contract Agreement"
          />
        </div>

        <div className="flex gap-4">
          <button type="submit" disabled={loading} className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50">
            {loading ? 'Uploading...' : 'Upload Document'}
          </button>
          <Link to="/dashboard" className="px-6 py-2 text-gray-600 hover:text-gray-800 font-medium">Cancel</Link>
        </div>
      </form>
    </div>
  );
}

export default UploadPage;
