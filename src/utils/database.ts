import mongoose from 'mongoose';
import { config } from '../config/config';

// Connect to MongoDB
export async function connectToDatabase(): Promise<void> {
  try {
    await mongoose.connect(config.mongodb.uri);
    console.log('Connected to MongoDB');
  } catch (error) {
    console.error('Failed to connect to MongoDB:', error);
    process.exit(1);
  }
}

// Close MongoDB connection
export async function closeDatabaseConnection(): Promise<void> {
  try {
    await mongoose.connection.close();
    console.log('Closed MongoDB connection');
  } catch (error) {
    console.error('Error closing MongoDB connection:', error);
  }
}
