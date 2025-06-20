// lpai-backend/src/utils/sendPushNotification.ts
import { Expo } from 'expo-server-sdk';

const expo = new Expo();

interface NotificationData {
  type: 'appointment' | 'message' | 'quote' | 'lead' | 'project' | 'payment';
  [key: string]: any;
}

export async function sendPushNotification(
  pushToken: string,
  title: string,
  body: string,
  data: NotificationData = { type: 'general' }
): Promise<void> {
  if (!Expo.isExpoPushToken(pushToken)) {
    console.error(`Push token ${pushToken} is not a valid Expo push token`);
    return;
  }

  const message = {
    to: pushToken,
    sound: 'default' as const,
    title,
    body,
    data,
    priority: 'high' as const,
    channelId: data.type || 'default',
  };

  try {
    const tickets = await expo.sendPushNotificationsAsync([message]);
    console.log('📱 Notification sent:', tickets);
  } catch (error) {
    console.error('❌ Error sending notification:', error);
    throw error;
  }
}

// Helper function to send bulk notifications
export async function sendBulkPushNotifications(
  notifications: Array<{
    pushToken: string;
    title: string;
    body: string;
    data?: NotificationData;
  }>
): Promise<void> {
  const messages = notifications
    .filter(n => Expo.isExpoPushToken(n.pushToken))
    .map(n => ({
      to: n.pushToken,
      sound: 'default' as const,
      title: n.title,
      body: n.body,
      data: n.data || { type: 'general' },
      priority: 'high' as const,
      channelId: n.data?.type || 'default',
    }));

  if (messages.length === 0) return;

  // Expo recommends sending in chunks of 100
  const chunks = [];
  for (let i = 0; i < messages.length; i += 100) {
    chunks.push(messages.slice(i, i + 100));
  }

  for (const chunk of chunks) {
    try {
      const tickets = await expo.sendPushNotificationsAsync(chunk);
      console.log(`📱 Sent ${chunk.length} notifications`);
    } catch (error) {
      console.error('❌ Error sending notification chunk:', error);
    }
  }
}