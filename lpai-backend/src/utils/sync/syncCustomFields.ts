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
    model: 'opportunity',
    position: 0
  },
  {
    key: 'quote_number',
    name: 'Quote Number',
    dataType: 'TEXT',
    model: 'opportunity',
    position: 1
  },
  {
    key: 'signed_date',
    name: 'Signed Date',
    dataType: 'DATE',
    model: 'opportunity',
    position: 2
  }
];

export async function syncCustomFields(db: Db, location: any) {
  const startTime = Date.now();
  console.log(`[Sync Custom Fields] Starting for ${location.locationId}`);

  try {
    // Get auth header (OAuth or API key)
    const auth = await getAuthHeader(location);
    
    // Fetch custom fields from GHL - get all models
    const response = await axios.get(
      `https://services.leadconnectorhq.com/locations/${location.locationId}/customFields`,
      {
        headers: {
          'Authorization': auth.header,
          'Version': '2021-07-28',
          'Accept': 'application/json'
        },
        params: {
          model: 'all' // Get fields for all models
        }
      }
    );

    const customFields = response.data.customFields || [];
    console.log(`[Sync Custom Fields] Found ${customFields.length} custom fields in GHL`);

    // Organize fields by model
    const fieldsByModel: Record<string, any[]> = {};
    const fieldMapping: Record<string, Record<string, string>> = {};

    customFields.forEach((field: any) => {
      const model = field.model || 'unknown';
      if (!fieldsByModel[model]) {
        fieldsByModel[model] = [];
        fieldMapping[model] = {};
      }
      
      fieldsByModel[model].push({
        id: field.id,
        name: field.name,
        fieldKey: field.fieldKey,
        dataType: field.dataType,
        position: field.position,
        placeholder: field.placeholder || '',
        standard: field.standard || false
      });

      // Extract simple key from fieldKey (e.g., "opportunity.project_title" -> "project_title")
      const simpleKey = field.fieldKey?.includes('.') ? field.fieldKey.split('.')[1] : field.fieldKey;
      if (simpleKey) {
        fieldMapping[model][simpleKey] = field.id;
      }
    });

    // Check for our required fields
    const fieldsToCreate: any[] = [];
    const fieldsFound: any[] = [];

    for (const requiredField of REQUIRED_FIELDS) {
      const model = requiredField.model || 'opportunity';
      const existingField = fieldMapping[model]?.[requiredField.key];
      
      if (existingField) {
        console.log(`[Sync Custom Fields] Found existing field: ${requiredField.key} -> ${existingField}`);
        fieldsFound.push({
          key: requiredField.key,
          id: existingField,
          name: requiredField.name,
          model: model
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
          `https://services.leadconnectorhq.com/locations/${location.locationId}/customFields`,
          {
            name: fieldToCreate.name,
            dataType: fieldToCreate.dataType,
            position: fieldToCreate.position,
            model: fieldToCreate.model || 'opportunity'
            // Note: Do NOT send 'key' property - GHL doesn't accept it
          },
          {
            headers: {
              'Authorization': auth.header,
              'Version': '2021-07-28',
              'Accept': 'application/json',
              'Content-Type': 'application/json'
            }
          }
        );

        const createdField = createResponse.data.customField || createResponse.data;
        const model = fieldToCreate.model || 'opportunity';
        
        if (!fieldMapping[model]) {
          fieldMapping[model] = {};
        }
        fieldMapping[model][fieldToCreate.key] = createdField.id;
        
        console.log(`[Sync Custom Fields] Created field ${fieldToCreate.key} with ID: ${createdField.id}`);
      } catch (createError: any) {
        console.error(`[Sync Custom Fields] Failed to create field ${fieldToCreate.key}:`, createError.response?.data || createError.message);
      }
    }

    // Update location with custom field mappings organized by model
    const updateData: any = {
      customFieldsByModel: fieldsByModel,
      customFieldMapping: fieldMapping,
      lastCustomFieldSync: new Date()
    };

    // Also keep backward compatibility with opportunity fields
    updateData.ghlCustomFields = fieldMapping.opportunity || {};

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
      fieldsByModel: Object.keys(fieldsByModel).map(model => ({
        model,
        count: fieldsByModel[model].length
      })),
      fieldMapping,
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