import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Brain, Calendar, Clock, CheckCircle2, AlertCircle, 
  User, MessageSquare, RefreshCw, ChevronRight, HelpCircle, Loader2,
  Play, Pause, Volume2, FastForward, Trash2
} from 'lucide-react';
import { api, type Meeting } from '../services/api';

export default function HistoryDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [loading, setLoading] = useState(true);
  const [reprocessing, setReprocessing] = useState(false);
  const [activeTab, setActiveTab] = useState<'summary' | 'decisions' | 'actions' | 'questions' | 'transcript'>('summary');

  // Custom Audio Player states
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [volume, setVolume] = useState(1);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [currentUser, setCurrentUser] = useState<{ id: string } | null>(null);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleTimeUpdate = () => {
    if (!audioRef.current) return;
    setCurrentTime(audioRef.current.currentTime);
  };

  const handleLoadedMetadata = () => {
    if (!audioRef.current) return;
    setDuration(audioRef.current.duration);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!audioRef.current) return;
    const seekTime = parseFloat(e.target.value);
    audioRef.current.currentTime = seekTime;
    setCurrentTime(seekTime);
  };

  const handleSpeedChange = () => {
    if (!audioRef.current) return;
    let nextRate = 1;
    if (playbackRate === 1) nextRate = 1.25;
    else if (playbackRate === 1.25) nextRate = 1.5;
    else if (playbackRate === 1.5) nextRate = 2;
    else nextRate = 1;
    
    audioRef.current.playbackRate = nextRate;
    setPlaybackRate(nextRate);
  };

  const formatTime = (time: number) => {
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  useEffect(() => {
    if (id) {
      fetchMeeting();
    }
    const userStr = localStorage.getItem('user');
    if (userStr) {
      setCurrentUser(JSON.parse(userStr));
    }
  }, [id]);

  const handleDeleteMeeting = async () => {
    if (!id) return;
    if (!confirm('Are you sure you want to delete this meeting history permanently? This action cannot be undone.')) return;
    try {
      await api.deleteMeeting(id);
      navigate('/');
    } catch (err) {
      console.error('Failed to delete meeting:', err);
      alert('Failed to delete meeting');
    }
  };

  const fetchMeeting = async () => {
    try {
      setLoading(true);
      const data = await api.getMeetingById(id!);
      setMeeting(data);
    } catch (err) {
      console.error(err);
      navigate('/');
    } finally {
      setLoading(false);
    }
  };

  const handleReprocessAI = async () => {
    if (!id) return;
    setReprocessing(true);
    try {
      const data = await api.processAISummary(id);
      setMeeting(data);
    } catch (err) {
      console.error(err);
    } finally {
      setReprocessing(false);
    }
  };

  const handleToggleTask = async (actionIdx: number) => {
    if (!meeting) return;
    try {
      // Optimistic update
      const updatedActions = [...(meeting.actionItems || [])];
      if (updatedActions[actionIdx]) {
        updatedActions[actionIdx] = {
          ...updatedActions[actionIdx],
          completed: !updatedActions[actionIdx].completed
        };
      }
      setMeeting({ ...meeting, actionItems: updatedActions });

      const updated = await api.toggleActionItem(meeting._id, actionIdx);
      setMeeting(updated);
    } catch (err) {
      console.error('Failed to toggle action item:', err);
      // Revert if failed
      fetchMeeting();
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) + ' • ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  // Helper to format name initials for avatars
  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-dark-950">
        <Loader2 className="w-8 h-8 text-brand-500 animate-spin" />
      </div>
    );
  }

  if (!meeting) return null;

  return (
    <div className="min-h-screen pb-16">
      {/* Top navbar */}
      <header className="border-b border-dark-800/40 bg-dark-950/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <button 
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-sm text-dark-300 hover:text-white"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Dashboard</span>
          </button>
          
          <span className="text-xs font-bold text-dark-400">Meeting Workspace Archive</span>
          
          <div className="flex items-center gap-2">
            <button 
              onClick={() => window.print()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-dark-900 border border-dark-800 text-brand-400 hover:text-white font-semibold text-xs transition-colors"
            >
              <span>Export PDF / Print</span>
            </button>
            <button 
              onClick={handleReprocessAI}
              disabled={reprocessing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-dark-900 border border-dark-800 text-brand-400 hover:text-brand-300 font-semibold text-xs disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${reprocessing ? 'animate-spin' : ''}`} />
              <span>{reprocessing ? 'Re-analyzing...' : 'Reprocess AI'}</span>
            </button>
            {meeting && currentUser && meeting.createdBy === currentUser.id && (
              <button 
                onClick={handleDeleteMeeting}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/5 border border-red-500/20 text-red-400 hover:bg-red-500/10 hover:text-red-300 font-semibold text-xs transition-colors transition-all no-print"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Meeting</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main layout */}
      <main className="max-w-4xl mx-auto px-6 mt-10 space-y-8 animate-fade-in">
        
        {/* Title Details Header */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-xs text-dark-400">
            <Calendar className="w-3.5 h-3.5 text-brand-400" />
            <span>{formatDate(meeting.startTime)}</span>
            <span>•</span>
            <Clock className="w-3.5 h-3.5 text-brand-400" />
            <span>60 minutes</span>
          </div>

          <h1 className="text-3xl font-extrabold text-white tracking-tight font-sans">
            {meeting.title}
          </h1>
          
          <p className="text-sm text-dark-400 max-w-2xl">
            {meeting.description || 'Review the structured notes, action plans, decision log, and transcription of this meeting.'}
          </p>
        </div>

        {/* Custom Audio Recording Player */}
        {meeting.recordingUrl && (
          <div className="glass-card p-5 border-brand-500/20 bg-gradient-to-r from-dark-900 via-dark-900 to-brand-950/10 rounded-2xl flex items-center justify-between gap-6 no-print">
            <audio 
              ref={audioRef} 
              src={meeting.recordingUrl} 
              onTimeUpdate={handleTimeUpdate}
              onLoadedMetadata={handleLoadedMetadata}
              onEnded={() => setIsPlaying(false)}
            />
            
            <button 
              onClick={togglePlay}
              className="w-11 h-11 rounded-xl bg-brand-500 hover:bg-brand-600 flex items-center justify-center text-white shrink-0 shadow-lg shadow-brand-500/20 transition active:scale-95"
            >
              {isPlaying ? <Pause className="w-4.5 h-4.5 fill-white" /> : <Play className="w-4.5 h-4.5 fill-white ml-0.5" />}
            </button>
            
            <div className="flex-1 space-y-1.5 min-w-0">
              <div className="flex justify-between text-[10px] font-bold text-dark-400 uppercase tracking-wider">
                <span>Meeting Recording Playback</span>
                <span>{formatTime(currentTime)} / {formatTime(duration)}</span>
              </div>
              <input 
                type="range" 
                min="0" 
                max={duration || 100} 
                value={currentTime} 
                onChange={handleSeek}
                className="w-full h-1 bg-dark-800 rounded-lg appearance-none cursor-pointer accent-brand-500"
              />
            </div>
            
            <div className="flex items-center gap-4 shrink-0 max-sm:hidden">
              <button 
                onClick={handleSpeedChange}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-dark-800 hover:bg-dark-750 text-dark-300 text-xs font-semibold"
              >
                <FastForward className="w-3.5 h-3.5 text-brand-400" />
                <span>{playbackRate}x</span>
              </button>
              
              <div className="flex items-center gap-1.5">
                <Volume2 className="w-4 h-4 text-dark-400" />
                <input 
                  type="range" 
                  min="0" 
                  max="1" 
                  step="0.05"
                  value={volume}
                  onChange={(e) => {
                    const nextVol = parseFloat(e.target.value);
                    if (audioRef.current) audioRef.current.volume = nextVol;
                    setVolume(nextVol);
                  }}
                  className="w-16 h-1 bg-dark-800 rounded-lg appearance-none cursor-pointer accent-brand-500"
                />
              </div>
            </div>
          </div>
        )}

        {/* Tab Selection */}
        <div className="flex border-b border-dark-800/40 gap-6 overflow-x-auto pb-px">
          {[
            { id: 'summary', name: 'Executive Summary', icon: Brain },
            { id: 'decisions', name: 'Key Decisions', icon: CheckCircle2 },
            { id: 'actions', name: 'Action Items', icon: Clock },
            { id: 'questions', name: 'Open Questions', icon: HelpCircle },
            { id: 'transcript', name: 'Full Transcript', icon: MessageSquare }
          ].map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 pb-3.5 text-sm font-semibold transition-all shrink-0 border-b-2 ${
                  activeTab === tab.id 
                    ? 'text-brand-400 border-brand-500' 
                    : 'text-dark-400 border-transparent hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.name}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Contents */}
        <div className="mt-6">
          {/* Executive Summary */}
          {activeTab === 'summary' && (
            <div className="glass-card p-8 space-y-4 leading-relaxed border-brand-500/10 bg-gradient-to-br from-dark-900 via-dark-900 to-brand-950/10">
              <div className="flex items-center gap-2 mb-2">
                <Brain className="w-5 h-5 text-brand-400" />
                <h2 className="text-sm font-bold uppercase tracking-wider text-brand-400">Meeting Summary</h2>
              </div>
              
              {meeting.summary ? (
                <div className="text-dark-200 text-sm whitespace-pre-line leading-relaxed">
                  {meeting.summary}
                </div>
              ) : (
                <div className="text-center py-6 text-dark-400 text-xs">
                  <p className="mb-2">No summary generated yet. Click "Reprocess AI" to generate one from the transcript.</p>
                </div>
              )}
            </div>
          )}

          {/* Decisions */}
          {activeTab === 'decisions' && (
            <div className="glass-card p-6 space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 className="w-5 h-5 text-green-400" />
                <h2 className="text-sm font-bold uppercase tracking-wider text-green-400">Logged Decisions</h2>
              </div>

              {!meeting.decisions || meeting.decisions.length === 0 ? (
                <p className="text-xs text-dark-500 text-center py-6">No explicit decisions logged in this session.</p>
              ) : (
                <ul className="space-y-3">
                  {meeting.decisions.map((dec, idx) => (
                    <li key={idx} className="flex gap-3 items-start bg-dark-800/20 border border-dark-800/40 rounded-xl p-4">
                      <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0 mt-0.5" />
                      <span className="text-sm text-dark-100 font-medium">{dec}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Action Items */}
          {activeTab === 'actions' && (
            <div className="glass-card overflow-hidden">
              <div className="p-6 border-b border-dark-800/40 flex items-center gap-2">
                <Clock className="w-5 h-5 text-brand-400" />
                <h2 className="text-sm font-bold uppercase tracking-wider text-white">Task Assignments</h2>
              </div>

              {!meeting.actionItems || meeting.actionItems.length === 0 ? (
                <p className="text-xs text-dark-500 text-center py-8">No assigned tasks logged for this meeting.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-dark-800 bg-dark-950/50 text-dark-400 font-medium text-xs uppercase tracking-wider">
                        <th className="px-6 py-4 w-12 text-center">Status</th>
                        <th className="px-6 py-4">Person</th>
                        <th className="px-6 py-4">Task</th>
                        <th className="px-6 py-4">Deadline</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-dark-800/30">
                      {meeting.actionItems.map((item, idx) => (
                        <tr key={idx} className={`hover:bg-dark-800/10 transition-all ${item.completed ? 'opacity-40 line-through decoration-dark-500' : ''}`}>
                          <td className="px-6 py-4 text-center">
                            <input 
                              type="checkbox"
                              checked={!!item.completed}
                              onChange={() => handleToggleTask(idx)}
                              className="w-4 h-4 rounded border-dark-800 bg-dark-950 text-brand-500 focus:ring-brand-500 focus:ring-offset-dark-950 focus:ring-2 cursor-pointer accent-brand-500"
                            />
                          </td>
                          <td className="px-6 py-4 font-semibold text-white whitespace-nowrap flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-brand-500/10 border border-brand-500/20 flex items-center justify-center text-[10px] text-brand-400">
                              {getInitials(item.person)}
                            </div>
                            <span>{item.person}</span>
                          </td>
                          <td className="px-6 py-4 text-dark-200">{item.task}</td>
                          <td className="px-6 py-4">
                            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-brand-500/10 text-brand-400">
                              {item.deadline || 'No Date'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Open Questions */}
          {activeTab === 'questions' && (
            <div className="glass-card p-6 space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="w-5 h-5 text-amber-400" />
                <h2 className="text-sm font-bold uppercase tracking-wider text-amber-400">Unresolved Topics & Questions</h2>
              </div>

              {!meeting.questions || meeting.questions.length === 0 ? (
                <p className="text-xs text-dark-500 text-center py-6">All topics resolved during this call!</p>
              ) : (
                <ul className="space-y-3">
                  {meeting.questions.map((quest, idx) => (
                    <li key={idx} className="flex gap-3 items-start bg-amber-500/5 border border-amber-500/10 rounded-xl p-4">
                      <HelpCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      <span className="text-sm text-dark-200">{quest}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Full Transcript */}
          {activeTab === 'transcript' && (
            <div className="glass-card p-6 space-y-4 flex flex-col">
              <div className="border-b border-dark-800/40 pb-4 mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-brand-400" />
                  <h2 className="text-sm font-bold uppercase tracking-wider text-white">Full Discussion Transcript</h2>
                </div>
                <span className="text-xs text-dark-400">{meeting.transcript?.length || 0} discussion nodes</span>
              </div>

              {!meeting.transcript || meeting.transcript.length === 0 ? (
                <p className="text-xs text-dark-500 text-center py-10">No transcript logged for this meeting.</p>
              ) : (
                <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
                  {meeting.transcript.map((line, idx) => {
                    const isAi = line.sender.includes('MeetMind AI') || line.sender.includes('AI');
                    return (
                      <div key={idx} className={`flex gap-3 items-start ${isAi ? 'bg-brand-950/15 border border-brand-500/10 p-3 rounded-xl' : ''}`}>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-bold text-white shadow-md ${
                          isAi ? 'bg-brand-500' : 'bg-dark-800 border border-dark-700'
                        }`}>
                          {isAi ? '🤖' : getInitials(line.sender)}
                        </div>
                        <div className="space-y-1 flex-1">
                          <div className="flex items-baseline gap-2">
                            <span className="text-xs font-bold text-white">{line.sender}</span>
                            <span className="text-[9px] text-dark-500">{formatDate(line.timestamp).split('•')[1]}</span>
                          </div>
                          <p className="text-xs text-dark-200 leading-relaxed">{line.text}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
