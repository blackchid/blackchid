import { useState, useCallback, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Search as SearchIcon, Sparkles, Clock, User, ChevronRight } from 'lucide-react';
import { fetchApi } from '../api';
import { Badge, Spinner, EmptyState } from '../components';
import './Search.css';

interface SearchResult {
  segment_id: string;
  recording_id: string;
  speaker_label: string | null;
  text: string;
  start_time: number;
  end_time: number;
  similarity_score: number;
}

const fmtTime = (s: number) => {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
};

const fmtScore = (n: number) => `${Math.round(n * 100)}%`;

export default function Search() {
  const { projectId } = useParams();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState('');

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([]);
      setSearched(false);
      return;
    }
    setSearching(true);
    setError('');
    try {
      const data = await fetchApi(`/projects/${projectId}/search?q=${encodeURIComponent(q.trim())}`);
      setResults(data.results || []);
      setSearched(true);
    } catch (err: any) {
      setError(err.message || 'Search failed');
    } finally {
      setSearching(false);
    }
  }, [projectId]);

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(val), 500);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      doSearch(query);
    }
  };

  return (
    <div className="search-page" style={{ animation: 'pageEnter var(--dur-slow) var(--ease-out) backwards' }}>
      {/* Header */}
      <div className="search-head">
        <div>
          <h1 className="page-title">Semantic Search</h1>
          <p className="page-sub">Search across all transcript segments using AI embeddings</p>
        </div>
        <div className="search-badge">
          <Sparkles size={12} />
          pgvector
        </div>
      </div>

      {/* Search input */}
      <div className="search-input-wrap">
        <SearchIcon size={16} className="search-input-icon" />
        <input
          className="search-input"
          value={query}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder="Search transcripts semantically… e.g. 'users confused about pricing'"
          autoFocus
        />
        {searching && <Spinner size="sm" />}
      </div>

      {/* Error */}
      {error && (
        <div className="search-error">
          <span>{error}</span>
        </div>
      )}

      {/* Results */}
      {!error && (
        <div className="search-results">
          {!searched && !searching && (
            <div className="search-hint">
              <SearchIcon size={32} strokeWidth={1.2} />
              <p>Type a natural language query to find relevant transcript moments.</p>
              <div className="search-examples">
                {[
                  '"confused about pricing"',
                  '"onboarding friction"',
                  '"feature requests"',
                  '"technical issues"',
                ].map((ex) => (
                  <button
                    key={ex}
                    className="search-example-chip"
                    onClick={() => {
                      const raw = ex.replace(/"/g, '');
                      setQuery(raw);
                      doSearch(raw);
                    }}
                  >
                    {ex}
                  </button>
                ))}
              </div>
            </div>
          )}

          {searched && results.length === 0 && !searching && (
            <EmptyState
              icon={<SearchIcon size={28} strokeWidth={1.5} />}
              title="No results found"
              description="Try a different query or ensure recordings have been fully transcribed."
            />
          )}

          {results.length > 0 && (
            <>
              <div className="search-results-header">
                <span className="text-muted text-sm">{results.length} results for</span>
                <span className="search-query-badge">"{query}"</span>
              </div>
              <div className="search-result-list">
                {results.map((r, i) => (
                  <Link
                    key={r.segment_id}
                    to={`/projects/${projectId}/recordings/${r.recording_id}`}
                    className="search-result-card"
                    style={{ animationDelay: `${i * 40}ms` }}
                  >
                    <div className="search-result-top">
                      <div className="search-result-meta">
                        <Clock size={11} />
                        <span className="mono">{fmtTime(r.start_time)}</span>
                        {r.speaker_label && (
                          <>
                            <ChevronRight size={11} className="text-muted" />
                            <User size={11} />
                            <span>{r.speaker_label}</span>
                          </>
                        )}
                      </div>
                      <div className="search-score">
                        <div
                          className="search-score-bar"
                          style={{ width: `${r.similarity_score * 100}%` }}
                        />
                        <span>{fmtScore(r.similarity_score)}</span>
                      </div>
                    </div>
                    <p className="search-result-text">{r.text}</p>
                    <div className="search-result-footer">
                      <Badge variant="gray">View in transcript →</Badge>
                    </div>
                  </Link>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
