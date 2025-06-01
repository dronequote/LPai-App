// src/utils/sync/syncLocationDetails.ts
import axios from 'axios';
import { Db } from 'mongodb';
import { getAuthHeader } from '../ghlAuth';

export async function syncLocationDetails(db: Db, location: any) {
  const startTime = Date.now();
  console.log(`[Sync Location Details] Starting for ${location.locationId}`);

  try {
    // Get auth header (OAuth or API key)
    const auth = await getAuthHeader(location);
    
    // Fetch location details from GHL
    const response = await axios.get(
      `https://services.leadconnectorhq.com/locations/${location.locationId}`,
      {
        headers: {
          'Authorization': auth.header,
          'Version': '2021-07-28',
          'Accept': 'application/json'
        }
      }
    );

    const locationData = response.data.location || response.data;
    console.log(`[Sync Location Details] Fetched data for: ${locationData.name}`);

    // Map GHL fields to our schema
    const updateData = {
      // Basic Information
      name: locationData.name || location.name,
      address: locationData.address || '',
      city: locationData.city || '',
      state: locationData.state || '',
      country: locationData.country || 'US',
      postalCode: locationData.postalCode || '',
      
      // Contact Information
      email: locationData.email || '',
      phone: locationData.phone || '',
      website: locationData.website || '',
      
      // Business Details
      business: {
        name: locationData.business?.name || locationData.name,
        address: locationData.business?.address || locationData.address || '',
        city: locationData.business?.city || locationData.city || '',
        state: locationData.business?.state || locationData.state || '',
        country: locationData.business?.country || locationData.country || 'US',
        postalCode: locationData.business?.postalCode || locationData.postalCode || '',
        website: locationData.business?.website || locationData.website || '',
        timezone: locationData.business?.timezone || locationData.timezone || 'America/Chicago',
        logoUrl: locationData.business?.logoUrl || locationData.logoUrl || '',
        email: locationData.business?.email || locationData.email || ''
      },
      
      // Settings
      timezone: locationData.timezone || 'America/Chicago',
      settings: locationData.settings || {},
      social: locationData.social || {},
      
      // Integration Details
      companyId: locationData.companyId || location.companyId,
      
      // Sync Metadata
      lastDetailSync: new Date(),
      updatedAt: new Date()
    };

    // Handle settings object
    if (locationData.settings) {
      updateData.settings = {
        allowDuplicateContact: locationData.settings.allowDuplicateContact || false,
        allowDuplicateOpportunity: locationData.settings.allowDuplicateOpportunity || false,
        allowFacebookNameMerge: locationData.settings.allowFacebookNameMerge || false,
        disableContactTimezone: locationData.settings.disableContactTimezone || false,
        contactUniqueIdentifiers: locationData.settings.contactUniqueIdentifiers || ['email', 'phone'],
        ...locationData.settings
      };
    }

    // Handle social links
    if (locationData.social) {
      updateData.social = {
        facebookUrl: locationData.social.facebookUrl || '',
        googlePlus: locationData.social.googlePlus || '',
        linkedIn: locationData.social.linkedIn || '',
        foursquare: locationData.social.foursquare || '',
        twitter: locationData.social.twitter || '',
        yelp: locationData.social.yelp || '',
        instagram: locationData.social.instagram || '',
        youtube: locationData.social.youtube || '',
        pinterest: locationData.social.pinterest || '',
        blogRss: locationData.social.blogRss || '',
        googlePlacesId: locationData.social.googlePlacesId || ''
      };
    }

    // Update location in database
    const result = await db.collection('locations').updateOne(
      { _id: location._id },
      { $set: updateData }
    );

    const duration = Date.now() - startTime;
    console.log(`[Sync Location Details] Completed in ${duration}ms`);

    return {
      updated: result.modifiedCount > 0,
      locationName: updateData.name,
      fieldsUpdated: Object.keys(updateData).length,
      duration: `${duration}ms`
    };

  } catch (error: any) {
    console.error(`[Sync Location Details] Error:`, error.response?.data || error.message);
    
    // If it's a 404, the location might not exist in GHL
    if (error.response?.status === 404) {
      throw new Error('Location not found in GHL');
    }
    
    // If it's a 401, auth might be invalid
    if (error.response?.status === 401) {
      throw new Error('Authentication failed - invalid token or API key');
    }
    
    throw error;
  }
}