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

    // Drop stale unique indexes that might have drifted from previous schema iterations
    try {
      const db = mongoose.connection.db;
      if (db) {
        const collections = await db.listCollections({ name: 'users' }).toArray();
        if (collections.length > 0) {
          const indexes = await db.collection('users').indexes();
          const hasUsernameIndex = indexes.some(idx => idx.name === 'username_1');
          if (hasUsernameIndex) {
            await db.collection('users').dropIndex('username_1');
            console.log('🗑️ Successfully dropped stale unique index username_1');
          }
        }
      }
    } catch (err: any) {
      console.warn('⚠️ Non-blocking index cleanup warning:', err.message);
    }
  } catch (error: any) {
    console.warn('⚠️ MongoDB connection failed. Falling back to in-memory storage mock. Error:', error.message);
    isConnected = false;
  }
}

export function isDbConnected(): boolean {
  return isConnected;
}
