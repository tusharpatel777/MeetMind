const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

export interface User {
  id: string;
  name: string;
  email: string;
  avatar: string;
}

export interface TranscriptLine {
  sender: string;
  text: string;
  timestamp: string;
}

export interface ActionItem {
  person: string;
  task: string;
  deadline?: string;
  completed?: boolean;
}

export interface Meeting {
  _id: string;
  title: string;
  description?: string;
  startTime: string;
  endTime: string;
  createdBy: string;
  participants: string[];
  folderId?: string | null;
  status: 'scheduled' | 'live' | 'ended';
  transcript: TranscriptLine[];
  summary?: string;
  decisions?: string[];
  actionItems?: ActionItem[];
  questions?: string[];
  calendarEventId?: string | null;
  recordingUrl?: string;
  createdAt?: string;
}

export interface Folder {
  _id: string;
  name: string;
  owner: string;
  meetings: string[];
  createdAt?: string;
}

// Token helper
const getHeaders = () => {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
  };
};

export const api = {
  async getCurrentUser(): Promise<User> {
    const res = await fetch(`${API_BASE_URL}/auth/me`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Auth validation failed');
    const data = await res.json();
    return data.user;
  },

  async localLogin(email: string, password: string): Promise<{ token: string; user: User }> {
    const res = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Failed to login');
    }
    return res.json();
  },

  async localRegister(name: string, email: string, password: string): Promise<{ token: string; user: User }> {
    const res = await fetch(`${API_BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Failed to register');
    }
    return res.json();
  },

  async googleLogin(credential: string): Promise<{ token: string; user: User }> {
    const res = await fetch(`${API_BASE_URL}/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credential }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Failed to login via Google');
    }
    return res.json();
  },

  // Meetings CRUD
  async getMeetings(): Promise<Meeting[]> {
    const res = await fetch(`${API_BASE_URL}/meetings`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch meetings');
    return res.json();
  },

  async getMeetingById(id: string): Promise<Meeting> {
    const res = await fetch(`${API_BASE_URL}/meetings/${id}`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch meeting details');
    return res.json();
  },

  async createMeeting(meetingData: Omit<Meeting, '_id' | 'createdBy' | 'transcript' | 'status' | 'createdAt'>): Promise<Meeting> {
    const res = await fetch(`${API_BASE_URL}/meetings`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(meetingData),
    });
    if (!res.ok) throw new Error('Failed to create meeting');
    return res.json();
  },

  async updateMeeting(id: string, updateData: Partial<Meeting>): Promise<Meeting> {
    const res = await fetch(`${API_BASE_URL}/meetings/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(updateData),
    });
    if (!res.ok) throw new Error('Failed to update meeting');
    return res.json();
  },

  async deleteMeeting(id: string): Promise<boolean> {
    const res = await fetch(`${API_BASE_URL}/meetings/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to delete meeting');
    const data = await res.json();
    return data.success;
  },

  async toggleActionItem(meetingId: string, actionIdx: number): Promise<Meeting> {
    const res = await fetch(`${API_BASE_URL}/meetings/${meetingId}/actions/${actionIdx}/toggle`, {
      method: 'POST',
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to toggle action item');
    return res.json();
  },

  // Folders CRUD
  async getFolders(): Promise<Folder[]> {
    const res = await fetch(`${API_BASE_URL}/folders`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch folders');
    return res.json();
  },

  async createFolder(name: string): Promise<Folder> {
    const res = await fetch(`${API_BASE_URL}/folders`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ name }),
    });
    if (!res.ok) throw new Error('Failed to create folder');
    return res.json();
  },

  async deleteFolder(id: string): Promise<boolean> {
    const res = await fetch(`${API_BASE_URL}/folders/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to delete folder');
    const data = await res.json();
    return data.success;
  },

  // Transcript
  async appendTranscript(meetingId: string, sender: string, text: string): Promise<Meeting> {
    const res = await fetch(`${API_BASE_URL}/meetings/${meetingId}/transcript`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ sender, text }),
    });
    if (!res.ok) throw new Error('Failed to append transcript line');
    return res.json();
  },

  // Process AI Summary (Triggered when ending the meeting)
  async processAISummary(meetingId: string): Promise<Meeting> {
    const res = await fetch(`${API_BASE_URL}/meetings/${meetingId}/process-ai`, {
      method: 'POST',
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to generate meeting intelligence');
    return res.json();
  },

  // AI Semantic Search RAG
  async searchMeetings(query: string): Promise<{ answer: string; matches: { meeting: Meeting; relevance: number; snippet: string }[] }> {
    const res = await fetch(`${API_BASE_URL}/search?q=${encodeURIComponent(query)}`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Search request failed');
    return res.json();
  }
};

