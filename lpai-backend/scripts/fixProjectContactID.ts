import { ObjectId } from 'mongodb';
import clientPromise from '../src/lib/mongodb';

async function run() {
  const client = await clientPromise;
  const db = client.db('lpai');
  const projects = db.collection('projects');

  const cursor = projects.find({});

  const bulkOps: any[] = [];

  await cursor.forEach((doc) => {
    if (doc.contactId instanceof ObjectId) {
      bulkOps.push({
        updateOne: {
          filter: { _id: doc._id },
          update: {
            $set: {
              contactId: doc.contactId.toString(),
            },
          },
        },
      });
    }
  });

  if (bulkOps.length > 0) {
    const result = await projects.bulkWrite(bulkOps);
    console.log(`✅ Updated ${result.modifiedCount} projects.`);
  } else {
    console.log('ℹ️ No projects needed updating.');
  }

  process.exit(0);
}

run().catch((err) => {
  console.error('❌ Failed to update projects:', err);
  process.exit(1);
});
