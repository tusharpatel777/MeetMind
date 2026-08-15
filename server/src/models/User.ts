import mongoose, { Schema, Document } from 'mongoose';
import { IUser } from './types';

export interface IUserDocument extends IUser, Document {
  _id: any;
}

const UserSchema = new Schema<IUserDocument>({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String },
  avatar: { type: String, required: true },
  googleTokens: { type: Schema.Types.Mixed },
}, { timestamps: true });

export const UserModel = mongoose.model<IUserDocument>('User', UserSchema);
