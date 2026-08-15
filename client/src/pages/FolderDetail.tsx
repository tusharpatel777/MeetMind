import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Folder, ArrowLeft, Clock, Users, ArrowRight, Video, Brain, Sparkles, Loader2 
} from 'lucide-react';
import { api, type Meeting, type Folder as FolderType } from '../services/api';

export default function FolderDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const [folder, setFolder] = useState<FolderType | null>(null);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      fetchFolderDetails();
    }
  }, [id]);

  const fetchFolderDetails = async () => {
    try {
      setLoading(true);
      const [folders, allMeetings] = await Promise.all([
        api.getFolders(),
        api.getMeetings()
      ]);
      const currentFolder = folders.find(f => f._id === id);
      if (currentFolder) {
        setFolder(currentFolder);
        // Filter meetings belonging to this folder
        const folderMeetings = allMeetings.filter(m => m.folderId === id);
        setMeetings(folderMeetings);
      } else {
        navigate('/');
      }
    } catch (error) {
      console.error('Failed to fetch folder details', error);
      navigate('/');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' • ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-dark-950">
        <Loader2 className="w-8 h-8 text-brand-500 animate-spin" />
      </div>
    );
  }

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
            <span>Back to Dashboard</span>
          </button>
          
          <div className="flex items-center gap-2">
            <Folder className="w-5 h-5 text-brand-500" />
            <h1 className="text-base font-bold text-white">{folder?.name} Workspace</h1>
          </div>

          <div className="w-24" /> {/* Spacer */}
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-4xl mx-auto px-6 mt-10 space-y-6">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-brand-500/10 rounded-2xl border border-brand-500/20">
            <Folder className="w-8 h-8 text-brand-400" />
          </div>
          <div>
            <h2 className="text-2xl font-extrabold text-white tracking-tight">{folder?.name}</h2>
            <p className="text-sm text-dark-400">{meetings.length} meetings archive</p>
          </div>
        </div>

        {/* Meetings List */}
        <div className="space-y-4 mt-8">
          {meetings.length === 0 ? (
            <div className="glass-card p-12 text-center text-dark-400">
              <Clock className="w-8 h-8 text-dark-600 mx-auto mb-2" />
              <p className="text-sm mb-4">No meetings stored in this folder yet.</p>
              <button 
                onClick={() => navigate('/')}
                className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-lg text-xs font-bold"
              >
                Schedule First Meeting
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {meetings.map(m => (
                <div 
                  key={m._id}
                  className="glass-card p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 glass-card-hover"
                >
                  <div className="space-y-2 max-w-[70%]">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-brand-500/10 text-brand-400">
                        {formatDate(m.startTime).split('•')[0]}
                      </span>
                      {m.status === 'ended' && m.summary && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 border border-green-500/10 flex items-center gap-1">
                          <Brain className="w-2.5 h-2.5" />
                          <span>AI Summary</span>
                        </span>
                      )}
                      {m.status === 'live' && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 border border-red-500/20 live-glow">
                          LIVE MEETING
                        </span>
                      )}
                    </div>

                    <h3 className="text-base font-bold text-white truncate">{m.title}</h3>
                    <p className="text-xs text-dark-400 line-clamp-1">{m.description || 'No description.'}</p>
                  </div>

                  <div className="flex items-center gap-4 max-sm:justify-between sm:shrink-0">
                    <span className="text-xs text-dark-400 flex items-center gap-1">
                      <Users className="w-3.5 h-3.5" />
                      {m.participants?.length || 0} participants
                    </span>

                    {m.status === 'ended' ? (
                      <button 
                        onClick={() => navigate(`/history/${m._id}`)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-dark-800 hover:bg-dark-700 text-white font-semibold text-xs border border-dark-700"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-brand-400" />
                        <span>Review</span>
                      </button>
                    ) : (
                      <button 
                        onClick={() => navigate(`/meeting/${m._id}`)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-500 hover:bg-brand-600 text-white font-bold text-xs"
                      >
                        <Video className="w-3.5 h-3.5" />
                        <span>Join</span>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
