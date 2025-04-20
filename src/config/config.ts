import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env file
dotenv.config();

export const config = {
  github: {
    token: process.env.GITHUB_TOKEN || '',
    targetRepo: process.env.TARGET_REPO || 'Yellow-Dog-Man/Resonite-Issues',
  },
  mongodb: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/resonite-issue-discovery',
  }
};

// Validate required environment variables
export function validateConfig(): boolean {
  if (!config.github.token) {
    console.error('Error: GITHUB_TOKEN environment variable is required');
    return false;
  }
  
  return true;
}
