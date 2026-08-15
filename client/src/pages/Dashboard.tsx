import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Calendar, Plus, Folder, FolderPlus, Clock, Users, ArrowRight, 
  Search, Video, Sparkles, Brain, Trash2, CalendarDays, Loader2
} from 'lucide-react';
import { api, type Meeting, type Folder as FolderType } from '../services/api';

export default function Dashboard() {
  const navigate = useNavigate();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [folders, setFolders] = useState<FolderType[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<{ id: string; name: string; email: string; avatar: string } | null>(null);
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
  
  // Create meeting form states
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState('2026-08-15');
  const [time, setTime] = useState('17:00');
  const [duration, setDuration] = useState('60');
  const [participants, setParticipants] = useState('');
  const [folderId, setFolderId] = useState('');
  const [creatingMeeting, setCreatingMeeting] = useState(false);

  // Create folder form states
  const [folderName, setFolderName] = useState('');
  const [creatingFolder, setCreatingFolder] = useState(false);

  const [showSyncSuccess, setShowSyncSuccess] = useState(false);

  useEffect(() => {
    fetchData();

    const userStr = localStorage.getItem('user');
    if (userStr) {
      setCurrentUser(JSON.parse(userStr));
    }

    // Check if OAuth callback succeeded
    const params = new URLSearchParams(window.location.search);
    if (params.get('sync') === 'success') {
      setShowSyncSuccess(true);
      window.history.replaceState({}, document.title, window.location.pathname);
      setTimeout(() => setShowSyncSuccess(false), 6000);
    }
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [meetingsData, foldersData] = await Promise.all([
        api.getMeetings(),
        api.getFolders()
      ]);
      setMeetings(meetingsData);
      setFolders(foldersData);
    } catch (error) {
      console.error('Failed to fetch dashboard data', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSyncCalendar = async () => {
    try {
      const baseUrl = import.meta.env.VITE_API_BASE_URL || '/api';
      const res = await fetch(`${baseUrl}/calendar/auth-url`);
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      console.error('Failed to start calendar sync', err);
    }
  };

  const handleCreateMeeting = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !date || !time) return;

    setCreatingMeeting(true);
    try {
      // Calculate startTime and endTime
      const startDateTime = new Date(`${date}T${time}:00`);
      const endDateTime = new Date(startDateTime.getTime() + parseInt(duration) * 60 * 1000);
      
      const emailList = participants
        .split(',')
        .map(e => e.trim())
        .filter(e => e.length > 0);

      await api.createMeeting({
        title,
        description,
        startTime: startDateTime.toISOString(),
        endTime: endDateTime.toISOString(),
        participants: emailList,
        folderId: folderId || null,
        agenda: undefined // can add it if needed
      } as any);

      // Reset state and refresh
      setTitle('');
      setDescription('');
      setDate('2026-08-15');
      setTime('17:00');
      setDuration('60');
      setParticipants('');
      setFolderId('');
      setIsModalOpen(false);
      await fetchData();
    } catch (err) {
      console.error('Failed to create meeting', err);
    } finally {
      setCreatingMeeting(false);
    }
  };

  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!folderName.trim()) return;

    setCreatingFolder(true);
    try {
      await api.createFolder(folderName);
      setFolderName('');
      setIsFolderModalOpen(false);
      await fetchData();
    } catch (err) {
      console.error('Failed to create folder', err);
    } finally {
      setCreatingFolder(false);
    }
  };

  const handleDeleteFolder = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this folder? Meetings inside will be moved to general workspace.')) return;
    try {
      await api.deleteFolder(id);
      await fetchData();
    } catch (err) {
      console.error('Failed to delete folder', err);
    }
  };

  const now = new Date();
  const upcomingMeetings = meetings.filter(m => m.status !== 'ended' && new Date(m.startTime) >= now);
  const recentMeetings = meetings.filter(m => m.status === 'ended');

  // Format date helper
  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' • ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-dark-950">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 text-brand-500 animate-spin" />
          <p className="text-dark-300 font-medium">Gathering workspace intelligence...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-16">
      {/* Top Banner Navigation */}
      <header className="border-b border-dark-800/40 bg-dark-950/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-brand-500 flex items-center justify-center shadow-lg shadow-brand-500/20">
              <Brain className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight text-white font-sans">
              Meet<span className="text-brand-400">Mind</span>
            </span>
          </div>
          
          <div className="flex items-center gap-4">
            <button 
              onClick={handleSyncCalendar}
              className="flex items-center gap-2 text-sm text-dark-300 hover:text-white px-4 py-2 rounded-xl bg-dark-900 border border-dark-800/50 hover:border-brand-500/20"
            >
              <Calendar className="w-4 h-4 text-brand-400" />
              <span className="max-sm:hidden">Sync Calendar</span>
            </button>

            <button 
              onClick={() => navigate('/search')}
              className="flex items-center gap-2 text-sm text-dark-300 hover:text-white px-4 py-2 rounded-xl bg-dark-900 border border-dark-800/50"
            >
              <Search className="w-4 h-4 text-brand-400" />
              <span>Search knowledge base...</span>
            </button>
            
            <div className="flex items-center gap-3 pl-2 border-l border-dark-800/50">
              <img 
                src={currentUser?.avatar || "https://api.dicebear.com/7.x/adventurer/svg?seed=Tushar"} 
                alt="Avatar" 
                className="w-8 h-8 rounded-full ring-2 ring-brand-500/20"
              />
              <div className="flex flex-col max-sm:hidden">
                <span className="text-xs font-semibold text-white leading-tight">{currentUser?.name || "Tushar Patel"}</span>
                <span className="text-[9px] text-dark-500">{currentUser?.email || "tushar@gmail.com"}</span>
              </div>
              <button
                onClick={() => {
                  localStorage.removeItem('token');
                  localStorage.removeItem('user');
                  window.location.reload();
                }}
                className="text-xs text-red-400 hover:text-red-300 font-bold bg-red-500/5 border border-red-500/10 px-2 py-1 rounded-lg ml-2 hover:bg-red-500/10"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Sync Success Toast Banner */}
      {showSyncSuccess && (
        <div className="max-w-7xl mx-auto px-6 mt-6">
          <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4 flex items-center justify-between text-green-400 text-xs font-semibold">
            <span>📅 Google Calendar synchronized successfully! Google Meet links will be auto-generated for new meetings.</span>
            <button onClick={() => setShowSyncSuccess(false)} className="text-white hover:text-green-300 bg-dark-850 px-2.5 py-1 rounded-lg border border-dark-800">Dismiss</button>
          </div>
        </div>
      )}

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-6 mt-10 grid grid-cols-12 gap-8">
        
        {/* Left Workspace Panel (Folders) */}
        <section className="col-span-12 md:col-span-3">
          <div className="glass-card p-6 sticky top-24">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-sm font-bold text-dark-400 uppercase tracking-wider">My Folders</h2>
              <button 
                onClick={() => setIsFolderModalOpen(true)}
                className="p-1.5 rounded-lg hover:bg-dark-800 text-brand-400 hover:text-brand-300"
              >
                <FolderPlus className="w-4 h-4" />
              </button>
            </div>

            <nav className="space-y-1">
              <button 
                onClick={() => navigate('/')}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-all bg-brand-500/10 text-brand-400 border border-brand-500/10"
              >
                <div className="flex items-center gap-2.5">
                  <Brain className="w-4 h-4" />
                  <span>All Workspace</span>
                </div>
                <span className="text-xs bg-brand-500/20 px-2 py-0.5 rounded-full font-bold">{meetings.length}</span>
              </button>

              {folders.map(f => (
                <button
                  key={f._id}
                  onClick={() => navigate(`/folder/${f._id}`)}
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-dark-300 hover:text-white hover:bg-dark-800/40 group"
                >
                  <div className="flex items-center gap-2.5">
                    <Folder className="w-4 h-4 text-brand-500/60 group-hover:text-brand-400" />
                    <span className="truncate max-w-[120px]">{f.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-dark-500 group-hover:text-dark-300">{f.meetings?.length || 0}</span>
                    <Trash2 
                      onClick={(e) => handleDeleteFolder(f._id, e)}
                      className="w-3.5 h-3.5 text-dark-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity" 
                    />
                  </div>
                </button>
              ))}
            </nav>
          </div>
        </section>

        {/* Center / Right Content Panel */}
        <section className="col-span-12 md:col-span-9 space-y-8 animate-fade-in">
          {/* Greeting Banner */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-gradient-to-r from-brand-950/40 via-dark-900/60 to-dark-900/30 p-8 rounded-3xl border border-brand-500/10 relative overflow-hidden">
            <div className="absolute right-0 top-0 w-64 h-64 bg-brand-500/5 blur-[80px] pointer-events-none rounded-full" />
            <div className="space-y-1 z-10">
              <h1 className="text-3xl font-extrabold text-white tracking-tight font-sans">
                Good Morning, Tushar 👋
              </h1>
              <p className="text-sm text-dark-400">
                You have <span className="text-brand-400 font-semibold">{upcomingMeetings.length} meetings</span> scheduled for today.
              </p>
            </div>
            
            <button 
              onClick={() => setIsModalOpen(true)}
              className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-semibold text-sm shadow-lg shadow-brand-500/20 active:scale-[0.98] z-10"
            >
              <Plus className="w-4 h-4" />
              <span>Create Meeting</span>
            </button>
          </div>

          {/* Upcoming Meetings Section */}
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-brand-400" />
              <span>Upcoming Meetings</span>
            </h2>

            {upcomingMeetings.length === 0 ? (
              <div className="glass-card p-8 text-center text-dark-400 border-dashed border-dark-800">
                <Clock className="w-8 h-8 text-dark-600 mx-auto mb-2" />
                <p className="text-sm">No scheduled meetings. Time to design a new discussion?</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {upcomingMeetings.map(m => (
                  <div key={m._id} className="glass-card glass-card-hover p-6 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-brand-500/10 text-brand-400">
                          {formatDate(m.startTime).split('•')[0]}
                        </span>
                        <div className="flex items-center gap-2">
                          {m.createdBy === currentUser?.id && (
                            <button
                              onClick={async (e) => {
                                e.stopPropagation();
                                if (confirm('Are you sure you want to cancel and delete this scheduled meeting?')) {
                                  try {
                                    await api.deleteMeeting(m._id);
                                    await fetchData();
                                  } catch (err) {
                                    console.error('Failed to delete meeting:', err);
                                    alert('Failed to delete meeting');
                                  }
                                }
                              }}
                              className="p-1 rounded-md hover:bg-red-500/10 text-red-400 hover:text-red-300 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <span className="text-xs text-dark-400 flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            {new Date(m.startTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                          </span>
                        </div>
                      </div>
                      
                      <h3 className="text-base font-bold text-white mb-1 truncate">{m.title}</h3>
                      <p className="text-xs text-dark-400 line-clamp-2 mb-4">
                        {m.description || 'No description provided.'}
                      </p>
                    </div>

                    <div className="flex items-center justify-between border-t border-dark-800/40 pt-4 mt-auto">
                      <div className="flex items-center gap-1 text-xs text-dark-300">
                        <Users className="w-3.5 h-3.5 text-brand-400" />
                        <span>{m.participants?.length || 0} participants</span>
                      </div>

                      <button 
                        onClick={() => navigate(`/meeting/${m._id}`)}
                        className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-brand-500 hover:bg-brand-600 text-white font-bold text-xs"
                      >
                        <Video className="w-3.5 h-3.5" />
                        <span>Join Meeting</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Meetings Section */}
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-brand-400" />
              <span>Recent Meetings</span>
            </h2>

            {recentMeetings.length === 0 ? (
              <div className="glass-card p-8 text-center text-dark-400">
                <p className="text-sm">No recently processed meetings found.</p>
              </div>
            ) : (
              <div className="glass-card overflow-hidden">
                <div className="divide-y divide-dark-800/40">
                  {recentMeetings.map(m => (
                    <div 
                      key={m._id} 
                      onClick={() => navigate(`/history/${m._id}`)}
                      className="p-5 flex items-center justify-between hover:bg-dark-800/20 transition-all cursor-pointer group"
                    >
                      <div className="space-y-1 max-w-[70%]">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-white group-hover:text-brand-400 transition-colors">
                            {m.title}
                          </span>
                          {m.summary && (
                            <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded-md bg-green-500/10 text-green-400 border border-green-500/20 flex items-center gap-0.5">
                              <Brain className="w-2.5 h-2.5" />
                              <span>AI Summary Available</span>
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-dark-400 truncate">
                          {m.summary || m.description || 'Review meeting transcript and insights.'}
                        </p>
                      </div>

                      <div className="flex items-center gap-3 text-right">
                        <div className="space-y-0.5 max-sm:hidden">
                          <p className="text-xs font-medium text-dark-200">{formatDate(m.startTime).split('•')[0]}</p>
                          <p className="text-[10px] text-dark-500">Ended</p>
                        </div>
                        {m.createdBy === currentUser?.id && (
                          <button
                            onClick={async (e) => {
                              e.stopPropagation();
                              if (confirm('Are you sure you want to delete this meeting history permanently?')) {
                                try {
                                  await api.deleteMeeting(m._id);
                                  await fetchData();
                                } catch (err) {
                                    console.error('Failed to delete meeting:', err);
                                    alert('Failed to delete meeting');
                                }
                              }
                            }}
                            className="p-1.5 rounded-lg hover:bg-red-500/10 text-red-400 hover:text-red-300 transition-colors z-10"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                        <ArrowRight className="w-4 h-4 text-dark-500 group-hover:text-white transition-all transform group-hover:translate-x-1" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
      </main>

      {/* SCHEDULE MEETING MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-dark-950/80 backdrop-blur-sm animate-fade-in">
          <div className="glass-card w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6 pb-2 border-b border-dark-800">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Calendar className="w-5 h-5 text-brand-400" />
                <span>Create Meeting</span>
              </h2>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="text-dark-400 hover:text-white text-sm font-semibold"
              >
                Close
              </button>
            </div>

            <form onSubmit={handleCreateMeeting} className="space-y-4 text-sm">
              <div>
                <label className="block text-dark-300 font-medium mb-1.5">Meeting Title</label>
                <input 
                  type="text" 
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Project Architecture Discussion" 
                  className="w-full bg-dark-900 border border-dark-800 rounded-xl px-4 py-2.5 text-white placeholder-dark-500 focus:outline-none focus:border-brand-500"
                  required
                />
              </div>

              <div>
                <label className="block text-dark-300 font-medium mb-1.5">Description (Optional)</label>
                <textarea 
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Detail the agenda and goals..." 
                  className="w-full bg-dark-900 border border-dark-800 rounded-xl px-4 py-2.5 text-white placeholder-dark-500 focus:outline-none focus:border-brand-500 h-20 resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-dark-300 font-medium mb-1.5">Date</label>
                  <input 
                    type="date" 
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full bg-dark-900 border border-dark-800 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-brand-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-dark-300 font-medium mb-1.5">Time</label>
                  <input 
                    type="time" 
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    className="w-full bg-dark-900 border border-dark-800 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-brand-500"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-dark-300 font-medium mb-1.5">Duration</label>
                  <select 
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                    className="w-full bg-dark-900 border border-dark-800 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-brand-500"
                  >
                    <option value="15">15 minutes</option>
                    <option value="30">30 minutes</option>
                    <option value="45">45 minutes</option>
                    <option value="60">60 minutes</option>
                    <option value="90">90 minutes</option>
                    <option value="120">120 minutes</option>
                  </select>
                </div>
                <div>
                  <label className="block text-dark-300 font-medium mb-1.5">Folder</label>
                  <select 
                    value={folderId}
                    onChange={(e) => setFolderId(e.target.value)}
                    className="w-full bg-dark-900 border border-dark-800 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-brand-500"
                  >
                    <option value="">General Workspace</option>
                    {folders.map(f => (
                      <option key={f._id} value={f._id}>{f.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-dark-300 font-medium mb-1.5">Participants Emails (comma separated)</label>
                <input 
                  type="text" 
                  value={participants}
                  onChange={(e) => setParticipants(e.target.value)}
                  placeholder="rahul@gmail.com, priya@gmail.com" 
                  className="w-full bg-dark-900 border border-dark-800 rounded-xl px-4 py-2.5 text-white placeholder-dark-500 focus:outline-none focus:border-brand-500"
                />
              </div>

              <div className="pt-2">
                <button 
                  type="submit" 
                  disabled={creatingMeeting}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-semibold shadow-lg shadow-brand-500/20 disabled:bg-brand-500/60"
                >
                  {creatingMeeting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Scheduling Sync...</span>
                    </>
                  ) : (
                    <span>Create Meeting</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE FOLDER MODAL */}
      {isFolderModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-dark-950/80 backdrop-blur-sm animate-fade-in">
          <div className="glass-card w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-dark-800">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <FolderPlus className="w-4 h-4 text-brand-400" />
                <span>Create Folder</span>
              </h2>
              <button 
                onClick={() => setIsFolderModalOpen(false)}
                className="text-dark-400 hover:text-white text-xs font-semibold"
              >
                Cancel
              </button>
            </div>

            <form onSubmit={handleCreateFolder} className="space-y-4 text-sm">
              <div>
                <label className="block text-dark-300 font-medium mb-1.5">Folder Name</label>
                <input 
                  type="text" 
                  value={folderName}
                  onChange={(e) => setFolderName(e.target.value)}
                  placeholder="e.g. Clients" 
                  className="w-full bg-dark-900 border border-dark-800 rounded-xl px-4 py-2 text-white placeholder-dark-500 focus:outline-none focus:border-brand-500"
                  required
                  autoFocus
                />
              </div>

              <button 
                type="submit"
                disabled={creatingFolder}
                className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-semibold shadow-lg"
              >
                {creatingFolder ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <span>Create Folder</span>
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
