import { validateConfig, config } from './config/config';
import { connectToDatabase, closeDatabaseConnection } from './utils/database';
import { fetchIssues, fetchComments, transformIssueData, saveIssue } from './services/githubService';
import { startLocalMongoDBServer, exportMongoDBData, importMongoDBData } from './utils/setupLocalMongoDB';
import fs from 'fs';
import path from 'path';

// Main function to update issues
async function updateIssues(): Promise<void> {
  console.log('Starting issue update process...');
  
  // Validate configuration
  if (!validateConfig()) {
    console.error('Invalid configuration. Please check your .env file.');
    process.exit(1);
  }
  
  try {
    // Set up local MongoDB if needed
    const useLocalMongoDB = !process.env.MONGODB_URI || process.env.USE_LOCAL_MONGODB === 'true';
    
    if (useLocalMongoDB) {
      console.log('Using local MongoDB server');
      const mongoUri = await startLocalMongoDBServer();
      process.env.MONGODB_URI = mongoUri;
      
      // Import existing data if available
      await connectToDatabase();
      await importMongoDBData();
    } else {
      // Connect to database
      await connectToDatabase();
    }
    
    // Fetch issues from GitHub API (first page)
    console.log(`Fetching issues from ${config.github.targetRepo}...`);
    const issues = await fetchIssues(1, 100);
    console.log(`Fetched ${issues.length} issues`);
    
    // Process each issue
    for (const issue of issues) {
      console.log(`Processing issue #${issue.number}: ${issue.title}`);
      
      // Fetch comments for the issue
      const comments = await fetchComments(issue.number);
      console.log(`Fetched ${comments.length} comments for issue #${issue.number}`);
      
      // Transform GitHub data to our model format
      const issueData = transformIssueData(issue, comments);
      
      // Save issue to database
      await saveIssue(issueData);
    }
    
    console.log('Issue update process completed successfully');
    
    // Export data to JSON files if using local MongoDB
    if (useLocalMongoDB) {
      await exportMongoDBData();
    }
  } catch (error) {
    console.error('Error updating issues:', error);
  } finally {
    // Close database connection
    await closeDatabaseConnection();
  }
}

// Run the update process
updateIssues().catch(error => {
  console.error('Unhandled error in update process:', error);
  process.exit(1);
});
