import mongoose, { Schema, Document } from 'mongoose';
import { IFolder } from './types';

export interface IFolderDocument extends IFolder, Document {
  _id: any;
}

const FolderSchema = new Schema<IFolderDocument>({
  name: { type: String, required: true },
  owner: { type: String, required: true },
  meetings: [{ type: String }],
}, { timestamps: true });

export const FolderModel = mongoose.model<IFolderDocument>('Folder', FolderSchema);
