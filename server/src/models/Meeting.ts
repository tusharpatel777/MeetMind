import mongoose, { Schema, Document } from 'mongoose';
import { IMeeting, ITranscriptLine, IActionItem } from './types';

export interface IMeetingDocument extends IMeeting, Document {
  _id: any;
}

const TranscriptLineSchema = new Schema<ITranscriptLine>({
  sender: { type: String, required: true },
  text: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
});

const ActionItemSchema = new Schema<IActionItem>({
  person: { type: String, required: true },
  task: { type: String, required: true },
  deadline: { type: String },
  completed: { type: Boolean, default: false },
});

const MeetingSchema = new Schema<IMeetingDocument>({
  title: { type: String, required: true },
  description: { type: String },
  startTime: { type: Date, required: true },
  endTime: { type: Date, required: true },
  createdBy: { type: String, required: true },
  participants: [{ type: String }],
  folderId: { type: String, default: null },
  status: { type: String, enum: ['scheduled', 'live', 'ended'], default: 'scheduled' },
  transcript: [TranscriptLineSchema],
  summary: { type: String },
  decisions: [{ type: String }],
  actionItems: [ActionItemSchema],
  questions: [{ type: String }],
  calendarEventId: { type: String, default: null },
  recordingUrl: { type: String },
}, { timestamps: true });

export const MeetingModel = mongoose.model<IMeetingDocument>('Meeting', MeetingSchema);
