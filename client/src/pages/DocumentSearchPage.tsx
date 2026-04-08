import { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { ApiService } from '../services/api';

interface Document {
  id: string;
  user_id: string;
  file_path: string;
  original_name: string;
  uploaded_at: string;
  file_size?: number;
  file_type?: string;
  tags?: string[];
}

interface SearchSuggestion {
  text: string;
  type: 'document' | 'tag';
}

function DocumentSearchPage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [filteredDocs, setFilteredDocs] = useState<Document[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState<boolean>(false);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [fileType, setFileType] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('date_desc');
  const [showFilters, setShowFilters] = useState<boolean>(false);
  const [editingTagDocId, setEditingTagDocId] = useState<string | null>(null);
  const [newTag, setNewTag] = useState<string>('');
  const searchRef = useRef<HTMLDivElement>(null);

  const allTags: string[] = Array.from(new Set(documents.flatMap((d) => d.tags || [])));

  useEffect(() => {
    const fetchDocuments = async (): Promise<void> => {
      try {
        const response = await ApiService.get<{ documents: Document[] }>('/documents');
        if (response.success && response.data) {
          setDocuments(response.data.documents);
        }
      } catch {
        console.error('Failed to fetch documents');
      } finally {
        setLoading(false);
      }
    };

    fetchDocuments();
  }, []);

  // Click outside to close suggestions
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent): void => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    window.document.addEventListener('mousedown', handleClickOutside);
    return () => window.document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter and sort
  const applyFilters = useCallback((): void => {
    let result = [...documents];

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((d) =>
        (d.original_name || d.file_path).toLowerCase().includes(q) ||
        d.tags?.some((t) => t.toLowerCase().includes(q))
      );
    }

    // Tags filter
    if (selectedTags.length > 0) {
      result = result.filter((d) =>
        selectedTags.every((tag) => d.tags?.includes(tag))
      );
    }

    // Date range
    if (dateFrom) {
      result = result.filter((d) => new Date(d.uploaded_at) >= new Date(dateFrom));
    }
    if (dateTo) {
      const to = new Date(dateTo);
      to.setDate(to.getDate() + 1);
      result = result.filter((d) => new Date(d.uploaded_at) < to);
    }

    // File type
    if (fileType !== 'all') {
      result = result.filter((d) => {
        const name = (d.original_name || d.file_path).toLowerCase();
        switch (fileType) {
          case 'pdf': return name.endsWith('.pdf');
          case 'doc': return name.endsWith('.doc') || name.endsWith('.docx');
          case 'image': return name.endsWith('.png') || name.endsWith('.jpg') || name.endsWith('.jpeg');
          default: return true;
        }
      });
    }

    // Sort
    result.sort((a, b) => {
      switch (sortBy) {
        case 'date_asc':
          return new Date(a.uploaded_at).getTime() - new Date(b.uploaded_at).getTime();
        case 'date_desc':
          return new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime();
        case 'name_asc':
          return (a.original_name || a.file_path).localeCompare(b.original_name || b.file_path);
        case 'name_desc':
          return (b.original_name || b.file_path).localeCompare(a.original_name || a.file_path);
        case 'size_asc':
          return (a.file_size || 0) - (b.file_size || 0);
        case 'size_desc':
          return (b.file_size || 0) - (a.file_size || 0);
        default:
          return 0;
      }
    });

    setFilteredDocs(result);
  }, [documents, searchQuery, selectedTags, dateFrom, dateTo, fileType, sortBy]);

  useEffect(() => {
    applyFilters();
  }, [applyFilters]);

  // Autocomplete suggestions
  const handleSearchInput = (value: string): void => {
    setSearchQuery(value);
    if (value.trim().length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    const q = value.toLowerCase();
    const docSuggestions: SearchSuggestion[] = documents
      .filter((d) => (d.original_name || d.file_path).toLowerCase().includes(q))
      .slice(0, 5)
      .map((d) => ({ text: d.original_name || d.file_path, type: 'document' as const }));

    const tagSuggestions: SearchSuggestion[] = allTags
      .filter((t) => t.toLowerCase().includes(q))
      .slice(0, 3)
      .map((t) => ({ text: t, type: 'tag' as const }));

    setSuggestions([...docSuggestions, ...tagSuggestions]);
    setShowSuggestions(true);
  };

  const handleSuggestionClick = (suggestion: SearchSuggestion): void => {
    if (suggestion.type === 'tag') {
      if (!selectedTags.includes(suggestion.text)) {
        setSelectedTags([...selectedTags, suggestion.text]);
      }
      setSearchQuery('');
    } else {
      setSearchQuery(suggestion.text);
    }
    setShowSuggestions(false);
  };

  const handleAddTagToDoc = async (docId: string): Promise<void> => {
    if (!newTag.trim()) return;

    try {
      const response = await ApiService.post<{ tags: string[] }>(`/documents/${docId}/tags`, { tag: newTag.trim() });
      if (response.success && response.data) {
        setDocuments((prev) => prev.map((d) => d.id === docId ? { ...d, tags: response.data!.tags } : d));
      } else {
        // Optimistic update
        setDocuments((prev) => prev.map((d) =>
          d.id === docId ? { ...d, tags: [...(d.tags || []), newTag.trim()] } : d
        ));
      }
    } catch {
      // Optimistic update
      setDocuments((prev) => prev.map((d) =>
        d.id === docId ? { ...d, tags: [...(d.tags || []), newTag.trim()] } : d
      ));
    }

    setNewTag('');
    setEditingTagDocId(null);
  };

  const handleRemoveTagFromDoc = async (docId: string, tag: string): Promise<void> => {
    try {
      await ApiService.delete(`/documents/${docId}/tags/${encodeURIComponent(tag)}`);
    } catch {
      // ignore
    }

    setDocuments((prev) => prev.map((d) =>
      d.id === docId ? { ...d, tags: (d.tags || []).filter((t) => t !== tag) } : d
    ));
  };

  const getFileTypeLabel = (name: string): { label: string; color: string } => {
    const lower = name.toLowerCase();
    if (lower.endsWith('.pdf')) return { label: 'PDF', color: 'bg-red-100 text-red-700' };
    if (lower.endsWith('.doc') || lower.endsWith('.docx')) return { label: 'DOC', color: 'bg-blue-100 text-blue-700' };
    if (lower.endsWith('.png') || lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return { label: 'IMG', color: 'bg-purple-100 text-purple-700' };
    return { label: 'FILE', color: 'bg-gray-100 text-gray-700' };
  };

  const formatFileSize = (bytes?: number): string => {
    if (!bytes) return '-';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Search Documents</h1>

      {/* Search Bar */}
      <div className="mb-6 space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative" ref={searchRef}>
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearchInput(e.target.value)}
                onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                placeholder="Search by document name or tag..."
                className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-shadow"
              />
            </div>

            {/* Autocomplete */}
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-lg shadow-lg border border-gray-200 z-40 overflow-hidden">
                {suggestions.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => handleSuggestionClick(s)}
                    className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 flex items-center gap-2"
                  >
                    {s.type === 'tag' ? (
                      <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">tag</span>
                    ) : (
                      <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    )}
                    <span className="text-gray-900">{s.text}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`px-4 py-2.5 rounded-lg text-sm font-medium border transition-colors ${
              showFilters ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
            }`}
          >
            Filters {(selectedTags.length > 0 || dateFrom || dateTo || fileType !== 'all') && (
              <span className="ml-1 bg-indigo-600 text-white text-xs w-5 h-5 rounded-full inline-flex items-center justify-center">
                {selectedTags.length + (dateFrom ? 1 : 0) + (dateTo ? 1 : 0) + (fileType !== 'all' ? 1 : 0)}
              </span>
            )}
          </button>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="px-4 py-2.5 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
          >
            <option value="date_desc">Newest First</option>
            <option value="date_asc">Oldest First</option>
            <option value="name_asc">Name A-Z</option>
            <option value="name_desc">Name Z-A</option>
            <option value="size_desc">Largest First</option>
            <option value="size_asc">Smallest First</option>
          </select>
        </div>

        {/* Active Tag Filters */}
        {selectedTags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {selectedTags.map((tag) => (
              <span key={tag} className="inline-flex items-center gap-1 bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full text-sm">
                {tag}
                <button onClick={() => setSelectedTags(selectedTags.filter((t) => t !== tag))} className="hover:text-indigo-900">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </span>
            ))}
            <button onClick={() => setSelectedTags([])} className="text-sm text-gray-500 hover:text-gray-700">
              Clear all
            </button>
          </div>
        )}

        {/* Filter Panel */}
        {showFilters && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <div className="grid sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date From</label>
                <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date To</label>
                <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">File Type</label>
                <select value={fileType} onChange={(e) => setFileType(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none">
                  <option value="all">All Types</option>
                  <option value="pdf">PDF</option>
                  <option value="doc">DOC / DOCX</option>
                  <option value="image">Images</option>
                </select>
              </div>
            </div>

            {/* Tag Filter */}
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Filter by Tags</label>
              <div className="flex flex-wrap gap-2">
                {allTags.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => {
                      if (selectedTags.includes(tag)) {
                        setSelectedTags(selectedTags.filter((t) => t !== tag));
                      } else {
                        setSelectedTags([...selectedTags, tag]);
                      }
                    }}
                    className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                      selectedTags.includes(tag)
                        ? 'bg-indigo-600 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {tag}
                  </button>
                ))}
                {allTags.length === 0 && <span className="text-sm text-gray-400">No tags found</span>}
              </div>
            </div>

            <div className="mt-4 flex justify-end">
              <button
                onClick={() => { setDateFrom(''); setDateTo(''); setFileType('all'); setSelectedTags([]); }}
                className="text-sm text-gray-500 hover:text-gray-700 font-medium"
              >
                Reset Filters
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Results */}
      {loading ? (
        <div className="bg-white rounded-xl shadow-sm p-12 text-center">
          <p className="text-gray-500">Loading documents...</p>
        </div>
      ) : filteredDocs.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
          <svg className="w-12 h-12 text-gray-300 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <p className="text-gray-500 mb-2">No documents found</p>
          <p className="text-sm text-gray-400">Try adjusting your search or filters</p>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-sm text-gray-500 mb-3">{filteredDocs.length} document{filteredDocs.length !== 1 ? 's' : ''} found</p>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 divide-y divide-gray-100">
            {filteredDocs.map((doc) => {
              const typeInfo = getFileTypeLabel(doc.original_name || doc.file_path);
              return (
                <div key={doc.id} className="p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs px-2 py-0.5 rounded font-medium ${typeInfo.color}`}>{typeInfo.label}</span>
                        <Link to={`/documents/${doc.id}`} className="font-medium text-gray-900 truncate hover:text-indigo-600">
                          {doc.original_name || doc.file_path}
                        </Link>
                      </div>
                      <p className="text-sm text-gray-500">
                        Uploaded {new Date(doc.uploaded_at).toLocaleDateString()}
                        {doc.file_size ? ` - ${formatFileSize(doc.file_size)}` : ''}
                      </p>

                      {/* Tags */}
                      <div className="flex flex-wrap items-center gap-1.5 mt-2">
                        {(doc.tags || []).map((tag) => (
                          <span key={tag} className="inline-flex items-center gap-1 bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-xs">
                            {tag}
                            <button onClick={() => handleRemoveTagFromDoc(doc.id, tag)} className="hover:text-red-600">
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </span>
                        ))}
                        {editingTagDocId === doc.id ? (
                          <div className="inline-flex items-center gap-1">
                            <input
                              type="text"
                              value={newTag}
                              onChange={(e) => setNewTag(e.target.value)}
                              onKeyDown={(e) => { if (e.key === 'Enter') handleAddTagToDoc(doc.id); if (e.key === 'Escape') setEditingTagDocId(null); }}
                              placeholder="Tag name"
                              className="px-2 py-0.5 border border-gray-300 rounded text-xs w-24 focus:ring-1 focus:ring-indigo-500 outline-none"
                              autoFocus
                            />
                            <button onClick={() => handleAddTagToDoc(doc.id)} className="text-indigo-600 hover:text-indigo-700">
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            </button>
                            <button onClick={() => setEditingTagDocId(null)} className="text-gray-400 hover:text-gray-600">
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => { setEditingTagDocId(doc.id); setNewTag(''); }}
                            className="text-xs text-indigo-600 hover:text-indigo-700 font-medium"
                          >
                            + Add Tag
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <Link to={`/documents/${doc.id}`} className="text-gray-500 text-sm font-medium hover:text-gray-700">Details</Link>
                      <Link to={`/signatures/request/${doc.id}`} className="text-indigo-600 text-sm font-medium hover:text-indigo-700">Sign</Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default DocumentSearchPage;
