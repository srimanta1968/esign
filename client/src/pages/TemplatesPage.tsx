import { useState, useEffect, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApiService } from '../services/api';

interface Template {
  id: string;
  name: string;
  description: string;
  source_document_id: string;
  source_document_name?: string;
  created_at: string;
}

interface Document {
  id: string;
  original_name: string;
  file_path: string;
}

function TemplatesPage() {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [showCreateForm, setShowCreateForm] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  const [creating, setCreating] = useState<boolean>(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [usingId, setUsingId] = useState<string | null>(null);

  // Create form state
  const [formName, setFormName] = useState<string>('');
  const [formDescription, setFormDescription] = useState<string>('');
  const [formDocumentId, setFormDocumentId] = useState<string>('');

  useEffect(() => {
    const fetchData = async (): Promise<void> => {
      try {
        const [templatesRes, docsRes] = await Promise.all([
          ApiService.get<{ templates: Template[] }>('/templates'),
          ApiService.get<{ documents: Document[] }>('/documents'),
        ]);

        if (templatesRes.success && templatesRes.data) {
          setTemplates(templatesRes.data.templates);
        }
        if (docsRes.success && docsRes.data) {
          setDocuments(docsRes.data.documents);
        }
      } catch {
        setError('Failed to load templates');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleCreate = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    if (!formName.trim()) {
      setError('Template name is required');
      return;
    }
    if (!formDocumentId) {
      setError('Please select a source document');
      return;
    }

    setCreating(true);
    setError('');

    try {
      const response = await ApiService.post<{ template: Template }>('/templates', {
        name: formName,
        description: formDescription,
        document_id: formDocumentId,
      });

      if (response.success && response.data) {
        setTemplates((prev) => [response.data!.template, ...prev]);
        setFormName('');
        setFormDescription('');
        setFormDocumentId('');
        setShowCreateForm(false);
        setSuccess('Template created successfully');
        setTimeout(() => setSuccess(''), 3000);
      } else {
        setError(response.error || 'Failed to create template');
      }
    } catch {
      setError('Failed to create template');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (templateId: string): Promise<void> => {
    if (!window.confirm('Are you sure you want to delete this template?')) return;
    setDeletingId(templateId);

    try {
      const response = await ApiService.delete(`/templates/${templateId}`);
      if (response.success) {
        setTemplates((prev) => prev.filter((t) => t.id !== templateId));
      } else {
        setError(response.error || 'Failed to delete template');
      }
    } catch {
      setError('Failed to delete template');
    } finally {
      setDeletingId(null);
    }
  };

  const handleUseTemplate = async (templateId: string): Promise<void> => {
    setUsingId(templateId);

    try {
      const response = await ApiService.post<{ document: { id: string } }>(`/templates/${templateId}/use`, {});
      if (response.success && response.data) {
        navigate(`/documents/${response.data.document.id}`);
      } else {
        setError(response.error || 'Failed to create document from template');
      }
    } catch {
      setError('Failed to create document from template');
    } finally {
      setUsingId(null);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Document Templates</h1>
          <p className="text-gray-500 text-sm mt-1">Create and manage reusable document templates</p>
        </div>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="bg-indigo-600 text-white px-4 py-2.5 rounded-lg font-medium hover:bg-indigo-700 transition-colors text-sm"
        >
          {showCreateForm ? 'Cancel' : 'Create Template'}
        </button>
      </div>

      {error && <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg mb-6 text-sm">{error}</div>}
      {success && <div className="bg-green-50 text-green-600 px-4 py-3 rounded-lg mb-6 text-sm">{success}</div>}

      {/* Create Template Form */}
      {showCreateForm && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Create New Template</h2>
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label htmlFor="templateName" className="block text-sm font-medium text-gray-700 mb-1">Template Name</label>
              <input id="templateName" type="text" value={formName} onChange={(e) => setFormName(e.target.value)} required
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-shadow"
                placeholder="e.g., NDA Agreement" />
            </div>
            <div>
              <label htmlFor="templateDescription" className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea id="templateDescription" value={formDescription} onChange={(e) => setFormDescription(e.target.value)} rows={3}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-shadow resize-none"
                placeholder="Describe what this template is for..." />
            </div>
            <div>
              <label htmlFor="sourceDocument" className="block text-sm font-medium text-gray-700 mb-1">Source Document</label>
              <select id="sourceDocument" value={formDocumentId} onChange={(e) => setFormDocumentId(e.target.value)} required
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none">
                <option value="">Select a document...</option>
                {documents.map((doc) => (
                  <option key={doc.id} value={doc.id}>{doc.original_name || doc.file_path}</option>
                ))}
              </select>
            </div>
            <button type="submit" disabled={creating}
              className="bg-indigo-600 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50">
              {creating ? 'Creating...' : 'Create Template'}
            </button>
          </form>
        </div>
      )}

      {/* Templates List */}
      {loading ? (
        <div className="bg-white rounded-xl shadow-sm p-12 text-center">
          <p className="text-gray-500">Loading templates...</p>
        </div>
      ) : templates.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
          <svg className="w-12 h-12 text-gray-300 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
          </svg>
          <p className="text-gray-500 mb-4">No templates yet.</p>
          <button onClick={() => setShowCreateForm(true)} className="text-indigo-600 font-medium hover:text-indigo-700">
            Create your first template
          </button>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((template) => (
            <div key={template.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 flex flex-col">
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900 mb-1">{template.name}</h3>
                {template.description && (
                  <p className="text-sm text-gray-500 mb-3 line-clamp-2">{template.description}</p>
                )}
                <p className="text-xs text-gray-400">
                  Created {new Date(template.created_at).toLocaleDateString()}
                </p>
                {template.source_document_name && (
                  <p className="text-xs text-gray-400 mt-1">Source: {template.source_document_name}</p>
                )}
              </div>
              <div className="flex gap-2 mt-4 pt-4 border-t border-gray-100">
                <button
                  onClick={() => handleUseTemplate(template.id)}
                  disabled={usingId === template.id}
                  className="flex-1 bg-indigo-600 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50"
                >
                  {usingId === template.id ? 'Creating...' : 'Use Template'}
                </button>
                <button
                  onClick={() => handleDelete(template.id)}
                  disabled={deletingId === template.id}
                  className="px-3 py-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                >
                  {deletingId === template.id ? '...' : 'Delete'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default TemplatesPage;
