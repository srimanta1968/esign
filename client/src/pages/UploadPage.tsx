import { useState, useRef, FormEvent, ChangeEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ApiService } from '../services/api';

function UploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [uploadSuccess, setUploadSuccess] = useState<boolean>(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const allowedTypes: string[] = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/png',
    'image/jpeg',
  ];

  const getFileIcon = (type: string): JSX.Element => {
    if (type === 'application/pdf') {
      return (
        <svg className="w-12 h-12 text-red-500 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
          <text x="8" y="17" fontSize="6" fill="currentColor" fontWeight="bold">PDF</text>
        </svg>
      );
    }
    if (type.includes('word') || type.includes('document')) {
      return (
        <svg className="w-12 h-12 text-blue-500 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 13h6m-6 3h4" />
        </svg>
      );
    }
    if (type.includes('image')) {
      return (
        <svg className="w-12 h-12 text-purple-500 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      );
    }
    return (
      <svg className="w-12 h-12 text-gray-500 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    );
  };

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
      setUploadSuccess(false);
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
      setUploadSuccess(false);
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
    setProgress(0);

    try {
      const formData: FormData = new FormData();
      formData.append('file', file);

      const data = await ApiService.upload('/documents', formData, (percent) => {
        setProgress(percent);
      });

      if (data.success) {
        setUploadSuccess(true);
        setProgress(100);
        setTimeout(() => navigate('/dashboard'), 2000);
      } else {
        setError(data.error || 'Upload failed');
        setProgress(0);
      }
    } catch {
      setError('An unexpected error occurred');
      setProgress(0);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveFile = (): void => {
    setShowDeleteConfirm(true);
  };

  const confirmRemoveFile = (): void => {
    setFile(null);
    setProgress(0);
    setUploadSuccess(false);
    setShowDeleteConfirm(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
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

      {uploadSuccess && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-6 text-sm flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Document uploaded successfully! Redirecting to dashboard...
        </div>
      )}

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
              {getFileIcon(file.type)}
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

        {/* Upload Progress Bar */}
        {loading && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Uploading...</span>
              <span className="text-gray-900 font-medium">{progress}%</span>
            </div>
            <div className="h-2 w-full bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-indigo-600 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        <div className="flex gap-4">
          <button
            type="submit"
            disabled={loading || !file || uploadSuccess}
            className="bg-indigo-600 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50"
          >
            {loading ? 'Uploading...' : 'Upload Document'}
          </button>
          {file && !loading && (
            <button
              type="button"
              onClick={handleRemoveFile}
              className="px-6 py-2.5 text-red-600 hover:text-red-700 font-medium"
            >
              Remove File
            </button>
          )}
          <Link to="/dashboard" className="px-6 py-2.5 text-gray-600 hover:text-gray-800 font-medium">Cancel</Link>
        </div>
      </form>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Remove File?</h3>
            <p className="text-gray-500 text-sm mb-6">Are you sure you want to remove the selected file?</p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 font-medium text-sm"
              >
                Cancel
              </button>
              <button
                onClick={confirmRemoveFile}
                className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-700 transition-colors"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default UploadPage;
