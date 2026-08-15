export interface IUser {
  _id: string;
  name: string;
  email: string;
  password?: string;
  avatar: string;
  googleTokens?: any;
  createdAt?: Date;
}

export interface ITranscriptLine {
  sender: string;
  text: string;
  timestamp: Date;
}

export interface IActionItem {
  person: string;
  task: string;
  deadline?: string;
  completed?: boolean;
}

export interface IMeeting {
  _id: string;
  title: string;
  description?: string;
  startTime: Date;
  endTime: Date;
  createdBy: string; // User ID
  participants: string[]; // Email list
  folderId?: string | null;
  status: 'scheduled' | 'live' | 'ended';
  transcript: ITranscriptLine[];
  summary?: string;
  decisions?: string[];
  actionItems?: IActionItem[];
  questions?: string[];
  calendarEventId?: string | null;
  recordingUrl?: string;
  createdAt?: Date;
}

export interface IFolder {
  _id: string;
  name: string;
  owner: string; // User ID
  meetings: string[]; // Meeting IDs
  createdAt?: Date;
}
