// services/notificationService.ts
import { BaseService } from './baseService';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface NotificationPreferences {
  appointments: boolean;
  quotes: boolean;
  payments: boolean;
  messages: boolean;
  systemAlerts: boolean;
}

interface ScheduledNotification {
  id: string;
  title: string;
  body: string;
  data?: any;
  trigger: Date | { hour: number; minute: number; repeats?: boolean };
}

interface NotificationHistory {
  id: string;
  title: string;
  body: string;
  data?: any;
  receivedAt: Date;
  read: boolean;
  type: 'appointment' | 'quote' | 'payment' | 'message' | 'system';
}

// Configure notifications
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

class NotificationService extends BaseService {
  private notificationListener: any = null;
  private responseListener: any = null;
  private pushToken: string | null = null;

  /**
   * Initialize notification service
   */
  async initialize(): Promise<boolean> {
    try {
      // Check if device
      if (!Device.isDevice) {
        console.log('Must use physical device for push notifications');
        return false;
      }

      // Get permissions
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      
      if (finalStatus !== 'granted') {
        console.log('Failed to get push token for push notification!');
        return false;
      }

      // Get token
      const token = await this.registerForPushNotifications();
      if (token) {
        this.pushToken = token;
        await this.savePushToken(token);
      }

      // Set up listeners
      this.setupListeners();

      return true;
    } catch (error) {
      console.error('Notification initialization error:', error);
      return false;
    }
  }

