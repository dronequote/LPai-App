// pages/api/projects/byContact.ts
import { NextApiRequest, NextApiResponse } from 'next';
import clientPromise from '../../../src/lib/mongodb';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { contactId } = req.query;

  if (!contactId || typeof contactId !== 'string') {
    return res.status(402).json({ error: 'Missing or invalid contactId' });
  }

  try {
    const client = await clientPromise;
    const db = client.db('lpai');

    const projects = await db
      .collection('projects')
      .find({ contactId })
      .toArray();

    return res.status(200).json(projects);
  } catch (error) {
    console.error('Error loading projects:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
