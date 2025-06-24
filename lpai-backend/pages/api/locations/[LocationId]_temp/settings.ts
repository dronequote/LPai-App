// lpai-backend/pages/api/locations/[locationId]/settings.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import clientPromise from '../../../../../src/lib/mongodb';
import { getAuthHeader } from '../../../../src/utils/ghlAuth';
import { ObjectId } from 'mongodb';
import jwt from 'jsonwebtoken';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { locationId } = req.query;
  
  if (!locationId || typeof locationId !== 'string') {
    return res.status(400).json({ error: 'Location ID required' });
  }

  try {
    const client = await clientPromise;
    const db = client.db('lpai');
    
    // Verify user has access
    const authHeader = req.headers.authorization;
    const token = authHeader?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    
    switch (req.method) {
      case 'GET':
        // Get all location settings
        const location = await db.collection('locations').findOne(
          { locationId },
          { 
            projection: { 
              smsPhoneNumbers: 1,
              emailSettings: 1,
              businessHours: 1,
              notificationSettings: 1,
              // Add other settings fields as needed
            } 
          }
        );
        
        return res.status(200).json({
          success: true,
          settings: {
            smsPhoneNumbers: location?.smsPhoneNumbers || [],
            emailSettings: location?.emailSettings || {},
            businessHours: location?.businessHours || {},
            notificationSettings: location?.notificationSettings || {},
          }
        });

      case 'PATCH':
        // Update specific settings
        const { settingType, data } = req.body;
        
        // Verify admin for sensitive settings
        if (['smsPhoneNumbers', 'emailSettings'].includes(settingType)) {
          const user = await db.collection('users').findOne({ 
            _id: new ObjectId(decoded.userId),
            locationId,
            role: 'admin'
          });
          
          if (!user) {
            return res.status(403).json({ error: 'Admin access required' });
          }
        }
        
        let updateData = {};
        
        switch (settingType) {
          case 'smsPhoneNumbers':
            // Validate and format SMS numbers
            const formattedNumbers = data.map((item: any, index: number) => {
              let formattedNumber = item.number.trim();
              if (!formattedNumber.startsWith('+')) {
                formattedNumber = '+1' + formattedNumber.replace(/\D/g, '');
              }
              
              return {
                _id: item._id || new ObjectId(),
                number: formattedNumber,
                label: item.label || `SMS Line ${index + 1}`,
                isDefault: item.isDefault || false,
                addedBy: decoded.userId,
                addedAt: item.addedAt || new Date()
              };
            });
            
            // Ensure only one default
            const defaultIndex = formattedNumbers.findIndex((n: any) => n.isDefault);
            if (defaultIndex === -1 && formattedNumbers.length > 0) {
              formattedNumbers[0].isDefault = true;
            }
            
            updateData = { 
              smsPhoneNumbers: formattedNumbers,
              smsConfigUpdatedAt: new Date()
            };
            break;
            
          case 'emailSettings':
            updateData = { 
              emailSettings: data,
              emailSettingsUpdatedAt: new Date()
            };
            break;
            
          case 'businessHours':
            updateData = { 
              businessHours: data,
              businessHoursUpdatedAt: new Date()
            };
            break;
            
          default:
            return res.status(400).json({ error: 'Invalid setting type' });
        }
        
        await db.collection('locations').updateOne(
          { locationId },
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
    console.error('[Location Settings API] Error:', error);
    return res.status(500).json({ 
      error: 'Failed to manage location settings',
      message: error.message 
    });
  }
}