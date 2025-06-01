// src/utils/sync/syncCustomFields.ts
import axios from 'axios';
import { Db } from 'mongodb';
import { getAuthHeader } from '../ghlAuth';

// Our required custom fields
const REQUIRED_FIELDS = [
  {
    key: 'project_title',
    name: 'Project Title',
    dataType: 'TEXT',
    position: 0
  },
  {
    key: 'quote_number',
    name: 'Quote Number',
    dataType: 'TEXT',
    position: 1
  },
  {
    key: 'signed_date',
    name: 'Signed Date',
    dataType: 'DATE',
    position: 2
  }
];

export async function syncCustomFields(db: Db, location: any) {
  const startTime = Date.now();
  console.log(`[Sync Custom Fields] Starting for ${location.locationId}`);

  try {
    // Get auth header (OAuth or API key)
    const auth = await getAuthHeader(location);
    
    // Fetch custom fields from GHL
    const response = await axios.get(
      'https://services.leadconnectorhq.com/locations/customFields',
      {
        headers: {
          'Authorization': auth.header,
          'Version': '2021-07-28',
          'Accept': 'application/json'
        },
        params: {
          locationId: location.locationId
        }
      }
    );

    const customFields = response.data.customFields || [];
    console.log(`[Sync Custom Fields] Found ${customFields.length} custom fields in GHL`);

    // Create a map of existing fields by key
    const existingFieldsMap = new Map();
    customFields.forEach((field: any) => {
      // Some fields might have the key in different places
      const fieldKey = field.key || field.fieldKey || field.name?.toLowerCase().replace(/\s+/g, '_');
      if (fieldKey) {
        existingFieldsMap.set(fieldKey, field);
      }
    });

    // Track what we find and create
    const fieldMapping: Record<string, string> = {};
    const fieldsToCreate: any[] = [];
    const fieldsFound: any[] = [];

    // Check for our required fields
    for (const requiredField of REQUIRED_FIELDS) {
      const existingField = existingFieldsMap.get(requiredField.key);
      
      if (existingField) {
        console.log(`[Sync Custom Fields] Found existing field: ${requiredField.key} -> ${existingField.id}`);
        fieldMapping[requiredField.key] = existingField.id;
        fieldsFound.push({
          key: requiredField.key,
          id: existingField.id,
          name: existingField.name
        });
      } else {
        console.log(`[Sync Custom Fields] Need to create field: ${requiredField.key}`);
        fieldsToCreate.push(requiredField);
      }
    }

    // Create missing fields
    for (const fieldToCreate of fieldsToCreate) {
      try {
        console.log(`[Sync Custom Fields] Creating field: ${fieldToCreate.name}`);
        
        const createResponse = await axios.post(
          'https://services.leadconnectorhq.com/locations/customFields',
          {
            locationId: location.locationId,
            name: fieldToCreate.name,
            key: fieldToCreate.key,
            dataType: fieldToCreate.dataType,
            position: fieldToCreate.position,
            model: 'opportunity'  // These fields are for opportunities/projects
          },
          {
            headers: {
              'Authorization': auth.header,
              'Version': '2021-07-28',
              'Content-Type': 'application/json'
            }
          }
        );

        const createdField = createResponse.data.customField || createResponse.data;
        fieldMapping[fieldToCreate.key] = createdField.id;
        
        console.log(`[Sync Custom Fields] Created field ${fieldToCreate.key} with ID: ${createdField.id}`);
      } catch (createError: any) {
        console.error(`[Sync Custom Fields] Failed to create field ${fieldToCreate.key}:`, createError.response?.data || createError.message);
      }
    }

    // Update location with custom field mappings
    const updateData: any = {
      ghlCustomFields: fieldMapping,
      lastCustomFieldSync: new Date()
    };

    // Also store all custom fields for reference
    updateData.allCustomFields = customFields.map((field: any) => ({
      id: field.id,
      name: field.name,
      key: field.key || field.fieldKey,
      dataType: field.dataType,
      model: field.model,
      position: field.position
    }));

    await db.collection('locations').updateOne(
      { _id: location._id },
      { $set: updateData }
    );

    const duration = Date.now() - startTime;
    console.log(`[Sync Custom Fields] Completed in ${duration}ms`);

    return {
      success: true,
      totalFields: customFields.length,
      requiredFieldsFound: fieldsFound.length,
      fieldsCreated: fieldsToCreate.length,
      fieldMapping,
      allFields: updateData.allCustomFields,
      duration: `${duration}ms`
    };

  } catch (error: any) {
    console.error(`[Sync Custom Fields] Error:`, error.response?.data || error.message);
    
    // Handle specific error cases
    if (error.response?.status === 404) {
      console.log(`[Sync Custom Fields] Custom fields endpoint not found`);
      return {
        success: false,
        totalFields: 0,
        requiredFieldsFound: 0,
        fieldsCreated: 0,
        fieldMapping: {},
        error: 'Custom fields endpoint not found'
      };
    }
    
    if (error.response?.status === 401) {
      throw new Error('Authentication failed - invalid token or API key');
    }
    
    if (error.response?.status === 403) {
      throw new Error('Access denied - check permissions for custom fields');
    }
    
    throw error;
  }
}