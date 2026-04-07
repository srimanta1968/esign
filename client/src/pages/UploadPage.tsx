import { useState, useRef, FormEvent, ChangeEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ApiService } from '../services/api';

function UploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const allowedTypes: string[] = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/png',
    'image/jpeg',
  ];

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>): void => {
    const selected: File | undefined = e.target.files?.[0];
    if (selected) {
      if (!allowedTypes.includes(selected.type)) {
        setError('Invalid file type. Allowed: PDF, DOC, DOCX, PNG, JPEG');
        setFile(null);
        return;
      }
      setError('');
      setFile(selected);
    }
  };

  const handleDrag = (e: React.DragEvent<HTMLDivElement>): void => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>): void => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const dropped: File | undefined = e.dataTransfer.files?.[0];
    if (dropped) {
      if (!allowedTypes.includes(dropped.type)) {
        setError('Invalid file type. Allowed: PDF, DOC, DOCX, PNG, JPEG');
        setFile(null);
        return;
      }
      setError('');
      setFile(dropped);
    }
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    setError('');

    if (!file) {
      setError('Please select a file to upload');
      return;
    }

    setLoading(true);

    try {
      const formData: FormData = new FormData();
      formData.append('file', file);

      const token: string | null = ApiService.getToken();
      const response = await fetch('/api/documents', {
        method: 'POST',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
        body: formData,
      });

      const data = await response.json();

      if (data.success) {
        navigate('/dashboard');
      } else {
        setError(data.error || 'Upload failed');
      }
    } catch {
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Upload Document</h2>

      {error && <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg mb-6 text-sm">{error}</div>}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Drag & Drop Zone */}
        <div
          className={`border-2 border-dashed rounded-xl p-10 text-center transition-colors cursor-pointer ${
            dragActive
              ? 'border-indigo-500 bg-indigo-50'
              : file
              ? 'border-green-400 bg-green-50'
              : 'border-gray-300 bg-white hover:border-indigo-400 hover:bg-gray-50'
          }`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileChange}
            accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
            className="hidden"
          />

          {file ? (
            <div>
              <svg className="w-12 h-12 text-green-500 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="font-medium text-gray-900">{file.name}</p>
              <p className="text-sm text-gray-500 mt-1">{formatFileSize(file.size)}</p>
              <p className="text-xs text-indigo-600 mt-2">Click or drag to replace</p>
            </div>
          ) : (
            <div>
              <svg className="w-12 h-12 text-gray-400 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <p className="font-medium text-gray-700">Drag & drop your document here</p>
              <p className="text-sm text-gray-500 mt-1">or click to browse from your computer</p>
              <p className="text-xs text-gray-400 mt-3">PDF, DOC, DOCX, PNG, JPEG up to 50MB</p>
            </div>
          )}
        </div>

        <div className="flex gap-4">
          <button
            type="submit"
            disabled={loading || !file}
            className="bg-indigo-600 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50"
          >
            {loading ? 'Uploading...' : 'Upload Document'}
          </button>
          <Link to="/dashboard" className="px-6 py-2.5 text-gray-600 hover:text-gray-800 font-medium">Cancel</Link>
        </div>
      </form>
    </div>
  );
}

export default UploadPage;
