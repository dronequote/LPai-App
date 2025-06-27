import { NextApiRequest, NextApiResponse } from 'next';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import axios from 'axios';
import jwt from 'jsonwebtoken';
import { getAuthHeader } from '@/utils/ghlAuth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { contactId } = req.query;
  const { locationId } = req.method === 'GET' ? req.query : req.body;

  if (!contactId || !locationId) {
    return res.status(400).json({ error: 'Missing required parameters' });
  }

  // Standard JWT verification like your other files
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

    // Get location for GHL auth - matches your pattern
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
      case 'GET':
        // Get notes from GHL
        try {
          const ghlUrl = `https://services.leadconnectorhq.com/contacts/${contact.ghlContactId}/notes`;
          
          const response = await axios.get(ghlUrl, {
            headers: {
              'Authorization': auth.header,
              'Version': '2021-07-28',
              'Accept': 'application/json'
            }
          });

          const notes = response.data.notes || [];
          
          const transformedNotes = notes.map((note: any) => ({
            id: note.id,
            body: note.body,
            createdBy: note.userId,
            createdAt: note.dateAdded,
            ghlNoteId: note.id
          }));

          return res.status(200).json({
            success: true,
            notes: transformedNotes
          });
        } catch (error: any) {
          console.error('[Notes API] Error fetching notes:', error.response?.data || error);
          return res.status(200).json({
            success: true,
            notes: []
          });
        }
      
      case 'POST':
        const { text, userId: noteUserId } = req.body;

        if (!text) {
          return res.status(400).json({ error: 'Note text is required' });
        }

        const ghlUserId = noteUserId || user?.ghlUserId || decoded.userId;

        try {
          const ghlUrl = `https://services.leadconnectorhq.com/contacts/${contact.ghlContactId}/notes`;
          
          const response = await axios.post(ghlUrl, {
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

          const createdNote = response.data;

          // Save to MongoDB
          await db.collection('notes').insertOne({
            _id: new ObjectId(),
            ghlNoteId: createdNote.id,
            contactId: contactId,
            locationId: locationId,
            body: text,
            createdBy: user?.name || 'User',
            createdByUserId: ghlUserId,
            createdAt: new Date(),
            source: 'mobile_app'
          });

          return res.status(201).json({
            success: true,
            note: {
              id: createdNote.id,
              body: text,
              createdBy: user?.name || 'User',
              createdAt: new Date(),
              ghlNoteId: createdNote.id
            }
          });
        } catch (error: any) {
          console.error('[Notes API] Error creating note:', error.response?.data || error);
          return res.status(500).json({ 
            error: 'Failed to create note',
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