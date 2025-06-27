// pages/api/contacts/[contactId]/notes/[noteId].ts

import { NextApiRequest, NextApiResponse } from 'next';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import axios from 'axios';
import jwt from 'jsonwebtoken';
import { getAuthHeader } from '@/utils/ghlAuth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { contactId, noteId } = req.query;
  const { locationId } = req.body || req.query;

  if (!contactId || !noteId || !locationId) {
    return res.status(400).json({ error: 'Missing required parameters' });
  }

  // Standard JWT verification
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  let decoded: any;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET!);
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  try {
    const client = await clientPromise;
    const db = client.db('lpai');

    // Get location for GHL auth
    const location = await db.collection('locations').findOne({ locationId });
    if (!location) {
      return res.status(404).json({ error: 'Location not found' });
    }

    // Verify user has access to this location
    const user = await db.collection('users').findOne({
      ghlUserId: decoded.userId,
      locationId: locationId
    });

    if (!user) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get contact to find GHL contact ID
    const contact = await db.collection('contacts').findOne({
      _id: new ObjectId(contactId as string),
      locationId
    });

    if (!contact || !contact.ghlContactId) {
      return res.status(404).json({ error: 'Contact not found or missing GHL ID' });
    }

    // Use getAuthHeader like your other files
    const auth = await getAuthHeader(location);

    switch (req.method) {
      case 'PUT':
        const { text } = req.body;

        if (!text) {
          return res.status(400).json({ error: 'Note text is required' });
        }

        try {
          const ghlUserId = user?.ghlUserId || decoded.userId;

          // Update note in GHL
          const ghlUrl = `https://services.leadconnectorhq.com/contacts/${contact.ghlContactId}/notes/${noteId}`;
          
          await axios.put(ghlUrl, {
            userId: ghlUserId,
            body: text
          }, {
            headers: {
              'Authorization': auth.header,
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
      
      case 'DELETE':
        try {
          // Delete note in GHL
          const ghlUrl = `https://services.leadconnectorhq.com/contacts/${contact.ghlContactId}/notes/${noteId}`;
          
          await axios.delete(ghlUrl, {
            headers: {
              'Authorization': auth.header,
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
      
      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error: any) {
    console.error('[Notes API] Error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}