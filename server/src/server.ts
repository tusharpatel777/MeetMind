import express from 'express';
import http from 'http';
import { Server, Socket } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import { connectDB } from './config/db';
import { dbStore } from './services/dbStore';
import { authMiddleware, AuthenticatedRequest } from './middleware/auth';
import { GeminiService } from './services/gemini.service';
import { RAGService } from './services/rag.service';
import { WebSocketServer } from 'ws';
import { handleLiveAiConnection } from './services/liveAiProxy';
import { CalendarService } from './services/calendar.service';
import Redis from 'ioredis';

dotenv.config();

const app = express();

// Ensure uploads/recordings directory exists
const uploadDir = path.join(__dirname, '../uploads/recordings');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Set up static files hosting for uploads
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Configure Multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, `${req.params.id}.webm`);
  }
});

const upload = multer({ storage });
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
  }
});

const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'meetmind_secret_key_123';

app.use(cors());
app.use(express.json());

// Basic API check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date() });
});

// Authentication Routes
app.post('/api/auth/register', async (req, res) => {
  const { name, email, password } = req.body;
  try {
    const existing = await dbStore.findUserByEmail(email);
    if (existing) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await dbStore.createUser({
      name,
      email,
      password: hashedPassword,
      avatar: `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(name)}`
    });
    const token = jwt.sign({ id: user._id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ token, user: { id: user._id, name: user.name, email: user.email, avatar: user.avatar } });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await dbStore.findUserByEmail(email);
    if (!user || !user.password) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    const token = jwt.sign({ id: user._id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user._id, name: user.name, email: user.email, avatar: user.avatar } });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/auth/me', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const user = await dbStore.findUserById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ user: { id: user._id, name: user.name, email: user.email, avatar: user.avatar } });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/auth/google', async (req, res) => {
  const { credential } = req.body;
  if (!credential) {
    return res.status(400).json({ error: 'Credential ID token is required' });
  }

  try {
    let email: string;
    let name: string;
    let picture: string;

    if (credential.startsWith('mock_google_id_token_')) {
      // Sandbox bypass
      email = 'tushar@gmail.com';
      name = 'Tushar Patel';
      picture = 'https://api.dicebear.com/7.x/adventurer/svg?seed=Tushar';
    } else {
      // Call Google's tokeninfo REST API to verify the identity token securely
      const verifyRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${credential}`);
      if (!verifyRes.ok) {
        const errText = await verifyRes.text();
        console.error('Google token verification failed:', errText);
        return res.status(401).json({ error: 'Google authentication failed' });
      }

      const payload = (await verifyRes.json()) as any;
      email = payload.email;
      name = payload.name;
      picture = payload.picture;
    }

    if (!email) {
      return res.status(400).json({ error: 'Email profile scope is required' });
    }

    // Find or create the user in database
    let user = await dbStore.findUserByEmail(email);
    if (!user) {
      user = await dbStore.createUser({
        name: name || email.split('@')[0],
        email: email,
        avatar: picture || `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(email)}`,
      });
    }

    // Create session JWT
    const token = jwt.sign({ id: user._id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user._id, name: user.name, email: user.email, avatar: user.avatar } });
  } catch (error: any) {
    console.error('Google Auth Route Error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/meetings/:id/recording', authMiddleware, upload.single('audio'), async (req, res) => {
  try {
    const meetingId = req.params.id;
    const meeting = await dbStore.getMeetingById(meetingId);
    if (!meeting) {
      return res.status(404).json({ error: 'Meeting not found' });
    }

    const host = process.env.BACKEND_URL || `${req.protocol}://${req.get('host')}`;
    const recordingUrl = `${host}/uploads/recordings/${meetingId}.webm`;
    const updated = await dbStore.updateMeeting(meetingId, { recordingUrl });
    
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Folders Routes
app.get('/api/folders', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user?.id || 'default-user-id';
    const folders = await dbStore.getFolders(userId);
    res.json(folders);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/folders', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user?.id || 'default-user-id';
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Folder name is required' });
    const folder = await dbStore.createFolder({ name, owner: userId, meetings: [] });
    res.status(201).json(folder);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/folders/:id', authMiddleware, async (req, res) => {
  try {
    const deleted = await dbStore.deleteFolder(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Folder not found' });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Meetings Routes
app.get('/api/meetings', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user?.id || 'default-user-id';
    const meetings = await dbStore.getMeetings(userId);
    res.json(meetings);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/meetings/:id', authMiddleware, async (req, res) => {
  try {
    const meeting = await dbStore.getMeetingById(req.params.id);
    if (!meeting) return res.status(404).json({ error: 'Meeting not found' });
    res.json(meeting);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/meetings', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user?.id || 'default-user-id';
    const { title, description, startTime, endTime, participants, folderId } = req.body;
    
    if (!title || !startTime || !endTime) {
      return res.status(400).json({ error: 'Title, startTime, and endTime are required' });
    }

    const user = await dbStore.findUserById(userId);
    let calendarEventId = null;
    let finalDesc = description || '';

    const newMeetingData = {
      title,
      description: finalDesc,
      startTime: new Date(startTime),
      endTime: new Date(endTime),
      createdBy: userId,
      participants: participants || [],
      folderId: folderId || null,
      status: 'scheduled' as const,
      transcript: [],
      calendarEventId: null as string | null
    };

    if (user && user.googleTokens) {
      try {
        const cal = await CalendarService.createEvent(newMeetingData as any, user.googleTokens);
        newMeetingData.calendarEventId = cal.calendarEventId;
        newMeetingData.description = `${finalDesc}\n\nGoogle Meet: ${cal.meetLink}`;
      } catch (err) {
        console.warn('Failed to sync Google Calendar event:', err);
      }
    }

    const meeting = await dbStore.createMeeting(newMeetingData);
    res.status(201).json(meeting);
  } catch (error: any) {
    console.error('❌ Error creating meeting:', error);
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/meetings/:id', authMiddleware, async (req, res) => {
  try {
    const updated = await dbStore.updateMeeting(req.params.id, req.body);
    if (!updated) return res.status(404).json({ error: 'Meeting not found' });
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/meetings/:id', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const meeting = await dbStore.getMeetingById(req.params.id);
    if (!meeting) return res.status(404).json({ error: 'Meeting not found' });

    // Enforce creator validation (only the user who scheduled the meeting can delete it)
    if (meeting.createdBy !== userId) {
      return res.status(403).json({ error: 'Forbidden: Only the creator of the meeting can delete it' });
    }

    // Cancel Google Calendar Event if sync details exist
    if (meeting.calendarEventId) {
      const user = await dbStore.findUserById(meeting.createdBy);
      if (user && user.googleTokens) {
        await CalendarService.deleteEvent(meeting.calendarEventId, user.googleTokens);
      }
    }

    // Delete the audio recording file if it exists on disk
    const recordingPath = path.join(__dirname, `../uploads/recordings/${req.params.id}.webm`);
    if (fs.existsSync(recordingPath)) {
      fs.unlinkSync(recordingPath);
    }

    const deleted = await dbStore.deleteMeeting(req.params.id);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Toggle action item completion status
app.post('/api/meetings/:id/actions/:actionIdx/toggle', authMiddleware, async (req, res) => {
  try {
    const meetingId = req.params.id;
    const actionIdx = parseInt(req.params.actionIdx, 10);
    
    const updated = await dbStore.toggleActionItem(meetingId, actionIdx);
    if (!updated) return res.status(404).json({ error: 'Meeting not found' });
    
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Transcript upload route
app.post('/api/meetings/:id/transcript', authMiddleware, async (req, res) => {
  try {
    const { sender, text } = req.body;
    if (!sender || !text) return res.status(400).json({ error: 'Sender and text are required' });
    
    const meeting = await dbStore.getMeetingById(req.params.id);
    if (!meeting) return res.status(404).json({ error: 'Meeting not found' });

    const newTranscriptLine = { sender, text, timestamp: new Date() };
    const updatedTranscript = [...(meeting.transcript || []), newTranscriptLine];

    const updated = await dbStore.updateMeeting(req.params.id, { transcript: updatedTranscript });
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Process AI Summary
app.post('/api/meetings/:id/process-ai', authMiddleware, async (req, res) => {
  try {
    const meeting = await dbStore.getMeetingById(req.params.id);
    if (!meeting) return res.status(404).json({ error: 'Meeting not found' });

    // Run Gemini transcription analysis
    const analysis = await GeminiService.analyzeTranscript(meeting.transcript || []);

    // Save summary outputs and transition meeting status to ended
    const updated = await dbStore.updateMeeting(req.params.id, {
      summary: analysis.summary,
      decisions: analysis.decisions,
      actionItems: analysis.actionItems,
      questions: analysis.questions,
      status: 'ended'
    });

    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// AI Semantic Search RAG endpoint
app.get('/api/search', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user?.id || 'default-user-id';
    const query = req.query.q as string;
    
    if (!query) {
      return res.status(451).json({ error: 'Query parameter q is required' });
    }

    const result = await RAGService.queryKnowledgeBase(userId, query);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Google Calendar OAuth Routes
app.get('/api/calendar/auth-url', authMiddleware, async (req, res) => {
  try {
    const url = CalendarService.getAuthUrl();
    res.json({ url });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/calendar/callback', async (req, res) => {
  try {
    const code = req.query.code as string;
    if (!code) return res.status(400).json({ error: 'Google OAuth code missing' });

    const tokens = await CalendarService.getTokensFromCode(code);
    
    // Store tokens against our developer user session
    await dbStore.updateUserTokens('default-user-id', tokens);

    // Redirect to dashboard with notification flag
    const host = process.env.FRONTEND_URL || `${req.protocol}://${req.get('host')}`;
    res.redirect(`${host}/?sync=success`);
  } catch (error: any) {
    res.status(500).send(`Authentication failed: ${error.message}`);
  }
});

// Serve React static files in production
const clientBuildPath = path.join(__dirname, '../../client/dist');
if (fs.existsSync(clientBuildPath)) {
  console.log('📦 Client bundle found. Mounting static file hosting.');
  app.use(express.static(clientBuildPath));
  
  // SPA routing fallback (must be placed AFTER all API routes!)
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/health') || req.path.startsWith('/uploads') || req.path.startsWith('/live-ai-proxy')) {
      return next();
    }
    res.sendFile(path.join(clientBuildPath, 'index.html'));
  });
}

// Socket.io Real-time Signaling Map
const rooms: { [roomId: string]: string[] } = {}; // roomId -> socketIds
const socketToRoom: { [socketId: string]: string } = {}; // socketId -> roomId
const socketToUser: { [socketId: string]: { name: string; email: string } } = {}; // socketId -> user details

io.on('connection', (socket: Socket) => {
  console.log(`🔌 New client connected: ${socket.id}`);

  socket.on('join-room', ({ roomId, userName, userEmail }) => {
    socketToUser[socket.id] = { name: userName || 'Anonymous', email: userEmail || '' };
    
    if (rooms[roomId]) {
      rooms[roomId].push(socket.id);
    } else {
      rooms[roomId] = [socket.id];
    }
    socketToRoom[socket.id] = roomId;
    socket.join(roomId);

    console.log(`👤 User ${userName} joined room ${roomId}. Active sockets in room:`, rooms[roomId]);

    // Send the list of existing participants in the room to the newly joined user
    const usersInRoom = rooms[roomId].filter(id => id !== socket.id).map(id => ({
      id,
      userName: socketToUser[id]?.name || 'Participant',
    }));
    socket.emit('all-users', usersInRoom);

    // Notify other participants in the room about the new user joining
    socket.to(roomId).emit('user-joined', {
      id: socket.id,
      userName: userName || 'Participant',
    });
  });

  // Relay WebRTC Offer
  socket.on('offer', ({ targetId, sdp }) => {
    io.to(targetId).emit('offer', {
      senderId: socket.id,
      sdp,
    });
  });

  // Relay WebRTC Answer
  socket.on('answer', ({ targetId, sdp }) => {
    io.to(targetId).emit('answer', {
      senderId: socket.id,
      sdp,
    });
  });

  // Relay ICE Candidates
  socket.on('ice-candidate', ({ targetId, candidate }) => {
    io.to(targetId).emit('ice-candidate', {
      senderId: socket.id,
      candidate,
    });
  });

  // Chat message relay
  socket.on('chat-message', (message) => {
    const roomId = socketToRoom[socket.id];
    if (roomId) {
      io.to(roomId).emit('chat-message', {
        id: Math.random().toString(),
        sender: socketToUser[socket.id]?.name || 'Participant',
        text: message.text,
        timestamp: new Date(),
      });
    }
  });

  // Live transcript stream
  socket.on('transcript-chunk', async ({ text }) => {
    const roomId = socketToRoom[socket.id];
    const user = socketToUser[socket.id];
    if (roomId && user) {
      // Broadcast transcript chunk in real-time to participants so they see live captions
      io.to(roomId).emit('live-transcript', {
        sender: user.name,
        text,
        timestamp: new Date()
      });

      // Append transcript to the active meeting database entry asynchronously
      try {
        const meeting = await dbStore.getMeetingById(roomId);
        if (meeting) {
          const updatedTranscript = [...(meeting.transcript || []), { sender: user.name, text, timestamp: new Date() }];
          await dbStore.updateMeeting(roomId, { transcript: updatedTranscript });
        }
      } catch (err) {
        console.error('Failed to auto-save transcript chunk:', err);
      }
    }
  });

  // Handle media changes (mute, camera toggle)
  socket.on('toggle-audio', ({ isMuted }) => {
    const roomId = socketToRoom[socket.id];
    if (roomId) {
      socket.to(roomId).emit('user-toggled-audio', { id: socket.id, isMuted });
    }
  });

  socket.on('toggle-video', ({ isVideoOff }) => {
    const roomId = socketToRoom[socket.id];
    if (roomId) {
      socket.to(roomId).emit('user-toggled-video', { id: socket.id, isVideoOff });
    }
  });

  // Disconnection cleanup
  socket.on('disconnect', () => {
    const roomId = socketToRoom[socket.id];
    console.log(`🔌 Client disconnected: ${socket.id} (Room: ${roomId})`);
    
    if (roomId) {
      let room = rooms[roomId];
      if (room) {
        room = room.filter(id => id !== socket.id);
        rooms[roomId] = room;
        if (room.length === 0) {
          delete rooms[roomId];
        }
      }
      socket.to(roomId).emit('user-left', socket.id);
      delete socketToRoom[socket.id];
    }
    delete socketToUser[socket.id];
  });
});

const wss = new WebSocketServer({ noServer: true });

wss.on('connection', (ws, request) => {
  handleLiveAiConnection(ws, request);
});

server.on('upgrade', (request, socket, head) => {
  const pathname = new URL(request.url || '', `http://${request.headers.host}`).pathname;
  if (pathname === '/live-ai-proxy') {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  }
});

async function startServer() {
  await connectDB();

  // Resilient Redis link
  if (process.env.REDIS_URL) {
    try {
      console.log('🔄 Connecting to Redis cluster...');
      const redis = new Redis(process.env.REDIS_URL, {
        maxRetriesPerRequest: 1,
        connectTimeout: 5000,
      });
      redis.on('connect', () => {
        console.log('✅ Redis connected successfully to Upstash Cloud!');
      });
      redis.on('error', (err) => {
        console.warn('⚠️ Redis connection error. Continuing in-memory fallback. Error:', err.message);
      });
    } catch (err: any) {
      console.warn('⚠️ Redis initialization failed. Error:', err.message);
    }
  }

  server.listen(PORT, () => {
    console.log(`🚀 MeetMind server listening on port ${PORT}`);
    
    // Keep-alive self-pinging routine to prevent Render from sleeping (every 14 minutes)
    const pingInterval = 14 * 60 * 1000;
    setInterval(async () => {
      const hostUrl = process.env.BACKEND_URL || `http://localhost:${PORT}`;
      try {
        const response = await fetch(`${hostUrl}/health`);
        console.log(`Keep-alive ping sent to ${hostUrl}/health. Status: ${response.status}`);
      } catch (error: any) {
        console.error('Keep-alive ping failed:', error.message);
      }
    }, pingInterval);
  });
}

startServer();