  /**
   * Register for push notifications
   */
  private async registerForPushNotifications(): Promise<string | null> {
    try {
      const token = (await Notifications.getExpoPushTokenAsync()).data;
      
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'default',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#FF231F7C',
        });
      }

      return token;
    } catch (error) {
      console.error('Error getting push token:', error);
      return null;
    }
  }

  /**
   * Set up notification listeners
   */
  private setupListeners(): void {
    // Notification received while app is in foreground
    this.notificationListener = Notifications.addNotificationReceivedListener(
      notification => {
        this.handleNotificationReceived(notification);
      }
    );

    // User interacts with notification
    this.responseListener = Notifications.addNotificationResponseReceivedListener(
      response => {
        this.handleNotificationResponse(response);
      }
    );
  }

  /**
   * Handle notification received
   */
  private async handleNotificationReceived(
    notification: Notifications.Notification
  ): Promise<void> {
    if (__DEV__) {
      console.log('Notification received:', notification);
    }

    // Save to history
    await this.saveToHistory({
      id: notification.request.identifier,
      title: notification.request.content.title || '',
      body: notification.request.content.body || '',
      data: notification.request.content.data,
      receivedAt: new Date(),
      read: false,
      type: this.getNotificationType(notification.request.content.data),
    });

    // Update badge count
    await this.updateBadgeCount();
  }

  /**
   * Handle notification response (user tapped)
   */
  private async handleNotificationResponse(
    response: Notifications.NotificationResponse
  ): Promise<void> {
    const data = response.notification.request.content.data;
    
    if (__DEV__) {
      console.log('Notification tapped:', data);
    }

    // Mark as read
    await this.markAsRead(response.notification.request.identifier);

    // Navigate based on type
    this.navigateFromNotification(data);
  }

  /**
   * Schedule local notification
   */
  async scheduleNotification(notification: ScheduledNotification): Promise<string> {
    const trigger = notification.trigger instanceof Date
      ? { date: notification.trigger }
      : notification.trigger;

    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: notification.title,
        body: notification.body,
        data: notification.data,
        sound: true,
      },
      trigger,
    });

    return id;
  }

  /**
   * Schedule appointment reminder
   */
  async scheduleAppointmentReminder(
    appointmentId: string,
    appointmentTitle: string,
    appointmentTime: Date,
    reminderMinutesBefore: number = 60
  ): Promise<string> {
    const reminderTime = new Date(appointmentTime);
    reminderTime.setMinutes(reminderTime.getMinutes() - reminderMinutesBefore);

    return this.scheduleNotification({
      id: `appointment_${appointmentId}`,
      title: 'Appointment Reminder',
      body: `${appointmentTitle} in ${reminderMinutesBefore} minutes`,
      data: {
        type: 'appointment',
        appointmentId,
      },
      trigger: reminderTime,
    });
  }

  /**
   * Send immediate notification
   */
  async sendNotification(
    title: string,
    body: string,
    data?: any
  ): Promise<void> {
    await Notifications.presentNotificationAsync({
      title,
      body,
      data,
    });
  }

  /**
   * Cancel scheduled notification
   */
  async cancelNotification(notificationId: string): Promise<void> {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
  }

  /**
   * Cancel all notifications
   */
  async cancelAllNotifications(): Promise<void> {
    await Notifications.cancelAllScheduledNotificationsAsync();
  }

  /**
   * Get notification preferences
   */
  async getPreferences(): Promise<NotificationPreferences> {
    try {
      const stored = await AsyncStorage.getItem('@lpai_notification_prefs');
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      console.error('Error getting notification preferences:', error);
    }

    // Default preferences
    return {
      appointments: true,
      quotes: true,
      payments: true,
      messages: true,
      systemAlerts: true,
    };
  }

  /**
   * Update notification preferences
   */
  async updatePreferences(
    preferences: Partial<NotificationPreferences>
  ): Promise<void> {
    const current = await this.getPreferences();
    const updated = { ...current, ...preferences };
    
    await AsyncStorage.setItem(
      '@lpai_notification_prefs',
      JSON.stringify(updated)
    );
  }

  /**
   * Get notification history
   */
  async getHistory(
    limit: number = 50
  ): Promise<NotificationHistory[]> {
    try {
      const stored = await AsyncStorage.getItem('@lpai_notification_history');
      if (stored) {
        const history: NotificationHistory[] = JSON.parse(stored);
        return history
          .sort((a, b) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime())
          .slice(0, limit);
      }
    } catch (error) {
      console.error('Error getting notification history:', error);
    }

    return [];
  }

  /**
   * Save to notification history
   */
  private async saveToHistory(
    notification: NotificationHistory
  ): Promise<void> {
    try {
      const history = await this.getHistory(100);
      history.unshift(notification);
      
      // Keep only last 100
      const trimmed = history.slice(0, 100);
      
      await AsyncStorage.setItem(
        '@lpai_notification_history',
        JSON.stringify(trimmed)
      );
    } catch (error) {
      console.error('Error saving notification history:', error);
    }
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: string): Promise<void> {
    try {
      const history = await this.getHistory(100);
      const updated = history.map(item => {
        if (item.id === notificationId) {
          return { ...item, read: true };
        }
        return item;
      });
      
      await AsyncStorage.setItem(
        '@lpai_notification_history',
        JSON.stringify(updated)
      );
      
      await this.updateBadgeCount();
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  }

  /**
   * Mark all as read
   */
  async markAllAsRead(): Promise<void> {
    try {
      const history = await this.getHistory(100);
      const updated = history.map(item => ({ ...item, read: true }));
      
      await AsyncStorage.setItem(
        '@lpai_notification_history',
        JSON.stringify(updated)
      );
      
      await this.updateBadgeCount();
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  }

  /**
   * Get unread count
   */
  async getUnreadCount(): Promise<number> {
    const history = await this.getHistory();
    return history.filter(item => !item.read).length;
  }

  /**
   * Update badge count
   */
  private async updateBadgeCount(): Promise<void> {
    const count = await this.getUnreadCount();
    await Notifications.setBadgeCountAsync(count);
  }

  /**
   * Save push token to backend
   */
  private async savePushToken(token: string): Promise<void> {
    try {
      // This would save to your backend
      // For now, just store locally
      await AsyncStorage.setItem('@lpai_push_token', token);
    } catch (error) {
      console.error('Error saving push token:', error);
    }
  }

  /**
   * Get notification type from data
   */
  private getNotificationType(data: any): NotificationHistory['type'] {
    if (data?.type) {
      return data.type;
    }
    
    if (data?.appointmentId) return 'appointment';
    if (data?.quoteId) return 'quote';
    if (data?.paymentId) return 'payment';
    if (data?.messageId) return 'message';
    
    return 'system';
  }

  /**
   * Navigate from notification data
   */
  private navigateFromNotification(data: any): void {
    // This would be handled by your navigation service
    // For now, just log
    if (__DEV__) {
      console.log('Navigate to:', data);
    }
  }

  /**
   * Clear notification data (for logout)
   */
  async clearNotificationData(): Promise<void> {
    try {
      await this.cancelAllNotifications();
      await AsyncStorage.multiRemove([
        '@lpai_notification_history',
        '@lpai_notification_prefs',
        '@lpai_push_token',
      ]);
      await Notifications.setBadgeCountAsync(0);
    } catch (error) {
      console.error('Error clearing notification data:', error);
    }
  }

  /**
   * Clean up listeners
   */
  cleanup(): void {
    if (this.notificationListener) {
      this.notificationListener.remove();
      this.notificationListener = null;
    }
    
    if (this.responseListener) {
      this.responseListener.remove();
      this.responseListener = null;
    }
  }
}

export const notificationService = new NotificationService();