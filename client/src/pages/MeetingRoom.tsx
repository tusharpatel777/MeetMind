import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import io, { Socket } from 'socket.io-client';
import { 
  Mic, MicOff, Video, VideoOff, Monitor, PhoneOff, MessageSquare, 
  Brain, Users, Send, Bot, Play, Square, Loader2 
} from 'lucide-react';
import { api, type Meeting } from '../services/api';
import GeminiLivePanel from '../components/GeminiLivePanel';

interface Peer {
  id: string;
  userName: string;
  stream?: MediaStream;
}

export default function MeetingRoom() {
  const { id: roomId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Media states
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);

  // Sidebar views: 'chat' | 'transcript' | 'none'
  const [activeSidebar, setActiveSidebar] = useState<'chat' | 'transcript' | 'none'>('chat');
  
  // WebRTC & Sockets state
  const socketRef = useRef<Socket | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const peersRef = useRef<{ [socketId: string]: RTCPeerConnection }>({});
  const [participants, setParticipants] = useState<Peer[]>([]);
  const [userName, setUserName] = useState('Tushar Patel');

  // Simulated participants (for quick local demo/testing)
  const [mockParticipants, setMockParticipants] = useState<string[]>([]);

  // Chat message & Transcript lists
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [messageText, setMessageText] = useState('');
  const [liveTranscripts, setLiveTranscripts] = useState<any[]>([]);

  // AI Speech/Listening status (for Gemini Live stub)
  const [isAiActive, setIsAiActive] = useState(false);
  const [aiSpeechState, setAiSpeechState] = useState<'idle' | 'listening' | 'speaking'>('idle');

  // Media Recording states
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  // RTC configuration
  const rtcConfig = {
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
  };

  useEffect(() => {
    // 1. Fetch meeting info
    if (roomId) {
      api.getMeetingById(roomId)
        .then(data => {
          setMeeting(data);
          setLoading(false);
        })
        .catch(err => {
          console.error(err);
          navigate('/');
        });
    }

    // 2. Setup user media
    startLocalStream();

    // 3. Connect Socket.io
    const socket = io(import.meta.env.VITE_SOCKET_URL || window.location.origin);
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('Socket.io connected:', socket.id);
      socket.emit('join-room', { 
        roomId, 
        userName: 'Tushar Patel', 
        userEmail: 'tushar@gmail.com' 
      });
    });

    // Receive other users currently in room
    socket.on('all-users', async (users: { id: string; userName: string }[]) => {
      const peerList: Peer[] = [];
      for (const u of users) {
        // Create Peer connection for each existing user
        const pc = createPeerConnection(u.id, u.userName);
        peersRef.current[u.id] = pc;
        
        // Add local tracks to peer connection
        if (localStream) {
          localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
        }

        // Create offer
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit('offer', { targetId: u.id, sdp: pc.localDescription });

        peerList.push({ id: u.id, userName: u.userName });
      }
      setParticipants(peerList);
    });

    // Handle new user joined
    socket.on('user-joined', ({ id, userName }) => {
      console.log('User joined room:', userName);
      const pc = createPeerConnection(id, userName);
      peersRef.current[id] = pc;
      
      if (localStream) {
        localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
      }

      setParticipants(prev => {
        if (prev.find(p => p.id === id)) return prev;
        return [...prev, { id, userName }];
      });
    });

    // Handle received SDP Offer
    socket.on('offer', async ({ senderId, sdp }) => {
      const pc = peersRef.current[senderId];
      if (pc) {
        await pc.setRemoteDescription(new RTCSessionDescription(sdp));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit('answer', { targetId: senderId, sdp: pc.localDescription });
      }
    });

    // Handle received SDP Answer
    socket.on('answer', async ({ senderId, sdp }) => {
      const pc = peersRef.current[senderId];
      if (pc) {
        await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      }
    });

    // Handle ICE Candidates
    socket.on('ice-candidate', async ({ senderId, candidate }) => {
      const pc = peersRef.current[senderId];
      if (pc) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (e) {
          console.error('Error adding ICE candidate', e);
        }
      }
    });

    // Handle participant left
    socket.on('user-left', (socketId) => {
      console.log('User left room:', socketId);
      if (peersRef.current[socketId]) {
        peersRef.current[socketId].close();
        delete peersRef.current[socketId];
      }
      setParticipants(prev => prev.filter(p => p.id !== socketId));
    });

    // Chat events
    socket.on('chat-message', (msg) => {
      setChatMessages(prev => [...prev, msg]);
    });

    // Transcription events
    socket.on('live-transcript', (chunk) => {
      setLiveTranscripts(prev => [...prev, chunk]);
    });

    // 4. Setup HTML5 Speech Recognition to transcribe local user voice
    let recognition: any = null;
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = false;
      recognition.lang = 'en-US';
      
      recognition.onresult = (event: any) => {
        const result = event.results[event.results.length - 1];
        if (result.isFinal) {
          const transcriptText = result[0].transcript.trim();
          if (transcriptText) {
            console.log('🗣️ Transcribed locally:', transcriptText);
            socket.emit('transcript-chunk', { text: transcriptText });
            
            // Display locally
            setLiveTranscripts(prev => [
              ...prev,
              { sender: 'Tushar Patel', text: transcriptText }
            ]);
          }
        }
      };

      recognition.onend = () => {
        // Auto-restart speech recognition to keep it continuous
        if (socket.connected) {
          try {
            recognition.start();
          } catch (e) {
            console.log('Speech recognition restart failed:', e);
          }
        }
      };

      try {
        recognition.start();
      } catch (err) {
        console.warn('Failed to start speech recognition:', err);
      }
    }

    return () => {
      socket.disconnect();
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }
      Object.values(peersRef.current).forEach(pc => pc.close());
      if (recognition) {
        try {
          recognition.onend = null;
          recognition.stop();
        } catch (e) {}
      }
    };
  }, [roomId]);

  // Restart tracks when localStream changes
  useEffect(() => {
    if (localStream && localVideoRef.current) {
      localVideoRef.current.srcObject = localStream;
      
      // Update all peer connections with new tracks
      Object.keys(peersRef.current).forEach(peerId => {
        const pc = peersRef.current[peerId];
        const senders = pc.getSenders();
        senders.forEach(sender => pc.removeTrack(sender));
        localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
      });
    }
  }, [localStream]);

  // Create Peer Connection helper
  const createPeerConnection = (targetId: string, peerName: string): RTCPeerConnection => {
    const pc = new RTCPeerConnection(rtcConfig);

    pc.onicecandidate = (event) => {
      if (event.candidate && socketRef.current) {
        socketRef.current.emit('ice-candidate', {
          targetId,
          candidate: event.candidate,
        });
      }
    };

    pc.ontrack = (event) => {
      console.log('Received remote stream track from', peerName);
      setParticipants(prev => {
        return prev.map(p => {
          if (p.id === targetId) {
            return { ...p, stream: event.streams[0] };
          }
          return p;
        });
      });
    };

    return pc;
  };

  const startLocalStream = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: true
      });
      setLocalStream(stream);
      setIsVideoOff(false);
      setIsMuted(false);
    } catch (error) {
      console.error('Failed to get media devices. Stubbing with blank canvas stream.', error);
      // Create a canvas stream if no hardware webcam found (robustness helper)
      const canvas = document.createElement('canvas');
      canvas.width = 640;
      canvas.height = 480;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(0, 0, 640, 480);
      }
      const mockCanvasStream = canvas.captureStream(30);
      setLocalStream(mockCanvasStream);
      setIsVideoOff(true);
    }
  };

  const startRecording = () => {
    if (!localStream) return;
    try {
      recordedChunksRef.current = [];
      const options = { mimeType: 'audio/webm;codecs=opus' };
      const recorder = new MediaRecorder(localStream, options);
      
      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };
      
      recorder.onstop = () => {
        console.log('Recording stopped locally.');
      };
      
      mediaRecorderRef.current = recorder;
      recorder.start(1000); // Collect in 1-second slices
      setIsRecording(true);
    } catch (err) {
      console.error('Failed to start MediaRecorder:', err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const stopAndUploadRecording = (): Promise<string | null> => {
    return new Promise((resolve) => {
      if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') {
        resolve(null);
        return;
      }
      
      mediaRecorderRef.current.onstop = async () => {
        const blob = new Blob(recordedChunksRef.current, { type: 'audio/webm' });
        if (blob.size === 0) {
          resolve(null);
          return;
        }
        
        console.log('Assembled audio recording blob. Size:', blob.size, 'bytes. Uploading...');
        const formData = new FormData();
        formData.append('audio', blob, `${roomId}.webm`);
        
        try {
          const token = localStorage.getItem('token');
          const baseUrl = import.meta.env.VITE_API_BASE_URL || '/api';
          const res = await fetch(`${baseUrl}/meetings/${roomId}/recording`, {
            method: 'POST',
            headers: {
              ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
            },
            body: formData
          });
          if (res.ok) {
            const data = await res.json();
            console.log('✅ Recording uploaded successfully:', data.recordingUrl);
            resolve(data.recordingUrl);
          } else {
            console.error('Failed to upload recording:', await res.text());
            resolve(null);
          }
        } catch (err) {
          console.error('Error uploading recording:', err);
          resolve(null);
        }
      };
      
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    });
  };

  // Toggle Mic
  const toggleMute = () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
        socketRef.current?.emit('toggle-audio', { isMuted: !audioTrack.enabled });
      }
    }
  };

  // Toggle Camera
  const toggleVideo = () => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoOff(!videoTrack.enabled);
        socketRef.current?.emit('toggle-video', { isVideoOff: !videoTrack.enabled });
      }
    }
  };

  // Toggle Screen Sharing
  const toggleScreenShare = async () => {
    if (isScreenSharing) {
      // Go back to standard camera
      await startLocalStream();
      setIsScreenSharing(false);
    } else {
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: true
        });
        setLocalStream(stream);
        setIsScreenSharing(true);
        // Listen for user closing screenshare using browser's floating toolbar
        stream.getVideoTracks()[0].onended = () => {
          startLocalStream();
          setIsScreenSharing(false);
        };
      } catch (err) {
        console.error(err);
      }
    }
  };

  // Send Chat message
  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageText.trim()) return;

    const msg = { text: messageText };
    socketRef.current?.emit('chat-message', msg);
    
    // Optimistic self display
    setChatMessages(prev => [
      ...prev,
      {
        id: Math.random().toString(),
        sender: 'Tushar Patel',
        text: messageText,
        timestamp: new Date()
      }
    ]);
    setMessageText('');
  };

  // Simulator to spawn mock users (perfect for demo!)
  const spawnMockParticipant = () => {
    const list = ['Rahul', 'Priya'];
    const currentList = [...mockParticipants];
    
    if (currentList.length >= list.length) return;
    const nextMock = list[currentList.length];
    
    setMockParticipants([...currentList, nextMock]);
    
    // Broadcast message that they joined
    setChatMessages(prev => [
      ...prev,
      {
        id: Math.random().toString(),
        sender: 'System',
        text: `${nextMock} has joined the meeting (Simulator).`,
        timestamp: new Date()
      }
    ]);

    // Send a message after 3 seconds
    setTimeout(() => {
      setChatMessages(prev => [
        ...prev,
        {
          id: Math.random().toString(),
          sender: nextMock,
          text: nextMock === 'Rahul' ? "Hey Tushar, we should decide whether we should use PostgreSQL or MongoDB." : "Agreed, let's lock the architecture deadline too.",
          timestamp: new Date()
        }
      ]);

      // Add to transcript
      api.appendTranscript(roomId!, nextMock, nextMock === 'Rahul' ? "Let's decide whether we should use PostgreSQL or MongoDB." : "Agreed, let's lock the architecture deadline too.");
      
      // Update transcripts locally
      setLiveTranscripts(prev => [
        ...prev,
        { sender: nextMock, text: nextMock === 'Rahul' ? "Let's decide whether we should use PostgreSQL or MongoDB." : "Agreed, let's lock the architecture deadline too." }
      ]);
    }, 3000);
  };

  // AI Speech simulation helper (Gemini Live interaction mockup)
  const triggerAiSpeak = () => {
    if (isAiActive) {
      setIsAiActive(false);
      setAiSpeechState('idle');
      return;
    }

    setIsAiActive(true);
    setAiSpeechState('listening');

    setTimeout(() => {
      setAiSpeechState('speaking');
      const responseText = "Based on the team's feedback, PostgreSQL is highly recommended because you need transaction support, complex relationships, and AWS relational database hosting aligns with it.";
      
      // Append transcript
      api.appendTranscript(roomId!, 'MeetMind AI', responseText);
      setLiveTranscripts(prev => [...prev, { sender: 'MeetMind AI', text: responseText }]);

      // Add to chat
      setChatMessages(prev => [
        ...prev,
        {
          id: Math.random().toString(),
          sender: '🤖 MeetMind AI',
          text: responseText,
          timestamp: new Date()
        }
      ]);

      // Complete speech
      setTimeout(() => {
        setAiSpeechState('listening');
      }, 5000);
    }, 4000);
  };

  // End Meeting handler
  const [endingMeeting, setEndingMeeting] = useState(false);
  const handleEndMeeting = async () => {
    if (!roomId) return;
    if (!confirm('Are you sure you want to end this meeting for all participants?')) return;
    
    setEndingMeeting(true);
    try {
      // 1. Upload audio recording if active
      await stopAndUploadRecording();

      // 2. Update status to ended
      await api.updateMeeting(roomId, { status: 'ended' });
      
      // 3. Call AI processing pipeline
      await api.processAISummary(roomId);
      
      // 4. Redirect to history page
      navigate(`/history/${roomId}`);
    } catch (err) {
      console.error(err);
      navigate('/');
    } finally {
      setEndingMeeting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-dark-950">
        <Loader2 className="w-8 h-8 text-brand-500 animate-spin" />
      </div>
    );
  }

  // Combine real WebRTC participants and mock participants for grid sizing
  const totalVideoCells = 1 + participants.length + mockParticipants.length;

  return (
    <div className="min-h-screen bg-dark-950 flex flex-col overflow-hidden h-screen text-sm">
      
      {/* Top Header */}
      <header className="h-14 border-b border-dark-800/40 bg-dark-900/40 px-6 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-xs font-extrabold px-2 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20 live-glow uppercase tracking-wider">
            Live
          </span>
          <h1 className="font-bold text-white truncate max-w-[200px] sm:max-w-xs">{meeting?.title}</h1>
        </div>

        {/* Demo Toolbar */}
        <div className="flex items-center gap-3">
          {mockParticipants.length < 2 && (
            <button 
              onClick={spawnMockParticipant}
              className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-dark-800 hover:bg-dark-700 text-brand-400 hover:text-brand-300 font-semibold text-xs border border-dark-700"
            >
              <Bot className="w-3.5 h-3.5" />
              <span>Simulate Peer</span>
            </button>
          )}

          <div className="text-xs text-dark-400 max-sm:hidden">
            Room Code: <span className="font-mono text-dark-300 font-bold select-all">{roomId?.substring(0, 8)}</span>
          </div>
        </div>
      </header>

      {/* Main workspace (Grid + Sidebar) */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* Videos Grid */}
        <div className="flex-1 p-6 flex items-center justify-center bg-dark-950/40 relative overflow-y-auto">
          
          <div className={`w-full max-w-5xl grid gap-4 ${
            totalVideoCells === 1 ? 'grid-cols-1 max-w-xl' :
            totalVideoCells === 2 ? 'grid-cols-1 md:grid-cols-2 max-w-3xl' :
            'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
          }`}>
            
            {/* Local participant (Tushar) */}
            <div className="relative aspect-video rounded-2xl overflow-hidden bg-dark-900 border border-dark-800 shadow-xl group">
              <video 
                ref={localVideoRef} 
                autoPlay 
                playsInline 
                muted 
                className="w-full h-full object-cover transform -scale-x-100"
              />
              {isVideoOff && (
                <div className="absolute inset-0 bg-dark-900 flex flex-col items-center justify-center gap-3">
                  <div className="w-16 h-16 rounded-full bg-brand-500/10 flex items-center justify-center border border-brand-500/20">
                    <span className="text-xl font-bold text-brand-400">TP</span>
                  </div>
                  <span className="text-xs text-dark-400 font-medium">Your camera is off</span>
                </div>
              )}
              
              <div className="absolute bottom-4 left-4 bg-dark-950/80 backdrop-blur-md px-3.5 py-1.5 rounded-xl border border-dark-800/40 flex items-center gap-2">
                <span className="text-xs font-semibold text-white">Tushar Patel (You)</span>
                {isMuted && <MicOff className="w-3.5 h-3.5 text-red-400" />}
              </div>
            </div>

            {/* Real WebRTC peers */}
            {participants.map(p => (
              <div key={p.id} className="relative aspect-video rounded-2xl overflow-hidden bg-dark-900 border border-dark-800 shadow-xl">
                {p.stream ? (
                  <video
                    ref={el => {
                      if (el && p.stream) el.srcObject = p.stream;
                    }}
                    autoPlay
                    playsInline
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="absolute inset-0 bg-dark-900 flex flex-col items-center justify-center gap-3">
                    <div className="w-16 h-16 rounded-full bg-dark-800 flex items-center justify-center">
                      <span className="text-xl font-bold text-dark-300">
                        {p.userName.split(' ').map(n=>n[0]).join('')}
                      </span>
                    </div>
                    <span className="text-xs text-dark-400 font-medium">{p.userName}</span>
                  </div>
                )}

                <div className="absolute bottom-4 left-4 bg-dark-950/80 backdrop-blur-md px-3.5 py-1.5 rounded-xl border border-dark-800/40">
                  <span className="text-xs font-semibold text-white">{p.userName}</span>
                </div>
              </div>
            ))}

            {/* Mocked simulation peers */}
            {mockParticipants.map(name => (
              <div key={name} className="relative aspect-video rounded-2xl overflow-hidden bg-dark-900 border border-dark-800 shadow-xl group">
                <div className="absolute inset-0 bg-gradient-to-tr from-brand-950/20 to-dark-900 flex flex-col items-center justify-center gap-3">
                  <div className="w-16 h-16 rounded-full bg-brand-500/10 flex items-center justify-center border border-brand-500/20 relative">
                    <span className="text-xl font-bold text-brand-400">{name[0]}</span>
                    <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-green-500 border-2 border-dark-900" />
                  </div>
                  <span className="text-xs text-dark-300 font-bold">{name}</span>
                  <span className="text-[10px] text-brand-400/80 font-medium bg-brand-500/5 px-2 py-0.5 rounded border border-brand-500/10">Active Speaker</span>
                </div>

                <div className="absolute bottom-4 left-4 bg-dark-950/80 backdrop-blur-md px-3.5 py-1.5 rounded-xl border border-dark-800/40 flex items-center gap-2">
                  <span className="text-xs font-semibold text-white">{name} (Demo Peer)</span>
                </div>
              </div>
            ))}

          </div>
        </div>

        {/* Dynamic Sidebar Panel */}
        {activeSidebar !== 'none' && (
          <aside className="w-80 border-l border-dark-800/40 bg-dark-900/60 backdrop-blur-md flex flex-col shrink-0">
            {/* Header selection tabs */}
            <div className="flex border-b border-dark-800/40 h-12">
              <button 
                onClick={() => setActiveSidebar('chat')}
                className={`flex-1 flex items-center justify-center gap-2 text-xs font-bold ${
                  activeSidebar === 'chat' ? 'text-brand-400 border-b-2 border-brand-500' : 'text-dark-400 hover:text-white'
                }`}
              >
                <MessageSquare className="w-4 h-4" />
                <span>Chat</span>
              </button>
              
              <button 
                onClick={() => setActiveSidebar('transcript')}
                className={`flex-1 flex items-center justify-center gap-2 text-xs font-bold ${
                  activeSidebar === 'transcript' ? 'text-brand-400 border-b-2 border-brand-500' : 'text-dark-400 hover:text-white'
                }`}
              >
                <Brain className="w-4 h-4" />
                <span>Live Notes</span>
              </button>
            </div>

            {/* Sidebar content render */}
            {activeSidebar === 'chat' ? (
              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="flex-1 p-4 overflow-y-auto space-y-3">
                  {chatMessages.map(m => (
                    <div key={m.id} className="space-y-1">
                      <div className="flex items-baseline gap-2">
                        <span className="text-xs font-bold text-white">{m.sender}</span>
                        <span className="text-[10px] text-dark-500">
                          {new Date(m.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </span>
                      </div>
                      <div className="bg-dark-800/50 border border-dark-800 rounded-xl px-3 py-2 text-dark-200">
                        {m.text}
                      </div>
                    </div>
                  ))}
                </div>

                <form onSubmit={handleSendMessage} className="p-4 border-t border-dark-800/40 flex items-center gap-2 shrink-0">
                  <input 
                    type="text" 
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    placeholder="Type message..." 
                    className="flex-1 bg-dark-950 border border-dark-800 rounded-xl px-3 py-2 text-white placeholder-dark-500 focus:outline-none focus:border-brand-500 text-xs"
                  />
                  <button 
                    type="submit" 
                    className="p-2 rounded-xl bg-brand-500 hover:bg-brand-600 text-white shrink-0"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </form>
              </div>
            ) : (
              <div className="flex-1 flex flex-col overflow-hidden p-4">
                <h3 className="text-xs font-bold text-dark-400 mb-3 uppercase tracking-wider">Live Transcription Stream</h3>
                <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                  {liveTranscripts.length === 0 ? (
                    <p className="text-xs text-dark-500 text-center py-10">Waiting for discussion points to transcribe...</p>
                  ) : (
                    liveTranscripts.map((t, idx) => (
                      <div key={idx} className="bg-brand-950/20 border border-brand-500/10 rounded-xl p-3 space-y-1">
                        <p className="text-[10px] font-bold text-brand-400">{t.sender}</p>
                        <p className="text-xs text-dark-200">{t.text}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </aside>
        )}
      </div>

      {/* Gemini Live Panel */}
      {isAiActive && (
        <GeminiLivePanel 
          onClose={() => setIsAiActive(false)} 
          roomId={roomId!} 
          localStream={localStream}
        />
      )}

      {/* Bottom control bar */}
      <footer className="h-16 border-t border-dark-800/40 bg-dark-900/40 px-6 flex items-center justify-between shrink-0">
        
        {/* Left Side: Users Count */}
        <div className="flex items-center gap-2 text-dark-300">
          <Users className="w-4 h-4 text-brand-400" />
          <span className="text-xs font-semibold">{totalVideoCells} Active</span>
        </div>

        {/* Center: Controls Buttons */}
        <div className="flex items-center gap-3">
          <button 
            onClick={toggleMute}
            className={`p-3 rounded-xl border transition-all ${
              isMuted 
                ? 'bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/25' 
                : 'bg-dark-800/80 border-dark-700/50 text-dark-200 hover:bg-dark-700'
            }`}
          >
            {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>

          <button 
            onClick={toggleVideo}
            className={`p-3 rounded-xl border transition-all ${
              isVideoOff 
                ? 'bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/25' 
                : 'bg-dark-800/80 border-dark-700/50 text-dark-200 hover:bg-dark-700'
            }`}
          >
            {isVideoOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
          </button>

          <button 
            onClick={toggleScreenShare}
            className={`p-3 rounded-xl border transition-all ${
              isScreenSharing 
                ? 'bg-brand-500 border-brand-600 text-white' 
                : 'bg-dark-800/80 border-dark-700/50 text-dark-200 hover:bg-dark-700'
            }`}
          >
            <Monitor className="w-5 h-5" />
          </button>

          <button 
            onClick={() => setIsAiActive(!isAiActive)}
            className={`flex items-center gap-1.5 px-4 py-3 rounded-xl border font-bold text-xs ${
              isAiActive 
                ? 'bg-brand-500 border-brand-600 text-white live-glow' 
                : 'bg-dark-900 border-dark-800 text-brand-400 hover:bg-dark-850'
            }`}
          >
            <Bot className="w-4 h-4" />
            <span>🤖 {isAiActive ? 'Active AI' : 'Ask AI'}</span>
          </button>

          <button 
            onClick={isRecording ? stopRecording : startRecording}
            className={`flex items-center gap-1.5 px-4 py-3 rounded-xl border font-bold text-xs transition-all ${
              isRecording 
                ? 'bg-red-500 border-red-600 text-white animate-pulse' 
                : 'bg-dark-900 border-dark-800 text-red-400 hover:bg-dark-850'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0 inline-block animate-ping" style={{ display: isRecording ? 'inline-block' : 'none' }} />
            <span>{isRecording ? 'Stop Recording' : '🔴 Record'}</span>
          </button>

          <button 
            onClick={handleEndMeeting}
            disabled={endingMeeting}
            className="flex items-center gap-1.5 px-4 py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-lg shadow-red-600/10 disabled:bg-red-600/60"
          >
            {endingMeeting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <PhoneOff className="w-4 h-4" />
                <span>End Meeting</span>
              </>
            )}
          </button>
        </div>

        {/* Right Side: Toggle Sidebar drawer */}
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setActiveSidebar(activeSidebar === 'chat' ? 'none' : 'chat')}
            className={`p-2 rounded-lg text-dark-400 hover:text-white ${activeSidebar === 'chat' ? 'bg-dark-800 text-brand-400' : ''}`}
          >
            <MessageSquare className="w-4 h-4" />
          </button>
          
          <button 
            onClick={() => setActiveSidebar(activeSidebar === 'transcript' ? 'none' : 'transcript')}
            className={`p-2 rounded-lg text-dark-400 hover:text-white ${activeSidebar === 'transcript' ? 'bg-dark-800 text-brand-400' : ''}`}
          >
            <Brain className="w-4 h-4" />
          </button>
        </div>
      </footer>
    </div>
  );
}
