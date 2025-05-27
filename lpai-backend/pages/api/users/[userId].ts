// pages/api/users/[userId].ts
import type { NextApiRequest, NextApiResponse } from 'next';
import clientPromise from '../../../src/lib/mongodb';
import { ObjectId } from 'mongodb';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { userId } = req.query;
  
  if (!userId || typeof userId !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid userId' });
  }

  const client = await clientPromise;
  const db = client.db('lpai');

  switch (req.method) {
    case 'GET':
      return await getUser(db, userId, res);
    case 'PATCH':
      return await updateUser(db, userId, req.body, res);
    default:
      res.setHeader('Allow', ['GET', 'PATCH']);
      return res.status(405).json({ error: `Method ${req.method} not allowed` });
  }
}

// 📋 GET: Fetch user details
async function getUser(db: any, userId: string, res: NextApiResponse) {
  try {
    let user;
    
    // Try to find by ObjectId first, then by userId field
    if (ObjectId.isValid(userId)) {
      user = await db.collection('users').findOne({ _id: new ObjectId(userId) });
    }
    
    if (!user) {
      user = await db.collection('users').findOne({ userId: userId });
    }
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    console.log(`[USERS API] Fetched user: ${user.name} (${user.email})`);
    return res.status(200).json(user);
    
  } catch (error) {
    console.error('[USERS API] Error fetching user:', error);
    return res.status(500).json({ error: 'Failed to fetch user' });
  }
}

// ✏️ PATCH: Update user (mainly for preferences)
async function updateUser(db: any, userId: string, body: any, res: NextApiResponse) {
  try {
    const { preferences, ...otherUpdates } = body;
    
    let updateData: any = {};
    
    // Handle preferences update
    if (preferences) {
      updateData.preferences = preferences;
    }
    
    // Handle other field updates
    Object.assign(updateData, otherUpdates);
    
    // Add timestamp
    updateData.updatedAt = new Date().toISOString();
    
    let result;
    
    // Try to update by ObjectId first, then by userId field
    if (ObjectId.isValid(userId)) {
      result = await db.collection('users').findOneAndUpdate(
        { _id: new ObjectId(userId) },
        { $set: updateData },
        { returnDocument: 'after' }
      );
    }
    
    if (!result?.value) {
      result = await db.collection('users').findOneAndUpdate(
        { userId: userId },
        { $set: updateData },
        { returnDocument: 'after' }
      );
    }
    
    if (!result?.value) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    console.log(`[USERS API] Updated user: ${result.value.name} - Preferences:`, preferences);
    return res.status(200).json(result.value);
    
  } catch (error) {
    console.error('[USERS API] Error updating user:', error);
    return res.status(500).json({ error: 'Failed to update user' });
  }
}