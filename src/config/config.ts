import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env file
dotenv.config();

export const config = {
  github: {
    token: process.env.GH_TOKEN || '',
    targetRepo: process.env.TARGET_REPO || 'Yellow-Dog-Man/Resonite-Issues',
  },
  mongodb: {
    get uri() {
      return process.env.MONGODB_URI || 'mongodb://localhost:27017/resonite-issue-discovery';
    }
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY || ''
  }
};

// Validate required environment variables
export function validateConfig(): boolean {
  if (!config.github.token) {
    console.error('Error: GH_TOKEN environment variable is required');
    return false;
  }
  
  return true;
}
