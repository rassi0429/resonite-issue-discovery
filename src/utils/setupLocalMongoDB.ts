import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';

// Path to store MongoDB data
const DATA_DIR = path.join(process.cwd(), 'data');
const DB_PATH = path.join(DATA_DIR, 'mongodb-data');

// Function to start a local MongoDB server
export async function startLocalMongoDBServer(): Promise<string> {
  console.log('Starting local MongoDB server...');
  
  // Ensure data directory exists
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  
  // Create MongoDB instance
  const mongod = await MongoMemoryServer.create({
    instance: {
      dbPath: DB_PATH,
      storageEngine: 'wiredTiger',
    }
  });
  
  // Get connection string
  const uri = mongod.getUri();
  console.log(`Local MongoDB server started at ${uri}`);
  
  return uri;
}

// Function to export data from MongoDB to JSON files
export async function exportMongoDBData(): Promise<void> {
  console.log('Exporting MongoDB data to JSON files...');
  
  try {
    // Get all collections
    const collections = mongoose.connection.collections;
    
    // Create export directory if it doesn't exist
    const exportDir = path.join(DATA_DIR, 'exports');
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
    }
    
    // Export each collection to a JSON file
    for (const [name, collection] of Object.entries(collections)) {
      const documents = await collection.find({}).toArray();
      
      if (documents.length > 0) {
        const filePath = path.join(exportDir, `${name}.json`);
        fs.writeFileSync(filePath, JSON.stringify(documents, null, 2));
        console.log(`Exported ${documents.length} documents from ${name} to ${filePath}`);
      } else {
        console.log(`Collection ${name} is empty, skipping export`);
      }
    }
    
    console.log('MongoDB data export completed');
  } catch (error) {
    console.error('Error exporting MongoDB data:', error);
    throw error;
  }
}

// Function to import data from JSON files to MongoDB
export async function importMongoDBData(): Promise<void> {
  console.log('Importing MongoDB data from JSON files...');
  
  try {
    // Get export directory
    const exportDir = path.join(DATA_DIR, 'exports');
    
    // Check if export directory exists
    if (!fs.existsSync(exportDir)) {
      console.log('No export directory found, skipping import');
      return;
    }
    
    // Get all JSON files in the export directory
    const files = fs.readdirSync(exportDir).filter(file => file.endsWith('.json'));
    
    // Import each JSON file to the corresponding collection
    for (const file of files) {
      const filePath = path.join(exportDir, file);
      const collectionName = path.basename(file, '.json');
      
      // Read JSON file
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      
      if (data.length > 0) {
        // Get collection
        const collection = mongoose.connection.collection(collectionName);
        
        // Clear existing data
        await collection.deleteMany({});
        
        // Insert data
        await collection.insertMany(data);
        
        console.log(`Imported ${data.length} documents to ${collectionName}`);
      } else {
        console.log(`File ${file} is empty, skipping import`);
      }
    }
    
    console.log('MongoDB data import completed');
  } catch (error) {
    console.error('Error importing MongoDB data:', error);
    throw error;
  }
}
