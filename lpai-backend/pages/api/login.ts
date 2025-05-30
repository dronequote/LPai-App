// pages/api/login.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import clientPromise from '@/lib/mongodb';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret';

if (!JWT_SECRET || JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET is missing or too weak. Set it in .env.local');
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Missing email or password' });
  }

  try {
    const client = await clientPromise;
    const db = client.db('lpai');

    const user = await db.collection('users').findOne({ email });

    if (!user || !user.hashedPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.hashedPassword);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Payload for JWT (can add/remove fields as needed)
    const payload = {
      userId: user.ghlUserId,
      locationId: user.locationId,
      name: user.name,
      permissions: user.permissions || [],
      role: user.role || 'user',
      _id: user._id,
      email: user.email,
    };

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });

    // --- FULL USER OBJECT returned to frontend (including preferences!) ---
    const loginResponse = {
      token,
      userId: user.ghlUserId,
      locationId: user.locationId,
      name: user.name,
      permissions: user.permissions || [],
      role: user.role || 'user',
      _id: user._id,
      email: user.email,
      preferences: user.preferences || {}, // ADD THIS LINE!
    };

    // Debug log
    console.log('[LOGIN RESPONSE]', {
      ...loginResponse,
      hasPreferences: !!user.preferences,
      navigatorOrder: user.preferences?.navigatorOrder,
    });

    return res.status(200).json(loginResponse);

  } catch (error) {
    console.error('[LOGIN ERROR]', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}