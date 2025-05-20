import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

// ✅ Load your environment variables from .env.local
dotenv.config({ path: '.env.local' });

// 🔍 Optional: Log to verify correct URI loading (remove in production)
console.log('MONGODB_URI value:', process.env.MONGODB_URI);

const uri = process.env.MONGODB_URI;
const options = {};

if (!uri) {
  throw new Error('❌ Missing MONGODB_URI in .env.local');
}

// 🧠 Define global type to avoid reconnecting in dev
let client: MongoClient;
let clientPromise: Promise<MongoClient>;

const globalWithMongo = global as typeof globalThis & {
  _mongoClientPromise?: Promise<MongoClient>;
};

if (!globalWithMongo._mongoClientPromise) {
  client = new MongoClient(uri, options);
  globalWithMongo._mongoClientPromise = client.connect();
}

clientPromise = globalWithMongo._mongoClientPromise!;

export default clientPromise;
