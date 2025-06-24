import type { NextApiRequest, NextApiResponse } from 'next';
import { clientPromise } from '../../../../src/lib/mongodb';
import jwt from 'jsonwebtoken';
import { ObjectId } from 'mongodb';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { locationId } = req.query;
  
  if (!locationId || typeof locationId !== 'string') {
    return res.status(400).json({ error: 'Invalid locationId' });
  }

  try {
    const client = await clientPromise;
    const db = client.db('lpai');
    
    // Verify authentication
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authorization required' });
    }
    
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (!decoded?.userId) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    switch (req.method) {
      case 'GET':
        // Get location with settings
        const location = await db.collection('locations').findOne(
          { locationId },
          { 
            projection: { 
              smsPhoneNumbers: 1,
              emailSettings: 1,
              businessHours: 1,
              _id: 0 
            } 
          }
        );
        
        if (!location) {
          return res.status(404).json({ error: 'Location not found' });
        }
        
        return res.status(200).json({
          success: true,
          settings: {
            smsPhoneNumbers: location.smsPhoneNumbers || [],
            emailSettings: location.emailSettings || {},
            businessHours: location.businessHours || {}
          }
        });

      case 'PATCH':
        const { settingType, data } = req.body;
        
        if (!settingType || !data) {
          return res.status(400).json({ error: 'Missing settingType or data' });
        }
        
        // Check if user belongs to this location
        let userQuery: any = { locationId };
        
        // Handle both ObjectId and string userId formats
        try {
          userQuery._id = new ObjectId(decoded.userId);
        } catch (e) {
          // If userId is not a valid ObjectId, use it as a string
          userQuery.userId = decoded.userId;
        }
        
        const user = await db.collection('users').findOne(userQuery);
        
        if (!user) {
          // For development, let's log what we're looking for
          if (__DEV__) {
            console.log('[Location Settings] User not found with query:', userQuery);
            console.log('[Location Settings] Decoded token:', decoded);
          }
          return res.status(403).json({ error: 'Access denied' });
        }
        
        let updateData: any = {};
        
        switch (settingType) {
          case 'smsPhoneNumbers':
            // Validate and format SMS numbers
            const formattedNumbers = data.map((item: any, index: number) => {
              let formattedNumber = item.number.trim();
              
              // Remove all non-digits for validation
              const digitsOnly = formattedNumber.replace(/\D/g, '');
              
              // Format based on length
              if (digitsOnly.length === 10) {
                formattedNumber = `+1${digitsOnly}`;
              } else if (digitsOnly.length === 11 && digitsOnly[0] === '1') {
                formattedNumber = `+${digitsOnly}`;
              } else if (!formattedNumber.startsWith('+')) {
                // Keep as is if it's already international format
                formattedNumber = `+${digitsOnly}`;
              }
              
              return {
                _id: item._id || new ObjectId().toString(), // Store as string
                number: formattedNumber,
                label: item.label || `SMS Line ${index + 1}`,
                isDefault: item.isDefault || false,
                addedBy: decoded.userId,
                addedAt: item.addedAt || new Date(),
                updatedAt: new Date()
              };
            });
            
            // Ensure only one default
            const hasDefault = formattedNumbers.some((n: any) => n.isDefault);
            if (!hasDefault && formattedNumbers.length > 0) {
              formattedNumbers[0].isDefault = true;
            } else if (formattedNumbers.filter((n: any) => n.isDefault).length > 1) {
              // If multiple defaults, keep only the first one
              let foundFirst = false;
              formattedNumbers.forEach((n: any) => {
                if (n.isDefault) {
                  if (foundFirst) {
                    n.isDefault = false;
                  } else {
                    foundFirst = true;
                  }
                }
              });
            }
            
            updateData = { 
              smsPhoneNumbers: formattedNumbers,
              smsConfigUpdatedAt: new Date(),
              lastModifiedBy: decoded.userId
            };
            break;
            
          case 'emailSettings':
            updateData = { 
              emailSettings: {
                ...data,
                updatedAt: new Date()
              },
              emailSettingsUpdatedAt: new Date(),
              lastModifiedBy: decoded.userId
            };
            break;
            
          case 'businessHours':
            updateData = { 
              businessHours: {
                ...data,
                updatedAt: new Date()
              },
              businessHoursUpdatedAt: new Date(),
              lastModifiedBy: decoded.userId
            };
            break;
            
          default:
            return res.status(400).json({ error: 'Invalid setting type' });
        }
        
        const result = await db.collection('locations').updateOne(
          { locationId },
          { 
            $set: updateData,
            $currentDate: { lastModified: true }
          }
        );
        
        if (result.matchedCount === 0) {
          return res.status(404).json({ error: 'Location not found' });
        }
        
        return res.status(200).json({
          success: true,
          message: `${settingType} updated successfully`,
          modifiedCount: result.modifiedCount
        });

      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error: any) {
    console.error('[Location Settings API] Error:', error);
    return res.status(500).json({ 
      error: 'Failed to manage location settings',
      message: error.message,
      // Include more details in development
      ...(process.env.NODE_ENV === 'development' && { 
        stack: error.stack,
        details: error 
      })
    });
  }
}