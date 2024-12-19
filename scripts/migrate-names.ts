// scripts/migrate-names.ts
import fs from 'fs/promises';
import path from 'path';
import connectToMongoDB from '@/lib/mongodb';
import UnassignedNames from '@/models/UnassignedNames';

async function migrateNames() {
  try {
    // Connect to MongoDB
    await connectToMongoDB();

    // Read the names.json file
    const filePath = path.join(process.cwd(), 'data', 'names.json');
    const fileContent = await fs.readFile(filePath, 'utf-8');
    const namesData = JSON.parse(fileContent);

    if (!namesData.unassigned || !Array.isArray(namesData.unassigned)) {
      throw new Error('Invalid file structure');
    }

    // Insert all names into MongoDB
    await UnassignedNames.insertMany(namesData.unassigned);

    console.log('Migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

migrateNames();