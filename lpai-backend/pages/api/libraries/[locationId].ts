import type { NextApiRequest, NextApiResponse } from 'next';
import clientPromise from '../../../src/lib/mongodb';
import { ObjectId } from 'mongodb';
import cors from '@/lib/cors';
import {
  sendSuccess,
  sendBadRequest,
  sendUnauthorized,
  sendServerError,
  sendNotFound
} from '../../../src/utils/httpResponses';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  await cors(req, res);
  const { locationId } = req.query;
  
  if (!locationId || typeof locationId !== 'string') {
    return res.status(400).json({ error: 'Missing locationId' });
  }

  const client = await clientPromise;
  const db = client.db('lpai');

  switch (req.method) {
    case 'GET':
      return await getLibraries(db, locationId, res);
    case 'POST':
      return await createLibrary(db, locationId, req.body, res);
    case 'PATCH':
      return await patchLibrary(db, locationId, req.body, res);
    default:
      res.setHeader('Allow', ['GET', 'POST', 'PATCH']);
      return res.status(405).json({ error: `Method ${req.method} not allowed` });
  }
}

async function getLibraries(db: any, locationId: string, res: NextApiResponse) {
  try {
    console.log(`[LIBRARIES API] Fetching libraries for locationId: ${locationId}`);

    const libraries = await db.collection('libraries').find({
      locationId: locationId,
    }).toArray();

    console.log(`[LIBRARIES API] Found ${libraries.length} libraries`);

    if (libraries.length === 0) {
      console.log(`[LIBRARIES API] No libraries found, creating default library`);

      const now = new Date().toISOString();
      const defaultLibrary = {
        locationId,
        name: 'Main Product Library',
        categories: [
          {
            id: new ObjectId().toString(),
            name: 'Fixtures',
            description: 'Toilets, sinks, faucets, and other fixtures',
            icon: 'home-outline',
            items: [],
            isActive: true,
            sortOrder: 1,
            createdAt: now,
            updatedAt: now,
          },
          {
            id: new ObjectId().toString(),
            name: 'Piping',
            description: 'Pipes, fittings, and connections',
            icon: 'git-branch-outline',
            items: [],
            isActive: true,
            sortOrder: 2,
            createdAt: now,
            updatedAt: now,
          },
          {
            id: new ObjectId().toString(),
            name: 'Labor',
            description: 'Installation and service work',
            icon: 'hammer-outline',
            items: [],
            isActive: true,
            sortOrder: 3,
            createdAt: now,
            updatedAt: now,
          },
        ],
        isDefault: true,
        createdBy: 'system',
        createdAt: now,
        updatedAt: now,
      };

      const result = await db.collection('libraries').insertOne(defaultLibrary);
      const createdLibrary = { ...defaultLibrary, _id: result.insertedId };

      return sendSuccess(res, [createdLibrary], 'Default library created');
    }

    return sendSuccess(res, libraries, 'Libraries fetched successfully');
  } catch (error) {
    console.error('[LIBRARIES API] Error fetching libraries:', error);
    return sendServerError(res, error, 'Failed to fetch libraries');
  }
}

