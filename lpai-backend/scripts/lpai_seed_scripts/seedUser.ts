import bcrypt from 'bcryptjs';
import clientPromise from '../src/lib/mongodb';

const usersToSeed = [
  {
    name: 'Test Tech',
    email: 'tech@thisisafakecompany.com',
    plainPassword: 'LetMeIn123!',
    role: 'user',
    locationId: 'gs59LyvPJDe0sNgkZcS0',
    ghlUserId: 'ghlUserTech001',
    permissions: ['view_contacts'],
  },
  {
    name: 'Admin Diana',
    email: 'diana@othercompany.com',
    plainPassword: 'AdminPass456!',
    role: 'admin',
    locationId: 'newLoc456XYZ',
    ghlUserId: 'ghlUserDiana001',
    permissions: ['view_contacts', 'edit_projects', 'manage_users'],
  },
  {
    name: 'Field Rep Bob',
    email: 'bob@othercompany.com',
    plainPassword: 'UserPass789!',
    role: 'user',
    locationId: 'newLoc456XYZ',
    ghlUserId: 'ghlUserBob001',
    permissions: ['view_contacts'],
  },
];

async function run() {
  const client = await clientPromise;
  const db = client.db('lpai');
  const users = db.collection('users');

  for (const user of usersToSeed) {
    const { email, plainPassword, ...rest } = user;
    const existing = await users.findOne({ email });

    if (existing) {
      console.log(`⚠️ User already exists (${email}). Deleting...`);
      await users.deleteOne({ email });
    }

    const hashedPassword = await bcrypt.hash(plainPassword, 10);

    const result = await users.insertOne({
      ...rest,
      email,
      hashedPassword,
    });

    console.log(`✅ Created ${email} with _id: ${result.insertedId}`);
  }

  process.exit(0);
}

run().catch(console.error);
