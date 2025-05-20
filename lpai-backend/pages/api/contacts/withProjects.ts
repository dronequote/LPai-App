import type { NextApiRequest, NextApiResponse } from 'next';
import clientPromise from '../../../src/lib/mongodb';
import { ObjectId } from 'mongodb';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const locationId = req.query.locationId as string;
  if (!locationId) {
    return res.status(400).json({ error: 'Missing locationId' });
  }

  try {
    const client = await clientPromise;
    const db = client.db('lpai');

    const contacts = await db
      .collection('contacts')
      .find({ locationId })
      .sort({ createdAt: -1 })
      .toArray();

    const contactIds = contacts.map((c) => c._id.toString());

    const projects = await db
      .collection('projects')
      .find({ locationId, contactId: { $in: contactIds } })
      .toArray();

    const grouped = projects.reduce((acc: any, p) => {
      const cid = p.contactId.toString();
      if (!acc[cid]) acc[cid] = [];
      acc[cid].push(p);
      return acc;
    }, {});

    const enriched = contacts.map((c) => ({
      ...c,
      projects: grouped[c._id.toString()] || [],
    }));

    return res.status(200).json(enriched);
  } catch (err) {
    console.error('❌ Failed to load contacts with projects', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
