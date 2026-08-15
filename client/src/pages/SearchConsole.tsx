import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Search, ArrowLeft, Brain, Calendar, Clock, ArrowRight, Sparkles, Loader2, MessageSquare 
} from 'lucide-react';
import { api, type Meeting } from '../services/api';

interface SearchMatch {
  meeting: Meeting;
  relevance: number;
  snippet: string;
}

export default function SearchConsole() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  
  // Results
  const [aiAnswer, setAiAnswer] = useState<string | null>(null);
  const [matches, setMatches] = useState<SearchMatch[]>([]);
  const [hasSearched, setHasSearched] = useState(false);

  const sampleQueries = [
    "When did we decide to use PostgreSQL?",
    "What tasks were assigned to Priya this month?",
    "What was discussed about AWS deployment?"
  ];

  const handleSearch = async (e: React.FormEvent, customQuery?: string) => {
    if (e) e.preventDefault();
    const searchQuery = customQuery || query;
    if (!searchQuery.trim()) return;

    setQuery(searchQuery);
    setSearching(true);
    setHasSearched(true);

    try {
      const data = await api.searchMeetings(searchQuery);
      setAiAnswer(data.answer);
      setMatches(data.matches);
      setSearching(false);
    } catch (err) {
      console.error(err);
      setSearching(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div className="min-h-screen pb-16">
      {/* Header */}
      <header className="border-b border-dark-800/40 bg-dark-950/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <button 
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-sm text-dark-300 hover:text-white"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Dashboard</span>
          </button>
          
          <h1 className="text-sm font-bold text-white flex items-center gap-2">
            <Brain className="w-4 h-4 text-brand-400" />
            <span>AI Knowledge Base RAG</span>
          </h1>

          <div className="w-20" />
        </div>
      </header>

      {/* Main Console */}
      <main className="max-w-3xl mx-auto px-6 mt-10 space-y-8 animate-fade-in">
        <div className="text-center space-y-2 mb-6">
          <h2 className="text-2xl font-extrabold text-white tracking-tight font-sans">
            AI Semantic Search Console
          </h2>
          <p className="text-sm text-dark-400">
            Query cross-meeting logs, decisions, task assignments, and discussions in real-time.
          </p>
        </div>

        {/* Search Bar */}
        <form onSubmit={(e) => handleSearch(e)} className="relative">
          <input 
            type="text" 
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ask anything (e.g. When did we decide to use PostgreSQL?)"
            className="w-full bg-dark-900 border-2 border-dark-850 hover:border-dark-800 focus:border-brand-500 rounded-2xl pl-12 pr-28 py-4 text-white focus:outline-none transition-all placeholder-dark-500"
            required
          />
          <Search className="w-5 h-5 text-dark-500 absolute left-4 top-1/2 transform -translate-y-1/2" />
          
          <button 
            type="submit" 
            disabled={searching}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 disabled:opacity-50"
          >
            {searching ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5" />
                <span>Search</span>
              </>
            )}
          </button>
        </form>

        {/* Suggestions */}
        {!hasSearched && (
          <div className="space-y-3">
            <p className="text-xs font-bold text-dark-400 uppercase tracking-wider">Suggested Queries</p>
            <div className="flex flex-col gap-2">
              {sampleQueries.map((q, idx) => (
                <button
                  key={idx}
                  onClick={(e) => handleSearch(e, q)}
                  className="text-left w-full text-xs font-semibold px-4 py-3 rounded-xl bg-dark-900 hover:bg-dark-850 border border-dark-800/40 hover:border-brand-500/20 text-dark-300 hover:text-white transition-all flex items-center justify-between group"
                >
                  <span>{q}</span>
                  <ArrowRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transform translate-x-[-5px] group-hover:translate-x-0 transition-all text-brand-400" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Searching Loader */}
        {searching && (
          <div className="py-12 flex flex-col items-center justify-center gap-4 text-center">
            <Loader2 className="w-8 h-8 text-brand-500 animate-spin" />
            <p className="text-xs text-dark-400">Querying embeddings and context buffers...</p>
          </div>
        )}

        {/* Results Panels */}
        {!searching && hasSearched && (
          <div className="space-y-6">
            
            {/* RAG Synthesized AI Answer */}
            {aiAnswer && (
              <div className="glass-card p-6 bg-gradient-to-r from-brand-950/20 via-dark-900/60 to-dark-900 border-brand-500/20 space-y-3">
                <div className="flex items-center gap-2">
                  <Brain className="w-4 h-4 text-brand-400" />
                  <span className="text-xs font-bold uppercase tracking-wider text-brand-400">Synthesized AI Answer</span>
                </div>
                <p className="text-sm text-dark-100 leading-relaxed font-sans font-medium">
                  {aiAnswer}
                </p>
              </div>
            )}

            {/* Matches List */}
            <div className="space-y-4">
              <h3 className="text-xs font-bold text-dark-400 uppercase tracking-wider">
                Matching Meetings ({matches.length})
              </h3>
              
              {matches.length === 0 ? (
                <div className="glass-card p-8 text-center text-dark-500 text-xs">
                  No direct matching transcripts. Try searching something else.
                </div>
              ) : (
                <div className="space-y-4">
                  {matches.map(({ meeting, relevance, snippet }, idx) => (
                    <div 
                      key={idx}
                      onClick={() => navigate(`/history/${meeting._id}`)}
                      className="glass-card p-5 glass-card-hover cursor-pointer space-y-3"
                    >
                      <div className="flex items-center justify-between border-b border-dark-800/40 pb-3">
                        <div className="space-y-1">
                          <h4 className="text-sm font-bold text-white group-hover:text-brand-400">
                            {meeting.title}
                          </h4>
                          <div className="flex items-center gap-2 text-[10px] text-dark-400">
                            <Calendar className="w-3 h-3 text-brand-400" />
                            <span>{formatDate(meeting.startTime)}</span>
                          </div>
                        </div>

                        <span className="text-xs font-extrabold px-2.5 py-1 rounded-full bg-brand-500/10 text-brand-400 border border-brand-500/10">
                          {relevance}% match
                        </span>
                      </div>

                      <div className="bg-dark-950/40 border border-dark-800/40 rounded-xl p-3 flex gap-2.5 items-start">
                        <MessageSquare className="w-4 h-4 text-dark-500 mt-0.5 shrink-0" />
                        <p className="text-xs text-dark-300 italic">
                          "{snippet}"
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        )}
      </main>
    </div>
  );
}
