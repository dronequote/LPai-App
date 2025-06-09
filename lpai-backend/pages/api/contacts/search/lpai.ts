import axios from 'axios';
import type { NextApiRequest, NextApiResponse } from 'next';
import {
  sendSuccess,
  sendBadRequest,
  sendUnauthorized,
  sendServerError,
} from '../../../../src/utils/httpResponses';
import clientPromise from '@/lib/mongodb';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return sendBadRequest(res, 'Method not allowed', 'Invalid Method');
  }

  const locationId = typeof req.query.locationId === 'string' ? req.query.locationId : null;

  if (!locationId) {
    return sendBadRequest(res, 'Missing required field: locationId');
  }

  try {
    const client = await clientPromise;
    const db = client.db('lpai');

    const contacts = await db
      .collection('contacts')
      .find({
        locationId,
        ghlContactId: { $exists: true },
      })
      .toArray();

    return sendSuccess(res, contacts, 'Contacts fetched successfully');
  } catch (error: any) {
    console.error('❌ Failed to fetch contacts from database:', error);
    return sendServerError(res, error, 'Error retrieving contacts from database');
  }
}
