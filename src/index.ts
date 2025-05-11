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
    
    // Fetch all issues from GitHub API with pagination
    console.log(`Fetching all issues from ${config.github.targetRepo}...`);
    
    let currentPage = 1;
    const perPage = 100; // Maximum allowed by GitHub API
    let totalIssues = 0;
    let processedIssues = 0;
    let hasMoreIssues = true;
    let allIssues: any[] = [];
    
    // First, fetch all issues to get the total count
    console.log('Gathering all issues (this may take a while)...');
    while (hasMoreIssues) {
      console.log(`Fetching page ${currentPage}...`);
      const issues = await fetchIssues(currentPage, perPage);
      
      if (issues.length === 0) {
        hasMoreIssues = false;
        console.log('No more issues to fetch.');
        break;
      }
      
      console.log(`Fetched ${issues.length} issues from page ${currentPage}`);
      allIssues = [...allIssues, ...issues];
      
      // Move to next page
      currentPage++;
      
      // Add a small delay to avoid hitting GitHub API rate limits
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    totalIssues = allIssues.length;
    console.log(`Total issues to process: ${totalIssues}`);
    
    // Process each issue
    for (const issue of allIssues) {
      processedIssues++;
      const progressPercent = ((processedIssues / totalIssues) * 100).toFixed(2);
      console.log(`[${processedIssues}/${totalIssues} - ${progressPercent}%] Processing issue #${issue.number}: ${issue.title}`);
      
      // Fetch comments for the issue
      const comments = await fetchComments(issue.number);
      console.log(`Fetched ${comments.length} comments for issue #${issue.number}`);
      
      // Transform GitHub data to our model format
      const issueData = transformIssueData(issue, comments);
      
      // Save issue to database
      await saveIssue(issueData);
      
      // Log progress
      console.log(`Completed issue #${issue.number} (${processedIssues}/${totalIssues} - ${progressPercent}%)`);
    }
    
    console.log(`Total issues fetched and processed: ${totalIssues}`);
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
