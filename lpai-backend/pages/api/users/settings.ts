// lpai-backend/pages/api/users/settings.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import clientPromise from '../../../src/lib/mongodb';
import { ObjectId } from 'mongodb';
import jwt from 'jsonwebtoken';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    const userId = decoded.userId;
    
    const client = await clientPromise;
    const db = client.db('lpai');
    
    switch (req.method) {
      case 'GET':
        // Get all user settings
        const user = await db.collection('users').findOne(
          { _id: new ObjectId(userId) },
          { 
            projection: { 
              preferredSmsNumberId: 1,
              notificationPreferences: 1,
              displayPreferences: 1,
              locationId: 1
            } 
          }
        );
        
        if (!user) {
          return res.status(404).json({ error: 'User not found' });
        }
        
        // Get location-specific data if needed
        const location = await db.collection('locations').findOne(
          { locationId: user.locationId },
          { projection: { smsPhoneNumbers: 1 } }
        );
        
        return res.status(200).json({
          success: true,
          settings: {
            preferredSmsNumberId: user.preferredSmsNumberId || null,
            notificationPreferences: user.notificationPreferences || {},
            displayPreferences: user.displayPreferences || {},
            // Include available options
            availableSmsNumbers: location?.smsPhoneNumbers || []
          }
        });

      case 'PATCH':
        // Update specific user settings
        const { settingType, value } = req.body;
        
        let updateData = {};
        
        switch (settingType) {
          case 'smsPreference':
            // Verify the number exists
            const userLoc = await db.collection('users').findOne(
              { _id: new ObjectId(userId) },
              { projection: { locationId: 1 } }
            );
            
            const locationCheck = await db.collection('locations').findOne({
              locationId: userLoc.locationId,
              'smsPhoneNumbers._id': new ObjectId(value)
            });
            
            if (!locationCheck) {
              return res.status(400).json({ error: 'Invalid SMS number selection' });
            }
            
            updateData = {
              preferredSmsNumberId: new ObjectId(value),
              smsPreferenceUpdatedAt: new Date()
            };
            break;
            
          case 'notifications':
            updateData = {
              notificationPreferences: value,
              notificationPreferencesUpdatedAt: new Date()
            };
            break;
            
          case 'display':
            updateData = {
              displayPreferences: value,
              displayPreferencesUpdatedAt: new Date()
            };
            break;
            
          default:
            return res.status(400).json({ error: 'Invalid setting type' });
        }
        
        await db.collection('users').updateOne(
          { _id: new ObjectId(userId) },
          { $set: updateData }
        );
        
        return res.status(200).json({
          success: true,
          message: `${settingType} updated successfully`
        });

      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error: any) {
    console.error('[User Settings API] Error:', error);
    return res.status(500).json({ 
      error: 'Failed to manage user settings',
      message: error.message 
    });
  }
}