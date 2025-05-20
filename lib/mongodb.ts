import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI;
const options = {};

// Ensure URI is defined
if (!uri) {
  throw new Error('MONGODB_URI not found in environment variables');
}

// Add types for NodeJS global to avoid type errors in dev
declare global {
  // eslint-disable-next-line no-var
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

let client: MongoClient;
let clientPromise: Promise<MongoClient>;

if (process.env.NODE_ENV === 'development') {
  if (!global._mongoClientPromise) {
    client = new MongoClient(uri, options);
    global._mongoClientPromise = client.connect();
  }
  clientPromise = global._mongoClientPromise!;
} else {
  client = new MongoClient(uri, options);
  clientPromise = client.connect();
}

export default clientPromise;
