import mongoose from 'mongoose';
import { isDbConnected } from '../config/db';
import { UserModel } from '../models/User';
import { MeetingModel } from '../models/Meeting';
import { FolderModel } from '../models/Folder';
import { IUser, IMeeting, IFolder } from '../models/types';

// In-memory fallback stores
let usersStore: IUser[] = [];
let meetingsStore: IMeeting[] = [];
let foldersStore: IFolder[] = [];

// Helper to generate IDs
const generateId = () => Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

// Seed some initial data for testing if in-memory or fallback
const seedInMemoryData = () => {
  if (usersStore.length === 0) {
    const defaultUser: IUser = {
      _id: 'default-user-id',
      name: 'Tushar Patel',
      email: 'tushar@gmail.com',
      avatar: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Tushar',
    };
    usersStore.push(defaultUser);

    const defaultFolder: IFolder = {
      _id: 'folder-work',
      name: 'Work',
      owner: 'default-user-id',
      meetings: ['meet-1', 'meet-2']
    };
    foldersStore.push(defaultFolder);
    foldersStore.push({
      _id: 'folder-projects',
      name: 'Projects',
      owner: 'default-user-id',
      meetings: []
    });

    const now = new Date();
    const meet1: IMeeting = {
      _id: 'meet-1',
      title: 'AI Product Discussion',
      description: 'Review architecture and design plans for MeetMind workspace.',
      startTime: new Date(now.getTime() - 24 * 60 * 60 * 1000), // yesterday
      endTime: new Date(now.getTime() - 23 * 60 * 60 * 1000),
      createdBy: 'default-user-id',
      participants: ['rahul@gmail.com', 'priya@gmail.com'],
      folderId: 'folder-work',
      status: 'ended',
      transcript: [
        { sender: 'Tushar Patel', text: 'Hey guys, let\'s discuss the database decision.', timestamp: new Date() },
        { sender: 'Rahul', text: 'I think PostgreSQL is better for relational data and transactions.', timestamp: new Date() },
        { sender: 'Priya', text: 'Yes, and we can use JWT for authentication.', timestamp: new Date() },
        { sender: 'Tushar Patel', text: 'Awesome, so PostgreSQL it is. Let\'s deploy to AWS.', timestamp: new Date() }
      ],
      summary: 'The team discussed database design, authentication, and deployment options. They finalized PostgreSQL, JWT auth, and AWS hosting.',
      decisions: ['PostgreSQL will be used for main database', 'JWT will handle session auth', 'Deployment will be on AWS'],
      actionItems: [
        { person: 'Tushar Patel', task: 'Setup PostgreSQL database', deadline: '2026-08-20' },
        { person: 'Rahul', task: 'Design API architecture', deadline: '2026-08-21' },
        { person: 'Priya', task: 'Create UI mockups in React', deadline: '2026-08-19' }
      ],
      questions: ['Which authentication provider for OAuth?', 'What is our monthly AWS budget limit?']
    };

    const meet2: IMeeting = {
      _id: 'meet-2',
      title: 'Sprint Planning',
      description: 'Plan the upcoming bi-weekly sprint deliverables.',
      startTime: new Date(now.getTime() - 4 * 60 * 60 * 1000), // today, 4 hrs ago
      endTime: new Date(now.getTime() - 3 * 60 * 60 * 1000),
      createdBy: 'default-user-id',
      participants: ['rahul@gmail.com'],
      folderId: 'folder-work',
      status: 'ended',
      transcript: [],
      summary: 'Sprint planning was conducted, detailing the task assignments for frontend components.',
      decisions: ['Focus is on completing WebRTC room features'],
      actionItems: [
        { person: 'Rahul', task: 'Create WebRTC signaling socket logic', deadline: '2026-08-18' }
      ]
    };

    const meetUpcoming: IMeeting = {
      _id: 'meet-upcoming',
      title: 'Product Discussion',
      description: 'Discuss client feedback on UI flow.',
      startTime: new Date(now.getTime() + 2 * 60 * 60 * 1000), // in 2 hours
      endTime: new Date(now.getTime() + 3 * 60 * 60 * 1000),
      createdBy: 'default-user-id',
      participants: ['rahul@gmail.com', 'priya@gmail.com', 'client@gmail.com'],
      folderId: null,
      status: 'scheduled',
      transcript: [],
    };

    meetingsStore.push(meet1, meet2, meetUpcoming);
  }
};

// Auto seed
seedInMemoryData();

