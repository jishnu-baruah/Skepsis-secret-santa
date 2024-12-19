// scripts/migrate-names.ts
import { readFile } from 'fs/promises';
import { join } from 'path';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// MongoDB connection string with type assertion
const MONGODB_URI = process.env.MONGODB_URI;

// Check for MongoDB URI before proceeding
if (!MONGODB_URI) {
  console.error('MONGODB_URI is not defined in environment variables');
  process.exit(1);
}

// Now TypeScript knows MONGODB_URI is definitely a string
const mongoUri: string = MONGODB_URI;

// Define interfaces
interface Person {
  name: string;
  email: string;
  drive_link: string;
  description: string;
}

interface NameData {
  unassigned: Person[];
}

// Define the UnassignedNames schema
const UnassignedNamesSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true
  },
  email: {
    type: String,
    required: true,
    unique: true
  },
  drive_link: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  }
});

// Create the model
const UnassignedNames = mongoose.models.UnassignedNames || 
  mongoose.model('UnassignedNames', UnassignedNamesSchema);

async function connectToMongoDB(uri: string) {
  try {
    await mongoose.connect(uri);
    console.log('Connected to MongoDB');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
}

async function migrateNames() {
  try {
    // Connect to MongoDB using the verified URI
    await connectToMongoDB(mongoUri);

    // Read the names.json file
    const filePath = join(process.cwd(), 'data', 'names.json');
    console.log('Reading file from:', filePath);
    
    const fileContent = await readFile(filePath, 'utf-8');
    const namesData: NameData = JSON.parse(fileContent);

    if (!namesData.unassigned || !Array.isArray(namesData.unassigned)) {
      throw new Error('Invalid file structure');
    }

    console.log(`Found ${namesData.unassigned.length} names to migrate`);

    // Insert all names into MongoDB
    const result = await UnassignedNames.insertMany(namesData.unassigned);
    console.log(`Successfully migrated ${result.length} names to MongoDB`);

  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('MongoDB connection closed');
    process.exit(0);
  }
}

migrateNames();