import { useState, useRef, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ApiService } from '../services/api';
import SignaturePadComponent from '../components/SignaturePadComponent';

const SIGNATURE_FONTS = [
  { name: 'Dancing Script', style: "'Dancing Script', cursive" },
  { name: 'Great Vibes', style: "'Great Vibes', cursive" },
  { name: 'Pacifico', style: "'Pacifico', cursive" },
  { name: 'Caveat', style: "'Caveat', cursive" },
  { name: 'Sacramento', style: "'Sacramento', cursive" },
  { name: 'Homemade Apple', style: "'Homemade Apple', cursive" },
];

// Google Fonts URL for signature fonts
const FONTS_URL = 'https://fonts.googleapis.com/css2?family=Dancing+Script&family=Great+Vibes&family=Pacifico&family=Caveat&family=Sacramento&family=Homemade+Apple&display=swap';

type Tab = 'draw' | 'type' | 'upload';

function SignatureCreatorPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>('draw');
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  const [saving, setSaving] = useState<boolean>(false);

  // Type tab state
  const [typedText, setTypedText] = useState<string>('');
  const [selectedFont, setSelectedFont] = useState<string>(SIGNATURE_FONTS[0].style);
  const typedCanvasRef = useRef<HTMLCanvasElement>(null);

  // Upload tab state
  const [uploadPreview, setUploadPreview] = useState<string>('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load Google Fonts
  useEffect(() => {
    if (!document.querySelector(`link[href="${FONTS_URL}"]`)) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = FONTS_URL;
      document.head.appendChild(link);
    }
  }, []);

  // Render typed signature to canvas for preview
  useEffect(() => {
    const canvas = typedCanvasRef.current;
    if (!canvas || !typedText) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvas.offsetWidth * dpr;
    canvas.height = 120 * dpr;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, canvas.offsetWidth, 120);
    ctx.fillStyle = '#1e3a5f';
    ctx.font = `36px ${selectedFont}`;
    ctx.textBaseline = 'middle';
    ctx.fillText(typedText, 20, 60);
  }, [typedText, selectedFont]);

  const generateTypedDataUrl = (): string => {
    const canvas = document.createElement('canvas');
    canvas.width = 400;
    canvas.height = 120;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    ctx.fillStyle = 'transparent';
    ctx.clearRect(0, 0, 400, 120);
    ctx.fillStyle = '#1e3a5f';
    ctx.font = `36px ${selectedFont}`;
    ctx.textBaseline = 'middle';
    ctx.fillText(typedText, 20, 60);
    return canvas.toDataURL('image/png');
  };

  const handleDrawSave = async (dataUrl: string): Promise<void> => {
    await saveSignature('drawn', dataUrl);
  };

  const handleTypeSave = async (): Promise<void> => {
    if (!typedText.trim()) {
      setError('Please type your signature');
      return;
    }
    const dataUrl = generateTypedDataUrl();
    await saveSignature('typed', dataUrl, selectedFont);
  };

  const handleUploadSave = async (): Promise<void> => {
    if (!uploadFile) {
      setError('Please upload an image');
      return;
    }
    await saveSignature('uploaded', uploadPreview);
  };

  const saveSignature = async (type: string, dataUrl: string, fontFamily?: string): Promise<void> => {
    setError('');
    setSuccess('');
    setSaving(true);
    try {
      const body: Record<string, string> = {
        signature_type: type,
        signature_data: dataUrl,
      };
      if (fontFamily) body.font_family = fontFamily;
      const response = await ApiService.post('/user-signatures', body);
      if (response.success) {
        setSuccess('Signature saved successfully!');
        setTimeout(() => navigate('/signatures'), 1500);
      } else {
        setError(response.error || 'Failed to save signature');
      }
    } catch {
      setError('An unexpected error occurred');
    } finally {
      setSaving(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    setUploadError('');
    const file = e.target.files?.[0];
    if (!file) return;

    if (!['image/png', 'image/jpeg'].includes(file.type)) {
      setUploadError('Please upload a PNG or JPEG image');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setUploadError('File size must be under 2MB');
      return;
    }

    setUploadFile(file);
    const reader = new FileReader();
    reader.onload = () => {
      setUploadPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const tabClass = (tab: Tab): string =>
    `px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
      activeTab === tab
        ? 'bg-indigo-600 text-white'
        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
    }`;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Create Signature</h2>
        <Link to="/signatures" className="text-gray-500 hover:text-gray-700 text-sm font-medium">
          Back to Signatures
        </Link>
      </div>

      {error && <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg mb-6 text-sm">{error}</div>}
      {success && <div className="bg-green-50 text-green-600 px-4 py-3 rounded-lg mb-6 text-sm">{success}</div>}

      <div className="bg-white rounded-xl shadow-sm p-6">
        {/* Tabs */}
        <div className="flex gap-3 mb-6">
          <button onClick={() => setActiveTab('draw')} className={tabClass('draw')}>
            Draw
          </button>
          <button onClick={() => setActiveTab('type')} className={tabClass('type')}>
            Type
          </button>
          <button onClick={() => setActiveTab('upload')} className={tabClass('upload')}>
            Upload
          </button>
        </div>

        {/* Draw Tab */}
        {activeTab === 'draw' && (
          <div>
            <p className="text-sm text-gray-600 mb-3">Draw your signature using mouse, touch, or stylus:</p>
            <SignaturePadComponent onSave={handleDrawSave} height={200} />
            {saving && <p className="text-sm text-gray-500 mt-2">Saving...</p>}
          </div>
        )}

        {/* Type Tab */}
        {activeTab === 'type' && (
          <div>
            <p className="text-sm text-gray-600 mb-3">Type your name and choose a signature font:</p>
            <input
              type="text"
              value={typedText}
              onChange={(e) => setTypedText(e.target.value)}
              placeholder="Type your full name"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none mb-4"
            />

            {/* Font picker */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4">
              {SIGNATURE_FONTS.map((font) => (
                <button
                  key={font.name}
                  type="button"
                  onClick={() => setSelectedFont(font.style)}
                  className={`p-3 border rounded-lg text-left transition-colors ${
                    selectedFont === font.style
                      ? 'border-indigo-600 bg-indigo-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <span
                    className="text-lg text-gray-800 block truncate"
                    style={{ fontFamily: font.style }}
                  >
                    {typedText || font.name}
                  </span>
                  <span className="text-xs text-gray-400 mt-1 block">{font.name}</span>
                </button>
              ))}
            </div>

            {/* Preview */}
            {typedText && (
              <div className="mb-4">
                <p className="text-sm text-gray-500 mb-2">Preview:</p>
                <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                  <canvas
                    ref={typedCanvasRef}
                    className="w-full"
                    style={{ height: '120px' }}
                  />
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={handleTypeSave}
              disabled={saving || !typedText.trim()}
              className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Typed Signature'}
            </button>
          </div>
        )}

        {/* Upload Tab */}
        {activeTab === 'upload' && (
          <div>
            <p className="text-sm text-gray-600 mb-3">Upload a signature image (PNG or JPEG, max 2MB):</p>

            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-indigo-400 transition-colors mb-4"
            >
              {uploadPreview ? (
                <img
                  src={uploadPreview}
                  alt="Signature preview"
                  className="max-h-32 mx-auto object-contain"
                />
              ) : (
                <div>
                  <svg className="w-10 h-10 text-gray-300 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <p className="text-sm text-gray-500">Click to upload or drag and drop</p>
                  <p className="text-xs text-gray-400 mt-1">PNG, JPEG up to 2MB</p>
                </div>
              )}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg"
              onChange={handleFileChange}
              className="hidden"
            />

            {uploadError && (
              <p className="text-red-500 text-sm mb-3">{uploadError}</p>
            )}

            {uploadPreview && (
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handleUploadSave}
                  disabled={saving}
                  className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save Uploaded Signature'}
                </button>
                <button
                  type="button"
                  onClick={() => { setUploadPreview(''); setUploadFile(null); }}
                  className="text-gray-500 hover:text-gray-700 text-sm font-medium px-4 py-2"
                >
                  Remove
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default SignatureCreatorPage;