export const dbStore = {
  // Users CRUD
  async findUserByEmail(email: string): Promise<IUser | null> {
    if (isDbConnected()) {
      return await UserModel.findOne({ email }).lean();
    }
    return usersStore.find(u => u.email === email) || null;
  },

  async createUser(userData: Partial<IUser> & { email: string; name: string }): Promise<IUser> {
    if (isDbConnected()) {
      const user = new UserModel(userData);
      await user.save();
      return user.toObject();
    }
    const newUser: IUser = {
      _id: userData._id || generateId(),
      name: userData.name,
      email: userData.email,
      password: userData.password,
      avatar: userData.avatar || `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(userData.name)}`,
      createdAt: new Date()
    };
    usersStore.push(newUser);
    return newUser;
  },

  async findUserById(id: string): Promise<IUser | null> {
    if (isDbConnected()) {
      // Validate ObjectId to prevent Casting Errors for local dev sessions
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return usersStore.find(u => u._id === id) || null;
      }
      return await UserModel.findById(id).lean();
    }
    return usersStore.find(u => u._id === id) || null;
  },

  async updateUserTokens(userId: string, tokens: any): Promise<IUser | null> {
    if (isDbConnected()) {
      if (!mongoose.Types.ObjectId.isValid(userId)) {
        const index = usersStore.findIndex(u => u._id === userId);
        if (index === -1) return null;
        usersStore[index].googleTokens = tokens;
        return usersStore[index];
      }
      return await UserModel.findByIdAndUpdate(userId, { googleTokens: tokens }, { new: true }).lean();
    }
    const index = usersStore.findIndex(u => u._id === userId);
    if (index === -1) return null;
    usersStore[index].googleTokens = tokens;
    return usersStore[index];
  },

  // Meetings CRUD
  async getMeetings(userId: string): Promise<IMeeting[]> {
    if (isDbConnected()) {
      return await MeetingModel.find({ createdBy: userId }).sort({ startTime: -1 }).lean();
    }
    return meetingsStore.filter(m => m.createdBy === userId).sort((a,b) => b.startTime.getTime() - a.startTime.getTime());
  },

  async getMeetingById(id: string): Promise<IMeeting | null> {
    if (isDbConnected()) {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return meetingsStore.find(m => m._id === id) || null;
      }
      return await MeetingModel.findById(id).lean();
    }
    return meetingsStore.find(m => m._id === id) || null;
  },

  async createMeeting(meetingData: Omit<IMeeting, '_id' | 'createdAt'>): Promise<IMeeting> {
    if (isDbConnected()) {
      const meeting = new MeetingModel(meetingData);
      await meeting.save();
      return meeting.toObject();
    }
    const newMeeting: IMeeting = {
      ...meetingData,
      _id: generateId(),
      transcript: meetingData.transcript || [],
      createdAt: new Date()
    };
    meetingsStore.push(newMeeting);
    
    // Update folder relationship if meeting has folderId
    if (newMeeting.folderId) {
      await this.addMeetingToFolder(newMeeting.folderId, newMeeting._id);
    }
    
    return newMeeting;
  },

  async updateMeeting(id: string, updateData: Partial<IMeeting>): Promise<IMeeting | null> {
    if (isDbConnected()) {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        const index = meetingsStore.findIndex(m => m._id === id);
        if (index === -1) return null;
        const oldMeeting = meetingsStore[index];
        const updatedMeeting = { ...oldMeeting, ...updateData } as IMeeting;
        meetingsStore[index] = updatedMeeting;
        return updatedMeeting;
      }
      return await MeetingModel.findByIdAndUpdate(id, updateData, { new: true }).lean();
    }
    const index = meetingsStore.findIndex(m => m._id === id);
    if (index === -1) return null;
    
    const oldMeeting = meetingsStore[index];
    const updatedMeeting = { ...oldMeeting, ...updateData } as IMeeting;
    meetingsStore[index] = updatedMeeting;

    // Handle folder transfer if folderId changed
    if (updateData.folderId !== undefined && oldMeeting.folderId !== updateData.folderId) {
      if (oldMeeting.folderId) {
        await this.removeMeetingFromFolder(oldMeeting.folderId, id);
      }
      if (updateData.folderId) {
        await this.addMeetingToFolder(updateData.folderId, id);
      }
    }

    return updatedMeeting;
  },

  async deleteMeeting(id: string): Promise<boolean> {
    if (isDbConnected()) {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        const index = meetingsStore.findIndex(m => m._id === id);
        if (index === -1) return false;
        meetingsStore.splice(index, 1);
        return true;
      }
      const meeting = await MeetingModel.findByIdAndDelete(id).lean();
      if (meeting && meeting.folderId) {
        await this.removeMeetingFromFolder(meeting.folderId, id);
      }
      return !!meeting;
    }
    const index = meetingsStore.findIndex(m => m._id === id);
    if (index === -1) return false;
    const meeting = meetingsStore[index];
    meetingsStore.splice(index, 1);
    if (meeting.folderId) {
      await this.removeMeetingFromFolder(meeting.folderId, id);
    }
    return true;
  },

  // Folders CRUD
  async getFolders(userId: string): Promise<IFolder[]> {
    if (isDbConnected()) {
      // In production/Mongoose, we also return seeded folders to avoid blank views
      const dbFolders = await FolderModel.find({ owner: userId }).lean();
      if (dbFolders.length === 0) {
        return foldersStore.filter(f => f.owner === userId);
      }
      return dbFolders;
    }
    return foldersStore.filter(f => f.owner === userId);
  },

  async getFolderById(id: string): Promise<IFolder | null> {
    if (isDbConnected()) {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return foldersStore.find(f => f._id === id) || null;
      }
      return await FolderModel.findById(id).lean();
    }
    return foldersStore.find(f => f._id === id) || null;
  },

  async createFolder(folderData: Omit<IFolder, '_id' | 'createdAt'>): Promise<IFolder> {
    if (isDbConnected()) {
      const folder = new FolderModel(folderData);
      await folder.save();
      return folder.toObject();
    }
    const newFolder: IFolder = {
      ...folderData,
      _id: generateId(),
      meetings: folderData.meetings || [],
      createdAt: new Date()
    };
    foldersStore.push(newFolder);
    return newFolder;
  },

  async addMeetingToFolder(folderId: string, meetingId: string): Promise<boolean> {
    if (isDbConnected()) {
      if (!mongoose.Types.ObjectId.isValid(folderId)) {
        const folder = foldersStore.find(f => f._id === folderId);
        if (!folder) return false;
        if (!folder.meetings.includes(meetingId)) {
          folder.meetings.push(meetingId);
        }
        return true;
      }
      await FolderModel.findByIdAndUpdate(folderId, { $addToSet: { meetings: meetingId } });
      return true;
    }
    const folder = foldersStore.find(f => f._id === folderId);
    if (!folder) return false;
    if (!folder.meetings.includes(meetingId)) {
      folder.meetings.push(meetingId);
    }
    return true;
  },

  async removeMeetingFromFolder(folderId: string, meetingId: string): Promise<boolean> {
    if (isDbConnected()) {
      if (!mongoose.Types.ObjectId.isValid(folderId)) {
        const folder = foldersStore.find(f => f._id === folderId);
        if (!folder) return false;
        folder.meetings = folder.meetings.filter(id => id !== meetingId);
        return true;
      }
      await FolderModel.findByIdAndUpdate(folderId, { $pull: { meetings: meetingId } });
      return true;
    }
    const folder = foldersStore.find(f => f._id === folderId);
    if (!folder) return false;
    folder.meetings = folder.meetings.filter(id => id !== meetingId);
    return true;
  },

  async deleteFolder(folderId: string): Promise<boolean> {
    if (isDbConnected()) {
      if (!mongoose.Types.ObjectId.isValid(folderId)) {
        const index = foldersStore.findIndex(f => f._id === folderId);
        if (index === -1) return false;
        foldersStore.splice(index, 1);
        return true;
      }
      const folder = await FolderModel.findByIdAndDelete(folderId).lean();
      if (folder) {
        await MeetingModel.updateMany({ folderId }, { $set: { folderId: null } });
      }
      return !!folder;
    }
    const index = foldersStore.findIndex(f => f._id === folderId);
    if (index === -1) return false;
    foldersStore.splice(index, 1);
    meetingsStore = meetingsStore.map(m => m.folderId === folderId ? { ...m, folderId: null } : m);
    return true;
  },

  async toggleActionItem(meetingId: string, actionIdx: number): Promise<IMeeting | null> {
    if (isDbConnected()) {
      if (!mongoose.Types.ObjectId.isValid(meetingId)) {
        const index = meetingsStore.findIndex(m => m._id === meetingId);
        if (index === -1) return null;
        const meeting = meetingsStore[index];
        if (meeting.actionItems && meeting.actionItems[actionIdx]) {
          meeting.actionItems[actionIdx].completed = !meeting.actionItems[actionIdx].completed;
        }
        return meeting;
      }
      
      const meeting = await MeetingModel.findById(meetingId);
      if (!meeting) return null;
      
      if (meeting.actionItems && meeting.actionItems[actionIdx]) {
        meeting.actionItems[actionIdx].completed = !meeting.actionItems[actionIdx].completed;
        meeting.markModified('actionItems');
        await meeting.save();
      }
      return meeting.toObject();
    }
    
    const index = meetingsStore.findIndex(m => m._id === meetingId);
    if (index === -1) return null;
    const meeting = meetingsStore[index];
    if (meeting.actionItems && meeting.actionItems[actionIdx]) {
      meeting.actionItems[actionIdx].completed = !meeting.actionItems[actionIdx].completed;
    }
    return meeting;
  }
};
