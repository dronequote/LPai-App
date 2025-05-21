import type { NextApiRequest, NextApiResponse } from 'next';
import clientPromise from '../../../src/lib/mongodb';
import { ObjectId } from 'mongodb';
import axios from 'axios';
import { Resend } from 'resend';

const GHL_BASE_URL = 'https://services.leadconnectorhq.com';

// Initialize Resend
const resend = new Resend(process.env.RESEND_API_KEY);

// Email notification utility
async function sendNotificationEmail({ subject, text }: { subject: string; text: string }) {
  try {
    await resend.emails.send({
      from: 'LPai App <info@leadprospecting.ai>',
      to: [process.env.ADMIN_EMAIL || 'info@leadprospecting.ai'],
      subject,
      text,
    });
  } catch (err) {
    console.error('[Resend] Failed to send notification email:', err);
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const client = await clientPromise;
  const db = client.db('lpai');
  const { id } = req.query;

  // === LOG: Confirm we're using [id].ts ===
  console.log(`[API] [id].ts called for /api/appointments/${id} with method: ${req.method}`);

  // POST should never be called on this route
  if (req.method === 'POST') {
    console.warn(`[API] Attempted POST to [id].ts for appointment ${id} - this is NOT allowed.`);
    return res.status(405).json({ error: 'POST not allowed here. Use /api/appointments.' });
  }
  if (!id || typeof id !== 'string') return res.status(400).json({ error: 'Missing appointment id' });

  // GET (fetch by id or by GHL event id)
  if (req.method === 'GET') {
    const { source } = req.query;
    try {
      if (source === 'ghl') {
        const appt = await db.collection('appointments').findOne({
          $or: [{ _id: new ObjectId(id) }, { ghlAppointmentId: id }]
        });
        if (!appt) return res.status(404).json({ error: 'Appointment not found' });
        const location = await db.collection('locations').findOne({ locationId: appt.locationId });
        if (!location?.apiKey || !appt.ghlAppointmentId) {
          return res.status(400).json({ error: 'Missing GHL data for this appointment' });
        }
        const ghlRes = await axios.get(
          `${GHL_BASE_URL}/calendars/events/appointments/${appt.ghlAppointmentId}`,
          {
            headers: {
              'Authorization': `Bearer ${location.apiKey}`,
              'Version': '2021-04-15',
              'Accept': 'application/json',
            }
          }
        );
        return res.status(200).json(ghlRes.data);
      } else {
        const appt = await db.collection('appointments').findOne({ _id: new ObjectId(id) });
        if (!appt) return res.status(404).json({ error: 'Appointment not found' });
        return res.status(200).json(appt);
      }
    } catch (err) {
      console.error('[API] [id].ts GET error:', err);
      return res.status(500).json({ error: 'Failed to fetch appointment', details: err instanceof Error ? err.message : err });
    }
  }

  // PATCH/PUT (update)
  if (req.method === 'PATCH' || req.method === 'PUT') {
    const updateFields = req.body || {};
    try {
      const appt = await db.collection('appointments').findOne({ _id: new ObjectId(id) });
      if (!appt) return res.status(404).json({ error: 'Appointment not found' });
      const location = await db.collection('locations').findOne({ locationId: appt.locationId });
      if (!location?.apiKey || !appt.ghlAppointmentId) {
        return res.status(400).json({ error: 'Missing GHL data for this appointment' });
      }

      // Update Mongo
      await db.collection('appointments').updateOne({ _id: new ObjectId(id) }, { $set: { ...updateFields } });

      // Log before sending PATCH to GHL
      console.log(`[API] PATCH/PUT appointment ${id} with fields:`, updateFields);

      // Update GHL
      const payload = {
        title: updateFields.title ?? appt.title,
        meetingLocationType: updateFields.meetingLocationType ?? appt.meetingLocationType ?? 'custom',
        meetingLocationId: updateFields.meetingLocationId ?? appt.meetingLocationId ?? 'default',
        appointmentStatus: updateFields.appointmentStatus ?? 'new',
        assignedUserId: updateFields.userId ?? appt.userId,
        address: updateFields.address ?? appt.address ?? '',
        calendarId: updateFields.calendarId ?? appt.calendarId,
        locationId: appt.locationId,
        contactId: appt.contactId,
        startTime: updateFields.start ?? appt.start,
        endTime: updateFields.end ?? appt.end,
        notes: updateFields.notes ?? appt.notes,
      };

      console.log(`[API] Sending PATCH to GHL for appointment ${id}:`, payload);

      const ghlRes = await axios.put(
        `${GHL_BASE_URL}/calendars/events/appointments/${appt.ghlAppointmentId}`,
        payload,
        {
          headers: {
            'Authorization': `Bearer ${location.apiKey}`,
            'Version': '2021-04-15',
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          }
        }
      );
      return res.status(200).json({ success: true, updated: updateFields, ghl: ghlRes.data });
    } catch (err: any) {
      console.error(`[API] [id].ts PATCH/PUT error for appointment ${id}:`, err?.response?.data || err.message || err);
      return res.status(500).json({ error: 'Failed to update appointment', details: err?.response?.data || err.message || err });
    }
  }

  // DELETE (delete appointment in Mongo & GHL)
  if (req.method === 'DELETE') {
    try {
      // 1. Find original appointment (need locationId & ghlAppointmentId)
      const appt = await db.collection('appointments').findOne({ _id: new ObjectId(id) });
      if (!appt) return res.status(404).json({ error: 'Appointment not found' });

      // 2. Delete from Mongo first
      await db.collection('appointments').deleteOne({ _id: new ObjectId(id) });

      // 3. Attempt to delete from GHL if possible
      let ghlDelete = null;
      if (appt.ghlAppointmentId && appt.locationId) {
        const location = await db.collection('locations').findOne({ locationId: appt.locationId });
        if (location?.apiKey) {
          try {
            const ghlRes = await axios.delete(
              `${GHL_BASE_URL}/calendars/events/appointments/${appt.ghlAppointmentId}`,
              {
                headers: {
                  'Authorization': `Bearer ${location.apiKey}`,
                  'Version': '2021-04-15',
                  'Accept': 'application/json',
                }
              }
            );
            ghlDelete = { status: 'deleted', ghlResponse: ghlRes.data };
            console.log(`[API] Successfully deleted GHL appointment: ${appt.ghlAppointmentId}`);
          } catch (ghlErr: any) {
            ghlDelete = { status: 'error', ghlError: ghlErr?.response?.data || ghlErr.message };
            // --- Send notification if GHL delete failed ---
            await sendNotificationEmail({
              subject: '[LPai] GHL Appointment Delete FAILED',
              text: `
GHL appointment failed to delete!

Mongo _id: ${id}
GHL Appointment ID: ${appt.ghlAppointmentId}
Location ID: ${appt.locationId}
Contact ID: ${appt.contactId}
Time: ${appt.start} - ${appt.end}

Error:
${JSON.stringify(ghlDelete.ghlError, null, 2)}
              `,
            });
            console.error(`[API] GHL appointment delete failed for: ${appt.ghlAppointmentId}`, ghlDelete.ghlError);
          }
        }
      }

      return res.status(200).json({ success: true, mongoDeleted: true, ghlDelete });
    } catch (err: any) {
      console.error(`[API] [id].ts DELETE error for appointment ${id}:`, err?.response?.data || err.message || err);
      return res.status(500).json({ error: 'Failed to delete appointment', details: err?.response?.data || err.message || err });
    }
  }

  res.setHeader('Allow', ['GET', 'PATCH', 'PUT', 'DELETE']);
  return res.status(405).json({ error: `Method ${req.method} not allowed` });
}
