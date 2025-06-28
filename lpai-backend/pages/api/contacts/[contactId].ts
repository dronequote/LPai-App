// pages/api/contacts/[contactId].ts
// Updated: 06/27/2025
// Fixed: Use OAuth tokens from ghlOAuth field instead of deprecated API keys

import type { NextApiRequest, NextApiResponse } from 'next';
import clientPromise from '../../../src/lib/mongodb';
import { ObjectId } from 'mongodb';
import axios from 'axios';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const client = await clientPromise;
  const db = client.db('lpai');
  const { contactId } = req.query;

  if (!contactId || typeof contactId !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid contact ID' });
  }

  // GET: Fetch a single contact
  if (req.method === 'GET') {
    try {
      const contact = await db.collection('contacts').findOne({ _id: new ObjectId(contactId) });
      if (!contact) return res.status(404).json({ error: 'Contact not found' });
      return res.status(200).json(contact);
    } catch (err) {
      console.error('❌ Failed to fetch contact:', err);
      return res.status(500).json({ error: 'Failed to fetch contact' });
    }
  }

  // PATCH: Update contact + sync to GHL if OAuth token available
  if (req.method === 'PATCH') {
    try {
      const { firstName, lastName, email, phone, notes, address, secondaryPhone, city, state, postalCode, country, companyName, website, source, tags, assignedUserId } = req.body;

      // 1. Update locally in MongoDB
      const updateData: any = {
        updatedAt: new Date(),
      };
      
      // Only update fields that were provided
      if (firstName !== undefined) updateData.firstName = firstName;
      if (lastName !== undefined) updateData.lastName = lastName;
      if (email !== undefined) updateData.email = email;
      if (phone !== undefined) updateData.phone = phone;
      if (notes !== undefined) updateData.notes = notes;
      if (address !== undefined) updateData.address = address;
      if (secondaryPhone !== undefined) updateData.secondaryPhone = secondaryPhone;
      if (city !== undefined) updateData.city = city;
      if (state !== undefined) updateData.state = state;
      if (postalCode !== undefined) updateData.postalCode = postalCode;
      if (country !== undefined) updateData.country = country;
      if (companyName !== undefined) updateData.companyName = companyName;
      if (website !== undefined) updateData.website = website;
      if (source !== undefined) updateData.source = source;
      if (tags !== undefined) updateData.tags = tags;
      if (assignedUserId !== undefined) updateData.assignedUserId = assignedUserId;

      const result = await db.collection('contacts').updateOne(
        { _id: new ObjectId(contactId) },
        { $set: updateData }
      );

      if (result.matchedCount === 0) {
        return res.status(404).json({ error: 'Contact not found' });
      }

      const updated = await db.collection('contacts').findOne({ _id: new ObjectId(contactId) });

      if (!updated?.ghlContactId || !updated?.locationId) {
        console.log('ℹ️ Skipping GHL sync: missing ghlContactId or locationId');
        return res.status(200).json({ success: true, contact: updated });
      }

      // 2. Check if location has OAuth tokens
      const locationDoc = await db.collection('locations').findOne({ locationId: updated.locationId });
      const accessToken = locationDoc?.ghlOAuth?.accessToken;

      if (!accessToken) {
        console.log('ℹ️ GHL sync skipped: no OAuth token for location', updated.locationId);
        return res.status(200).json({ success: true, contact: updated });
      }

      // 3. Prepare GHL payload - only include fields that GHL accepts
      const ghlPayload: Record<string, any> = {};
      
      // Basic fields that GHL accepts
      if (firstName !== undefined) ghlPayload.firstName = updated.firstName;
      if (lastName !== undefined) ghlPayload.lastName = updated.lastName;
      if (email !== undefined) ghlPayload.email = updated.email;
      if (phone !== undefined) ghlPayload.phone = updated.phone;
      if (address !== undefined) ghlPayload.address1 = updated.address;
      if (city !== undefined) ghlPayload.city = updated.city;
      if (state !== undefined) ghlPayload.state = updated.state;
      if (postalCode !== undefined) ghlPayload.postalCode = updated.postalCode;
      if (country !== undefined) ghlPayload.country = updated.country;
      if (companyName !== undefined) ghlPayload.companyName = updated.companyName;
      if (website !== undefined) ghlPayload.website = updated.website;
      if (source !== undefined) ghlPayload.source = updated.source;
      if (tags !== undefined && Array.isArray(tags)) ghlPayload.tags = updated.tags;
      
      // Note: assignedUserId is internal to our system, not synced to GHL
      
      // 4. Set up headers with OAuth token
      const ghlHeaders = {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        Version: '2021-07-28',
      };

      // Log sync details in development
      console.log('🔄 Syncing to GHL with OAuth');
      console.log('Contact ID:', updated.ghlContactId);

      // 5. Push changes to GHL (LeadConnector) API
      try {
        await axios.put(
          `https://services.leadconnectorhq.com/contacts/${updated.ghlContactId}`,
          ghlPayload,
          { headers: ghlHeaders }
        );
        console.log('✅ Contact synced to GHL:', updated.ghlContactId);
      } catch (ghlError: any) {
        console.error('⚠️ GHL sync failed:', ghlError.response?.data?.message || ghlError.message);
        // Don't fail the request - local update succeeded
        // Just log the sync failure
      }

      return res.status(200).json({ success: true, contact: updated });
    } catch (err) {
      console.error('❌ Failed to update contact:', err);
      return res.status(500).json({ error: 'Failed to update contact' });
    }
  }

  // DELETE: Delete contact
  if (req.method === 'DELETE') {
    try {
      const contact = await db.collection('contacts').findOne({ _id: new ObjectId(contactId) });
      if (!contact) {
        return res.status(404).json({ error: 'Contact not found' });
      }

      // Delete from MongoDB
      await db.collection('contacts').deleteOne({ _id: new ObjectId(contactId) });

      // Optionally sync deletion to GHL if OAuth token available
      if (contact.ghlContactId && contact.locationId) {
        const locationDoc = await db.collection('locations').findOne({ locationId: contact.locationId });
        const accessToken = locationDoc?.ghlOAuth?.accessToken;

        if (accessToken) {
          try {
            await axios.delete(
              `https://services.leadconnectorhq.com/contacts/${contact.ghlContactId}`,
              {
                headers: {
                  Authorization: `Bearer ${accessToken}`,
                  Version: '2021-07-28',
                }
              }
            );
            console.log('✅ Contact deleted from GHL:', contact.ghlContactId);
          } catch (ghlError: any) {
            console.error('⚠️ GHL deletion failed:', ghlError.response?.data?.message || ghlError.message);
            // Don't fail - local deletion succeeded
          }
        }
      }

      return res.status(200).json({ success: true, message: 'Contact deleted' });
    } catch (err) {
      console.error('❌ Failed to delete contact:', err);
      return res.status(500).json({ error: 'Failed to delete contact' });
    }
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
}