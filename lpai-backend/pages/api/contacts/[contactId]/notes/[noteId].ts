// pages/api/contacts/[contactId]/notes/[noteId].ts

import { NextApiRequest, NextApiResponse } from 'next';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import axios from 'axios';
import { verifyAuth } from '@/lib/auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { contactId, noteId } = req.query;
  const { locationId } = req.body || req.query;

  if (!contactId || !noteId || !locationId) {
    return res.status(400).json({ error: 'Missing required parameters' });
  }

  try {
    // Verify auth
    const decoded = await verifyAuth(req);
    if (!decoded) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const client = await clientPromise;
    const db = client.db('lpai');

    // Get location for GHL auth
    const location = await db.collection('locations').findOne({ locationId });
    if (!location) {
      return res.status(404).json({ error: 'Location not found' });
    }

    // Get contact to find GHL contact ID
    const contact = await db.collection('contacts').findOne({
      _id: new ObjectId(contactId as string),
      locationId
    });

    if (!contact || !contact.ghlContactId) {
      return res.status(404).json({ error: 'Contact not found or missing GHL ID' });
    }

    // Get auth header
    const authHeader = location.apiKey 
      ? `Bearer ${location.apiKey}`
      : `Bearer ${location.accessToken}`;

    switch (req.method) {
      case 'PUT':
        return await handleUpdateNote(
          contact.ghlContactId,
          noteId as string,
          authHeader,
          req.body,
          decoded.userId,
          db,
          locationId,
          res
        );
      
      case 'DELETE':
        return await handleDeleteNote(
          contact.ghlContactId,
          noteId as string,
          authHeader,
          db,
          res
        );
      
      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error: any) {
    console.error('[Notes API] Error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}

async function handleUpdateNote(
  ghlContactId: string,
  noteId: string,
  authHeader: string,
  body: any,
  userId: string,
  db: any,
  locationId: string,
  res: NextApiResponse
) {
  const { text } = body;

  if (!text) {
    return res.status(400).json({ error: 'Note text is required' });
  }

  try {
    // Find the user
    const user = await db.collection('users').findOne({
      ghlUserId: userId,
      locationId
    });

    const ghlUserId = user?.ghlUserId || userId;

    // Update note in GHL
    const ghlUrl = `https://services.leadconnectorhq.com/contacts/${ghlContactId}/notes/${noteId}`;
    
    await axios.put(ghlUrl, {
      userId: ghlUserId,
      body: text
    }, {
      headers: {
        'Authorization': authHeader,
        'Version': '2021-07-28',
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });

    // Update in MongoDB if exists
    await db.collection('notes').updateOne(
      { ghlNoteId: noteId },
      { 
        $set: { 
          body: text,
          updatedAt: new Date(),
          updatedBy: user?.name || 'User'
        }
      }
    );

    return res.status(200).json({
      success: true,
      note: {
        id: noteId,
        body: text,
        updatedAt: new Date()
      }
    });
  } catch (error: any) {
    console.error('[Notes API] Error updating note:', error.response?.data || error);
    return res.status(500).json({ 
      error: 'Failed to update note',
      details: error.response?.data || error.message 
    });
  }
}

async function handleDeleteNote(
  ghlContactId: string,
  noteId: string,
  authHeader: string,
  db: any,
  res: NextApiResponse
) {
  try {
    // Delete note in GHL
    const ghlUrl = `https://services.leadconnectorhq.com/contacts/${ghlContactId}/notes/${noteId}`;
    
    await axios.delete(ghlUrl, {
      headers: {
        'Authorization': authHeader,
        'Version': '2021-07-28',
        'Accept': 'application/json'
      }
    });

    // Delete from MongoDB if exists
    await db.collection('notes').deleteOne({ ghlNoteId: noteId });

    return res.status(200).json({
      success: true,
      message: 'Note deleted successfully'
    });
  } catch (error: any) {
    console.error('[Notes API] Error deleting note:', error.response?.data || error);
    return res.status(500).json({ 
      error: 'Failed to delete note',
      details: error.response?.data || error.message 
    });
  }
}