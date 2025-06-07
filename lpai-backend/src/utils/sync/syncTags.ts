// src/utils/sync/syncTags.ts
import axios from 'axios';
import { Db, ObjectId } from 'mongodb';
import { getAuthHeader } from '../ghlAuth';

export async function syncTags(db: Db, location: any) {
  const startTime = Date.now();
  console.log(`[Sync Tags] Starting for ${location.locationId}`);

  try {
    const auth = await getAuthHeader(location);
    
    // Use the proper tags endpoint from GHL
    const response = await axios.get(
      `https://services.leadconnectorhq.com/locations/${location.locationId}/tags`,
      {
        headers: {
          'Authorization': auth.header,
          'Version': '2021-07-28',
          'Accept': 'application/json'
        }
      }
    );

    const tagsResponse = response.data;
    const ghlTags = tagsResponse.tags || [];
    
    console.log(`[Sync Tags] Found ${ghlTags.length} tags from GHL`);

    // Clear existing tags for this location
    await db.collection('tags').deleteMany({ locationId: location.locationId });

    // Insert tags into database
    if (ghlTags.length > 0) {
      const tagsToInsert = ghlTags.map((tag: any) => {
        // Tags from GHL have structure: { id, name, locationId }
        const tagName = tag.name || '';  // Handle empty names
        
        return {
          _id: new ObjectId(),
          locationId: location.locationId,
          name: tagName,
          ghlTagId: tag.id,
          slug: tagName ? tagName.toLowerCase().replace(/[^a-z0-9]+/g, '-') : 'no-name',
          color: generateTagColor(tagName || 'default'),
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date()
        };
      });

      await db.collection('tags').insertMany(tagsToInsert);
      
      // Log some example tags for debugging
      console.log(`[Sync Tags] Sample tags inserted:`, tagsToInsert.slice(0, 3).map(t => ({ name: t.name, id: t.ghlTagId })));
    }

    // Update location with tag sync info
    await db.collection('locations').updateOne(
      { _id: location._id },
      {
        $set: {
          tagCount: ghlTags.length,
          lastTagSync: new Date()
        }
      }
    );

    const duration = Date.now() - startTime;
    console.log(`[Sync Tags] Completed in ${duration}ms`);

    return {
      success: true,
      totalTags: ghlTags.length,
      duration: `${duration}ms`
    };

  } catch (error: any) {
    console.error(`[Sync Tags] Error:`, error.response?.data || error.message);
    
    if (error.response?.status === 401) {
      throw new Error('Authentication failed - invalid token or API key');
    }
    
    throw error;
  }
}

function generateTagColor(tag: string): string {
  const colors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FECA57',
    '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E2',
    '#F8C471', '#E8DAEF', '#A2D9CE', '#FAD7A0', '#D5A6BD'
  ];
  
  let hash = 0;
  for (let i = 0; i < tag.length; i++) {
    hash = tag.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  return colors[Math.abs(hash) % colors.length];
}