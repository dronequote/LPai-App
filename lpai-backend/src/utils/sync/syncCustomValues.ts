// src/utils/sync/syncCustomValues.ts
import axios from 'axios';
import { Db } from 'mongodb';
import { getAuthHeader } from '../ghlAuth';

export async function syncCustomValues(db: Db, location: any) {
  const startTime = Date.now();
  console.log(`[Sync Custom Values] Starting for ${location.locationId}`);

  try {
    // Get auth header (OAuth or API key)
    const auth = await getAuthHeader(location);
    
    // Fetch custom values from GHL
    const response = await axios.get(
      `https://services.leadconnectorhq.com/locations/${location.locationId}/customValues`,
      {
        headers: {
          'Authorization': auth.header,
          'Version': '2021-07-28',
          'Accept': 'application/json'
        }
      }
    );

    const customValues = response.data.customValues || [];
    console.log(`[Sync Custom Values] Found ${customValues.length} custom values in GHL`);

    // Transform custom values into a key-value object for easier access
    const customValuesMap: Record<string, any> = {};
    
    for (const cv of customValues) {
      // Store by both id and name for flexibility
      if (cv.id) {
        customValuesMap[cv.id] = cv.value || null;
      }
      if (cv.name) {
        // Convert name to camelCase for easier access
        const camelCaseName = cv.name
          .replace(/(?:^\w|[A-Z]|\b\w)/g, (word: string, index: number) => {
            return index === 0 ? word.toLowerCase() : word.toUpperCase();
          })
          .replace(/\s+/g, '');
        
        customValuesMap[camelCaseName] = cv.value || null;
      }
    }

    // Update location with custom values
    const updateResult = await db.collection('locations').updateOne(
      { _id: location._id },
      {
        $set: {
          customValues: customValuesMap,
          customValuesRaw: customValues, // Keep raw data for reference
          lastCustomValuesSync: new Date()
        }
      }
    );

    const duration = Date.now() - startTime;
    console.log(`[Sync Custom Values] Completed in ${duration}ms - Found ${customValues.length} values`);

    // Log some example values for debugging
    if (customValues.length > 0) {
      console.log(`[Sync Custom Values] Example values:`, 
        customValues.slice(0, 3).map((cv: any) => ({
          name: cv.name,
          value: cv.value
        }))
      );
    }

    return {
      success: true,
      count: customValues.length,
      updated: updateResult.modifiedCount > 0,
      customValues: customValuesMap,
      duration: `${duration}ms`
    };

  } catch (error: any) {
    console.error(`[Sync Custom Values] Error:`, error.response?.data || error.message);
    
    // Handle specific error cases
    if (error.response?.status === 404) {
      console.log(`[Sync Custom Values] Custom values endpoint not found or no values set`);
      return {
        success: true, // Not really an error if no custom values exist
        count: 0,
        updated: false,
        customValues: {},
        error: 'No custom values found'
      };
    }
    
    if (error.response?.status === 401) {
      throw new Error('Authentication failed - invalid token or API key');
    }
    
    if (error.response?.status === 403) {
      throw new Error('Access denied - check permissions for custom values');
    }
    
    throw error;
  }
}