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
  const client = await clientPromise;
  const db = client.db('lpai');
  const id = req.query.id;

  if (typeof id !== 'string') {
    return sendNotFound(res, 'Library id');
  }

  switch (req.method) {
    case 'GET':
      return await getLibraryById(db, id, res);
    case 'PUT':
      return await updateLibrary(db, id, req.body, res);
    case 'DELETE':
      return await deleteLibrary(db, id, res);
    default:
      res.setHeader('Allow', ['GET', 'POST', 'PATCH']);
      return res.status(405).json({ error: `Method ${req.method} not allowed` });
  }
}

async function getLibraryById(db: any, id: string, res: NextApiResponse) {
  try {
    const client = await clientPromise;
    const db = client.db('lpai');

    const library = await db
      .collection('libraries')
      .findOne({ _id: new ObjectId(id) });

    if (!library) {
      return sendNotFound(res, 'Library');
    }

    return sendSuccess(res, library, 'Library fetched successfully');
  } catch (error) {
    return sendServerError(res, error, 'Failed to fetch library');
  }
}

async function updateLibrary(
  db: any,
  id: string,
  data: any,
  res: NextApiResponse
) {
  try {
    const existing = await db
      .collection('libraries')
      .findOne({ _id: new ObjectId(id) });

    if (!existing) {
      return sendNotFound(res, 'Library');
    }

    const { name, categories } = data;

    const updateResult = await db.collection('libraries').updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          name,
          categories,
          updatedAt: new Date().toISOString(),
        },
      }
    );

    return sendSuccess(res, null, 'Library updated successfully');
  } catch (error) {
    return sendServerError(res, error, 'Failed to update library');
  }
}

async function deleteLibrary(db: any, id: string, res: NextApiResponse) {
  const deleteResult = await db
    .collection('libraries')
    .deleteOne({ _id: new ObjectId(id) });

  if (deleteResult.deletedCount === 0) {
    return sendNotFound(res, 'Library');
  }

  return sendSuccess(res, null, 'Library deleted successfully');
}