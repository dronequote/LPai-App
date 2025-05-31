// lpai-backend/scripts/setup-indexes.js
const { MongoClient } = require('mongodb');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

// Also try .env if .env.local doesn't have MONGODB_URI
if (!process.env.MONGODB_URI) {
  dotenv.config({ path: path.resolve(__dirname, '../.env') });
}

async function setupIndexes() {
  if (!process.env.MONGODB_URI) {
    console.error('Error: MONGODB_URI not found in environment variables');
    console.error('Please make sure MONGODB_URI is set in .env.local or .env');
    process.exit(1);
  }

  const client = new MongoClient(process.env.MONGODB_URI);
  
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    
    const db = client.db('lpai');
    
    console.log('Creating indexes...');
    
    // Webhook queue indexes
    await db.collection('webhook_queue').createIndex({ status: 1, processAfter: 1 });
    await db.collection('webhook_queue').createIndex({ createdAt: 1 }, { expireAfterSeconds: 86400 });
    console.log('✓ Created webhook_queue indexes');
    
    // Webhook hash indexes (for deduplication)
    await db.collection('webhook_hashes').createIndex({ hash: 1 });
    await db.collection('webhook_hashes').createIndex({ expireAt: 1 }, { expireAfterSeconds: 0 });
    console.log('✓ Created webhook_hashes indexes');
    
    // Contact indexes
    await db.collection('contacts').createIndex({ ghlContactId: 1 });
    await db.collection('contacts').createIndex({ email: 1 });
    await db.collection('contacts').createIndex({ locationId: 1 });
    console.log('✓ Created contacts indexes');
    
    // Appointment indexes
    await db.collection('appointments').createIndex({ ghlAppointmentId: 1 });
    await db.collection('appointments').createIndex({ locationId: 1, start: 1 });
    console.log('✓ Created appointments indexes');
    
    // Project indexes
    await db.collection('projects').createIndex({ ghlOpportunityId: 1 });
    await db.collection('projects').createIndex({ locationId: 1, status: 1 });
    console.log('✓ Created projects indexes');
    
    console.log('All indexes created successfully!');
    
  } catch (error) {
    console.error('Error creating indexes:', error);
    process.exit(1);
  } finally {
    await client.close();
  }
}

setupIndexes();