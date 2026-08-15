import mongoose from 'mongoose';

let isConnected = false;

export async function connectDB() {
  const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/meetmind';
  
  try {
    mongoose.set('strictQuery', false);
    await mongoose.connect(mongoURI, {
      serverSelectionTimeoutMS: 5000, // Timeout after 5s
    });
    isConnected = true;
    console.log('✅ MongoDB connected successfully to ' + mongoURI);
  } catch (error: any) {
    console.warn('⚠️ MongoDB connection failed. Falling back to in-memory storage mock. Error:', error.message);
    isConnected = false;
  }
}

export function isDbConnected(): boolean {
  return isConnected;
}