// 🆕 POST: Create new library
async function createLibrary(db: any, locationId: string, body: any, res: NextApiResponse) {
  try {
    const { name, categories = [] } = body;
    
    if (!name) {
      return res.status(400).json({ error: 'Library name is required' });
    }
    
    const newLibrary = {
      locationId,
      name,
      categories: categories.map((cat: any) => ({
        ...cat,
        id: cat.id || new ObjectId().toString(),
        items: cat.items || [],
        isActive: cat.isActive !== false,
        sortOrder: cat.sortOrder || 0,
        createdAt: cat.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })),
      isDefault: false,
      createdBy: body.createdBy || 'unknown',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    const result = await db.collection('libraries').insertOne(newLibrary);
    const createdLibrary = { ...newLibrary, _id: result.insertedId };
    
    console.log(`[LIBRARIES API] Created new library: ${name}`);
    return sendSuccess(res, createdLibrary, 'Libraries created successfully');
  } catch (error) {
    console.error('[LIBRARIES API] Error creating library:', error);
    return sendServerError(res, error, 'Failed to create libraries');
  }
}

// ✏️ PATCH: Update library (add/edit categories and items)
async function patchLibrary(db: any, locationId: string, body: any, res: NextApiResponse) {
  try {
    const { libraryId, action, category, item } = body;
    
    if (!libraryId) {
      return res.status(400).json({ error: 'Library ID is required' });
    }
    
    let updateQuery: any = {};
    
    switch (action) {
      case 'add_category':
        if (!category || !category.name) {
          return res.status(400).json({ error: 'Category name is required' });
        }
        
        const newCategory = {
          id: new ObjectId().toString(),
          name: category.name,
          description: category.description || '',
          icon: category.icon || 'folder-outline',
          items: [],
          isActive: true,
          sortOrder: category.sortOrder || 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        
        updateQuery = {
          $push: { categories: newCategory },
          $set: { updatedAt: new Date().toISOString() }
        };
        break;
        
      case 'add_item':
        if (!category?.id || !item || !item.name) {
          return res.status(400).json({ error: 'Category ID and item name are required' });
        }
        
        const newItem = {
          id: new ObjectId().toString(),
          name: item.name,
          description: item.description || '',
          basePrice: parseFloat(item.basePrice) || 0,
          markup: parseFloat(item.markup) || 1.0,
          unit: item.unit || 'each',
          sku: item.sku || '',
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        
        updateQuery = {
          $push: { "categories.$[cat].items": newItem },
          $set: { 
            updatedAt: new Date().toISOString(),
            "categories.$[cat].updatedAt": new Date().toISOString()
          }
        };
        
        const arrayFilters = [{ "cat.id": category.id }];
        
        const result = await db.collection('libraries').updateOne(
          { _id: new ObjectId(libraryId), locationId },
          updateQuery,
          { arrayFilters }
        );
        
        if (result.matchedCount === 0) {
          return res.status(404).json({ error: 'Library or category not found' });
        }
        
        console.log(`[LIBRARIES API] Added item "${item.name}" to category "${category.id}"`);
        return res.status(200).json({ success: true, itemId: newItem.id });
        
      case 'update_item':
        if (!category?.id || !item?.id) {
          return res.status(400).json({ error: 'Category ID and item ID are required' });
        }
        
        const itemUpdates: any = {};
        if (item.name) itemUpdates["categories.$[cat].items.$[item].name"] = item.name;
        if (item.description !== undefined) itemUpdates["categories.$[cat].items.$[item].description"] = item.description;
        if (item.basePrice !== undefined) itemUpdates["categories.$[cat].items.$[item].basePrice"] = parseFloat(item.basePrice);
        if (item.markup !== undefined) itemUpdates["categories.$[cat].items.$[item].markup"] = parseFloat(item.markup);
        if (item.unit) itemUpdates["categories.$[cat].items.$[item].unit"] = item.unit;
        if (item.sku !== undefined) itemUpdates["categories.$[cat].items.$[item].sku"] = item.sku;
        if (item.isActive !== undefined) itemUpdates["categories.$[cat].items.$[item].isActive"] = item.isActive;
        
        itemUpdates["categories.$[cat].items.$[item].updatedAt"] = new Date().toISOString();
        itemUpdates.updatedAt = new Date().toISOString();
        
        const updateResult = await db.collection('libraries').updateOne(
          { _id: new ObjectId(libraryId), locationId },
          { $set: itemUpdates },
          { 
            arrayFilters: [
              { "cat.id": category.id },
              { "item.id": item.id }
            ]
          }
        );
        
        if (updateResult.matchedCount === 0) {
          return res.status(404).json({ error: 'Library, category, or item not found' });
        }
        
        console.log(`[LIBRARIES API] Updated item "${item.id}" in category "${category.id}"`);
        return res.status(200).json({ success: true });
        
      default:
        return res.status(400).json({ error: 'Invalid action' });
    }
    
    // For add_category
    const result = await db.collection('libraries').updateOne(
      { _id: new ObjectId(libraryId), locationId },
      updateQuery
    );
    
    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'Library not found' });
    }
    
    console.log(`[LIBRARIES API] Updated library with action: ${action}`);
    return res.status(200).json({ success: true });
    
  } catch (error) {
    console.error('[LIBRARIES API] Error updating library:', error);
    return res.status(500).json({ error: 'Failed to update library' });
  }
}