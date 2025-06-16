// lpai-backend/src/pages/api/invoices/[invoiceId].ts
import type { NextApiRequest, NextApiResponse } from 'next';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import {
  sendSuccess,
  sendNotFound,
  sendMethodNotAllowed,
  sendServerError
} from '@/utils/response';
import cors from '@/lib/cors';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    await cors(req, res);
  if (req.method !== 'GET') {
    return sendMethodNotAllowed(res, ['GET']);
  }

  const id = req.query.id;

  if (typeof id !== 'string') {
    return sendNotFound(res, 'Invoice id');
  }

  try {
    const client = await clientPromise;
    const db = client.db('lpai');

    const invoice = await db
      .collection('invoices')
      .findOne({ _id: new ObjectId(id) });

    if (!invoice) {
      return sendNotFound(res, 'Invoice');
    }

    return sendSuccess(res, invoice, 'Invoice fetched successfully');
  } catch (error) {
    return sendServerError(res, error, 'Failed to fetch invoice');
  }
}
