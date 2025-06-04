// src/utils/installQueue.ts
import { Db, ObjectId } from 'mongodb';

interface InstallLock {
  _id: string;
  lockedAt: Date;
  expiresAt: Date;
  webhookId: string;
  attempt: number;
}

export async function acquireInstallLock(
  db: Db, 
  companyId: string, 
  locationId: string | null,
  webhookId: string
): Promise<boolean> {
  const lockKey = `install_${companyId}_${locationId || 'agency'}`;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 5 * 60 * 1000); // 5 minute lock
  
  try {
    // Try to acquire lock
    const result = await db.collection('install_locks').findOneAndUpdate(
      {
        _id: lockKey,
        $or: [
          { expiresAt: { $lte: now } }, // Lock expired
          { expiresAt: { $exists: false } } // No lock exists
        ]
      },
      {
        $set: {
          _id: lockKey,
          lockedAt: now,
          expiresAt: expiresAt,
          webhookId: webhookId,
          attempt: 1
        }
      },
      {
        upsert: true,
        returnDocument: 'after'
      }
    );
    
    // If we got the lock, return true
    if (result.value && result.value.webhookId === webhookId) {
      console.log(`[Install Lock] Acquired lock for ${lockKey}`);
      return true;
    }
    
    // Check if lock is held by someone else
    const existingLock = await db.collection('install_locks').findOne({ _id: lockKey });
    if (existingLock && existingLock.expiresAt > now && existingLock.webhookId !== webhookId) {
      console.log(`[Install Lock] Lock held by another process for ${lockKey}`);
      return false;
    }
    
    // Try to force acquire if something went wrong
    await db.collection('install_locks').replaceOne(
      { _id: lockKey },
      {
        _id: lockKey,
        lockedAt: now,
        expiresAt: expiresAt,
        webhookId: webhookId,
        attempt: 1
      },
      { upsert: true }
    );
    
    return true;
    
  } catch (error: any) {
    console.error(`[Install Lock] Error acquiring lock for ${lockKey}:`, error);
    return false;
  }
}

export async function releaseInstallLock(
  db: Db,
  companyId: string,
  locationId: string | null,
  webhookId: string
): Promise<void> {
  const lockKey = `install_${companyId}_${locationId || 'agency'}`;
  
  try {
    await db.collection('install_locks').deleteOne({
      _id: lockKey,
      webhookId: webhookId // Only delete if we own the lock
    });
    console.log(`[Install Lock] Released lock for ${lockKey}`);
  } catch (error: any) {
    console.error(`[Install Lock] Error releasing lock for ${lockKey}:`, error);
  }
}

export async function queueInstallForRetry(
  db: Db,
  payload: any,
  webhookId: string,
  reason: string
): Promise<void> {
  await db.collection('install_retry_queue').insertOne({
    _id: new ObjectId(),
    webhookId: webhookId,
    payload: payload,
    reason: reason,
    attempts: 0,
    status: 'pending',
    createdAt: new Date(),
    nextRetryAt: new Date(Date.now() + 30 * 1000) // Retry in 30 seconds
  });
  
  console.log(`[Install Queue] Queued install for retry: ${reason}`);
}

export async function checkInstallState(
  db: Db,
  locationId: string
): Promise<{ isInstalling: boolean; isComplete: boolean }> {
  const location = await db.collection('locations').findOne({ locationId });
  
  if (!location) {
    return { isInstalling: false, isComplete: false };
  }
  
  // Check if install is in progress
  if (location.installState === 'in_progress') {
    const installStarted = new Date(location.installStarted);
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    
    // If install started more than 10 minutes ago, consider it failed
    if (installStarted < tenMinutesAgo) {
      await db.collection('locations').updateOne(
        { locationId },
        { 
          $set: { 
            installState: 'failed',
            installError: 'Install timeout'
          } 
        }
      );
      return { isInstalling: false, isComplete: false };
    }
    
    return { isInstalling: true, isComplete: false };
  }
  
  return {
    isInstalling: false,
    isComplete: location.installState === 'complete'
  };
}

// Clean up old locks (call this from a cron job)
export async function cleanupExpiredLocks(db: Db): Promise<number> {
  const result = await db.collection('install_locks').deleteMany({
    expiresAt: { $lte: new Date() }
  });
  
  return result.deletedCount;
}