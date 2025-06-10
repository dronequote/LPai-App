// services/fileService.ts
import { BaseService } from './baseService';
import * as FileSystem from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';
import { Platform } from 'react-native';

interface FileUploadOptions {
  compress?: boolean;
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  generateThumbnail?: boolean;
  thumbnailSize?: number;
}

interface UploadedFile {
  id: string;
  url: string;
  filename: string;
  size: number;
  mimeType: string;
  thumbnailUrl?: string;
  metadata?: Record<string, any>;
}

interface PhotoUploadResult {
  id: string;
  uri: string;
  thumbnailUri?: string;
  filename: string;
  size: number;
  width: number;
  height: number;
}

interface DocumentUploadResult {
  id: string;
  uri: string;
  filename: string;
  size: number;
  type: string;
}

class FileService extends BaseService {
  private readonly MAX_IMAGE_SIZE = 1920; // Max dimension for photos
  private readonly THUMBNAIL_SIZE = 200;
  private readonly JPEG_QUALITY = 0.85;
  
  /**
   * Upload photo with compression and thumbnail
   */
  async uploadPhoto(
    uri: string,
    endpoint: string,
    fieldName: string = 'photo',
    options: FileUploadOptions = {}
  ): Promise<PhotoUploadResult> {
    try {
      // Process image
      const processedImage = await this.processImage(uri, {
        maxWidth: options.maxWidth || this.MAX_IMAGE_SIZE,
        maxHeight: options.maxHeight || this.MAX_IMAGE_SIZE,
        quality: options.quality || this.JPEG_QUALITY,
      });

      // Generate thumbnail if requested
      let thumbnailUri: string | undefined;
      if (options.generateThumbnail) {
        const thumbnail = await this.generateThumbnail(uri, options.thumbnailSize);
        thumbnailUri = thumbnail.uri;
      }

      // Upload main image
      const formData = new FormData();
      formData.append(fieldName, {
        uri: processedImage.uri,
        type: 'image/jpeg',
        name: `photo_${Date.now()}.jpg`,
      } as any);

      // Add thumbnail if generated
      if (thumbnailUri) {
        formData.append('thumbnail', {
          uri: thumbnailUri,
          type: 'image/jpeg',
          name: `thumb_${Date.now()}.jpg`,
        } as any);
      }

      // Upload to backend
      const response = await this.post<any>(
        endpoint,
        formData,
        {
          offline: true,
          showError: true,
        },
        {
          endpoint,
          method: 'POST',
          entity: 'project',
          priority: 'medium',
        }
      );

      // Clean up temp files
      await this.cleanupTempFile(processedImage.uri);
      if (thumbnailUri && thumbnailUri !== processedImage.uri) {
        await this.cleanupTempFile(thumbnailUri);
      }

      return {
        id: response.id || response._id,
        uri: response.url || response.uri,
        thumbnailUri: response.thumbnailUrl,
        filename: response.filename,
        size: processedImage.size,
        width: processedImage.width,
        height: processedImage.height,
      };
    } catch (error) {
      console.error('Photo upload error:', error);
      throw error;
    }
  }

  /**
   * Upload document (PDF, etc)
   */
  async uploadDocument(
    uri: string,
    endpoint: string,
    fieldName: string = 'document',
    metadata?: Record<string, any>
  ): Promise<DocumentUploadResult> {
    try {
      const fileInfo = await FileSystem.getInfoAsync(uri);
      if (!fileInfo.exists) {
        throw new Error('File not found');
      }

      const formData = new FormData();
      const filename = uri.split('/').pop() || `document_${Date.now()}.pdf`;
      
      formData.append(fieldName, {
        uri,
        type: this.getMimeType(filename),
        name: filename,
      } as any);

      // Add metadata if provided
      if (metadata) {
        Object.entries(metadata).forEach(([key, value]) => {
          formData.append(key, value);
        });
      }

      const response = await this.post<any>(
        endpoint,
        formData,
        {
          offline: true,
          showError: true,
        },
        {
          endpoint,
          method: 'POST',
          entity: 'project',
          priority: 'medium',
        }
      );

      return {
        id: response.id || response._id,
        uri: response.url || response.uri,
        filename: response.filename || filename,
        size: fileInfo.size || 0,
        type: response.type || this.getMimeType(filename),
      };
    } catch (error) {
      console.error('Document upload error:', error);
      throw error;
    }
  }

