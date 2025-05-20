// pages/api/projects/index.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import clientPromise from '../../../src/lib/mongodb';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const client = await clientPromise;
  const db = client.db('lpai');
  const projects = db.collection('projects');

  switch (req.method) {
    case 'POST':
      const { title, status, notes, contactId, locationId } = req.body;

      if (!title || !contactId || !locationId) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      const result = await projects.insertOne({
        title,
        status,
        notes,
        contactId,
        locationId,
        createdAt: new Date().toISOString(),
      });

      return res.status(201).json({ success: true, id: result.insertedId });

    case 'GET':
      const all = await projects.find({}).toArray();
      return res.status(200).json(all);

    default:
      res.setHeader('Allow', ['POST', 'GET']);
      return res.status(405).json({ error: 'Method not allowed' });
  }
}
