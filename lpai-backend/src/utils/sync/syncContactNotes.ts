// src/utils/sync/syncContactNotes.ts
import axios from 'axios';
import { Db, ObjectId } from 'mongodb';
import { getAuthHeader } from '../ghlAuth';

export async function syncContactNotes(db: Db, location: any, contactId: string) {
  try {
    const auth = await getAuthHeader(location);
    
    // Find the contact in our DB to get GHL ID
    const contact = await db.collection('contacts').findOne({
      _id: new ObjectId(contactId),
      locationId: location.locationId
    });
    
    if (!contact || !contact.ghlContactId) {
      return { success: false, error: 'Contact not found or no GHL ID' };
    }
    
    // Fetch notes from GHL
    const response = await axios.get(
      `https://services.leadconnectorhq.com/contacts/${contact.ghlContactId}/notes`,
      {
        headers: {
          'Authorization': auth.header,
          'Version': '2021-07-28',
          'Accept': 'application/json'
        }
      }
    );

    const ghlNotes = response.data.notes || [];
    
    // Process and save notes
    let created = 0;
    for (const note of ghlNotes) {
      const exists = await db.collection('notes').findOne({
        ghlNoteId: note.id,
        contactId: contactId
      });
      
      if (!exists) {
        await db.collection('notes').insertOne({
          _id: new ObjectId(),
          ghlNoteId: note.id,
          contactId: contactId,
          locationId: location.locationId,
          body: note.body,
          createdBy: note.userId,
          ghlCreatedAt: new Date(note.dateAdded),
          createdAt: new Date()
        });
        created++;
      }
    }
    
    return { 
      success: true, 
      created,
      total: ghlNotes.length 
    };
    
  } catch (error: any) {
    console.error('Error syncing contact notes:', error);
    return { success: false, error: error.message };
  }
}