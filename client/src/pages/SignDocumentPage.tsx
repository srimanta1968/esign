import { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ApiService } from '../services/api';

interface UserSignature {
  id: string;
  user_id: string;
  signature_type: string;
}

function SignDocumentPage() {
  const { signatureId } = useParams<{ signatureId: string }>();
  const navigate = useNavigate();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState<boolean>(false);
  const [savedSignatures, setSavedSignatures] = useState<UserSignature[]>([]);
  const [selectedSignatureId, setSelectedSignatureId] = useState<string>('');
  const [mode, setMode] = useState<'draw' | 'saved'>('draw');
  const [signing, setSigning] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');

  useEffect(() => {
    const fetchSavedSignatures = async (): Promise<void> => {
      try {
        const response = await ApiService.get<{ userSignatures: UserSignature[] }>('/user-signatures');
        if (response.success && response.data) {
          setSavedSignatures(response.data.userSignatures);
        }
      } catch {
        console.error('Failed to fetch saved signatures');
      }
    };

    fetchSavedSignatures();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx: CanvasRenderingContext2D | null = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = canvas.offsetWidth;
    canvas.height = 200;
    ctx.strokeStyle = '#1e3a5f';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
  }, []);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>): void => {
    setIsDrawing(true);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx: CanvasRenderingContext2D | null = canvas.getContext('2d');
    if (!ctx) return;

    const rect: DOMRect = canvas.getBoundingClientRect();
    const clientX: number = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY: number = 'touches' in e ? e.touches[0].clientY : e.clientY;
    ctx.beginPath();
    ctx.moveTo(clientX - rect.left, clientY - rect.top);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>): void => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx: CanvasRenderingContext2D | null = canvas.getContext('2d');
    if (!ctx) return;

    const rect: DOMRect = canvas.getBoundingClientRect();
    const clientX: number = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY: number = 'touches' in e ? e.touches[0].clientY : e.clientY;
    ctx.lineTo(clientX - rect.left, clientY - rect.top);
    ctx.stroke();
  };

  const stopDrawing = (): void => {
    setIsDrawing(false);
  };

  const clearCanvas = (): void => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx: CanvasRenderingContext2D | null = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const handleSign = async (): Promise<void> => {
    setError('');
    setSuccess('');
    setSigning(true);

    try {
      const response = await ApiService.request(`/signatures/${signatureId}/sign`, {
        method: 'PATCH',
        body: JSON.stringify({ user_signature_id: selectedSignatureId || null }),
      });

      if (response.success) {
        setSuccess('Document signed successfully!');
        setTimeout(() => navigate('/dashboard'), 1500);
      } else {
        setError(response.error || 'Failed to sign document');
      }
    } catch {
      setError('An unexpected error occurred');
    } finally {
      setSigning(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Sign Document</h2>

      {error && <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg mb-6 text-sm">{error}</div>}
      {success && <div className="bg-green-50 text-green-600 px-4 py-3 rounded-lg mb-6 text-sm">{success}</div>}

      <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
        <div className="flex gap-4 mb-6">
          <button
            onClick={() => setMode('draw')}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${mode === 'draw' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
          >
            Draw Signature
          </button>
          <button
            onClick={() => setMode('saved')}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${mode === 'saved' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
          >
            Use Saved Signature
          </button>
        </div>

        {mode === 'draw' ? (
          <div>
            <p className="text-sm text-gray-600 mb-2">Draw your signature below (mouse, touch, or stylus):</p>
            <canvas
              ref={canvasRef}
              className="w-full border-2 border-dashed border-gray-300 rounded-lg cursor-crosshair bg-white"
              style={{ touchAction: 'none' }}
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              onTouchStart={startDrawing}
              onTouchMove={draw}
              onTouchEnd={stopDrawing}
            />
            <button onClick={clearCanvas} className="mt-2 text-sm text-gray-500 hover:text-gray-700">
              Clear
            </button>
          </div>
        ) : (
          <div>
            {savedSignatures.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500 mb-4">No saved signatures found.</p>
                <Link to="/signatures" className="text-indigo-600 font-medium hover:text-indigo-700">Create a signature first</Link>
              </div>
            ) : (
              <div className="space-y-2">
                {savedSignatures.map((sig: UserSignature) => (
                  <label
                    key={sig.id}
                    className={`flex items-center p-4 border rounded-lg cursor-pointer transition-colors ${selectedSignatureId === sig.id ? 'border-indigo-600 bg-indigo-50' : 'border-gray-200 hover:border-gray-300'}`}
                  >
                    <input
                      type="radio"
                      name="signature"
                      value={sig.id}
                      checked={selectedSignatureId === sig.id}
                      onChange={() => setSelectedSignatureId(sig.id)}
                      className="mr-3"
                    />
                    <span className="font-medium text-gray-900">{sig.signature_type}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex gap-4">
        <button
          onClick={handleSign}
          disabled={signing}
          className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50"
        >
          {signing ? 'Signing...' : 'Apply Signature'}
        </button>
        <Link to="/dashboard" className="px-6 py-2 text-gray-600 hover:text-gray-800 font-medium">Cancel</Link>
      </div>
    </div>
  );
}

export default SignDocumentPage;