  /**
   * Upload payment proof photo
   */
  async uploadPaymentProof(
    paymentId: string,
    photoUri: string,
    locationId: string
  ): Promise<{ success: boolean; photoId: string }> {
    // Convert to base64 for payment proof
    const base64 = await this.convertToBase64(photoUri);
    
    const endpoint = '/api/payments/upload-proof';
    
    const response = await this.post<any>(
      endpoint,
      {
        paymentId,
        photo: base64,
        locationId,
      },
      {
        offline: false, // Payment proofs should upload immediately
        showError: true,
      },
      {
        endpoint,
        method: 'POST',
        entity: 'payment',
        priority: 'high',
      }
    );

    return response;
  }

  /**
   * Batch upload photos
   */
  async batchUploadPhotos(
    photos: string[],
    endpoint: string,
    options?: FileUploadOptions
  ): Promise<{
    uploaded: PhotoUploadResult[];
    failed: Array<{ uri: string; error: string }>;
  }> {
    const uploaded: PhotoUploadResult[] = [];
    const failed: Array<{ uri: string; error: string }> = [];

    // Process in parallel with limit
    const batchSize = 3;
    for (let i = 0; i < photos.length; i += batchSize) {
      const batch = photos.slice(i, i + batchSize);
      
      const results = await Promise.allSettled(
        batch.map(uri => this.uploadPhoto(uri, endpoint, 'photo', options))
      );

      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          uploaded.push(result.value);
        } else {
          failed.push({
            uri: batch[index],
            error: result.reason?.message || 'Upload failed',
          });
        }
      });
    }

    return { uploaded, failed };
  }

  /**
   * Process image (compress and resize)
   */
  private async processImage(
    uri: string,
    options: {
      maxWidth: number;
      maxHeight: number;
      quality: number;
    }
  ): Promise<{
    uri: string;
    width: number;
    height: number;
    size: number;
  }> {
    try {
      // Get original dimensions
      const originalInfo = await ImageManipulator.manipulateAsync(uri, [], {
        compress: 1,
        format: ImageManipulator.SaveFormat.JPEG,
      });

      // Calculate resize dimensions
      const { width, height } = this.calculateDimensions(
        originalInfo.width,
        originalInfo.height,
        options.maxWidth,
        options.maxHeight
      );

      // Process image
      const processed = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width, height } }],
        {
          compress: options.quality,
          format: ImageManipulator.SaveFormat.JPEG,
        }
      );

      // Get file size
      const fileInfo = await FileSystem.getInfoAsync(processed.uri);

      return {
        uri: processed.uri,
        width: processed.width,
        height: processed.height,
        size: fileInfo.exists ? fileInfo.size || 0 : 0,
      };
    } catch (error) {
      console.error('Image processing error:', error);
      throw error;
    }
  }

  /**
   * Generate thumbnail
   */
  private async generateThumbnail(
    uri: string,
    size: number = this.THUMBNAIL_SIZE
  ): Promise<{ uri: string; size: number }> {
    const thumbnail = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: size, height: size } }],
      {
        compress: 0.7,
        format: ImageManipulator.SaveFormat.JPEG,
      }
    );

    const fileInfo = await FileSystem.getInfoAsync(thumbnail.uri);

    return {
      uri: thumbnail.uri,
      size: fileInfo.exists ? fileInfo.size || 0 : 0,
    };
  }

  /**
   * Convert image to base64
   */
  private async convertToBase64(uri: string): Promise<string> {
    try {
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      return base64;
    } catch (error) {
      console.error('Base64 conversion error:', error);
      throw error;
    }
  }

  /**
   * Calculate resize dimensions maintaining aspect ratio
   */
  private calculateDimensions(
    originalWidth: number,
    originalHeight: number,
    maxWidth: number,
    maxHeight: number
  ): { width: number; height: number } {
    if (originalWidth <= maxWidth && originalHeight <= maxHeight) {
      return { width: originalWidth, height: originalHeight };
    }

    const aspectRatio = originalWidth / originalHeight;
    let width = maxWidth;
    let height = maxWidth / aspectRatio;

    if (height > maxHeight) {
      height = maxHeight;
      width = maxHeight * aspectRatio;
    }

    return {
      width: Math.round(width),
      height: Math.round(height),
    };
  }

  /**
   * Get MIME type from filename
   */
  private getMimeType(filename: string): string {
    const extension = filename.split('.').pop()?.toLowerCase() || '';
    
    const mimeTypes: Record<string, string> = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      gif: 'image/gif',
      pdf: 'application/pdf',
      doc: 'application/msword',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      xls: 'application/vnd.ms-excel',
      xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };

    return mimeTypes[extension] || 'application/octet-stream';
  }

  /**
   * Clean up temporary file
   */
  private async cleanupTempFile(uri: string): Promise<void> {
    try {
      if (uri.startsWith('file://')) {
        const fileInfo = await FileSystem.getInfoAsync(uri);
        if (fileInfo.exists) {
          await FileSystem.deleteAsync(uri, { idempotent: true });
        }
      }
    } catch (error) {
      console.error('Cleanup error:', error);
      // Non-critical error
    }
  }

  /**
   * Download file to local cache
   */
  async downloadFile(
    url: string,
    filename?: string
  ): Promise<string> {
    try {
      const name = filename || url.split('/').pop() || `download_${Date.now()}`;
      const localUri = `${FileSystem.cacheDirectory}${name}`;

      const downloadResult = await FileSystem.downloadAsync(url, localUri);

      if (downloadResult.status !== 200) {
        throw new Error('Download failed');
      }

      return downloadResult.uri;
    } catch (error) {
      console.error('Download error:', error);
      throw error;
    }
  }

  /**
   * Check if file exists in cache
   */
  async isFileCached(filename: string): Promise<boolean> {
    try {
      const uri = `${FileSystem.cacheDirectory}${filename}`;
      const info = await FileSystem.getInfoAsync(uri);
      return info.exists;
    } catch {
      return false;
    }
  }

  /**
   * Clear old cached files
   */
  async clearOldCache(daysOld: number = 30): Promise<void> {
    try {
      const cacheDir = FileSystem.cacheDirectory;
      if (!cacheDir) return;

      const files = await FileSystem.readDirectoryAsync(cacheDir);
      const cutoffTime = Date.now() - (daysOld * 24 * 60 * 60 * 1000);

      for (const file of files) {
        const fileUri = `${cacheDir}${file}`;
        const info = await FileSystem.getInfoAsync(fileUri);
        
        if (info.exists && info.modificationTime && info.modificationTime < cutoffTime) {
          await FileSystem.deleteAsync(fileUri, { idempotent: true });
        }
      }
    } catch (error) {
      console.error('Cache cleanup error:', error);
    }
  }

  /**
   * Get cache size
   */
  async getCacheSize(): Promise<number> {
    try {
      const cacheDir = FileSystem.cacheDirectory;
      if (!cacheDir) return 0;

      let totalSize = 0;
      const files = await FileSystem.readDirectoryAsync(cacheDir);

      for (const file of files) {
        const info = await FileSystem.getInfoAsync(`${cacheDir}${file}`);
        if (info.exists && info.size) {
          totalSize += info.size;
        }
      }

      return totalSize;
    } catch {
      return 0;
    }
  }
}

export const fileService = new FileService();