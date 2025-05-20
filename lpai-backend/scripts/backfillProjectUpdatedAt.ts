import clientPromise from '../src/lib/mongodb';

async function run() {
  const client = await clientPromise;
  const db = client.db('lpai');
  const projects = db.collection('projects');

  const allProjects = await projects.find({}).toArray();

  const updates = allProjects.map(project => {
    const randomOffset = Math.floor(Math.random() * 30); // 0–29 days ago
    const updatedAt = new Date();
    updatedAt.setDate(updatedAt.getDate() - randomOffset);

    return {
      updateOne: {
        filter: { _id: project._id },
        update: { $set: { updatedAt } }
      }
    };
  });

  const result = await projects.bulkWrite(updates);
  console.log(`✅ Updated ${result.modifiedCount} projects.`);
  process.exit(0);
}

run().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
