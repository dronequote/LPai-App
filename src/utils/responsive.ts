// src/utils/responsive.ts
import { Dimensions, Platform } from 'react-native';

const { width, height } = Dimensions.get('window');

export const isTablet = () => {
  const aspectRatio = height / width;
  const isIPad = Platform.OS === 'ios' && Platform.isPad;
  
  // Check if it's an iPad or Android tablet based on screen size
  return isIPad || (width >= 600 || (aspectRatio < 1.6 && width >= 450));
};

export const getColumns = () => {
  if (width >= 1024) return 3; // Large tablet (iPad Pro)
  if (width >= 768) return 2;  // Regular tablet
  if (width >= 600) return 2;  // Small tablet
  return 1; // Phone
};

export const responsive = {
  padding: isTablet() ? 24 : 20,
  cardWidth: isTablet() ? (width - 48 - 16) / getColumns() : width - 40,
  fontSize: {
    small: isTablet() ? 14 : 12,
    medium: isTablet() ? 18 : 16,
    large: isTablet() ? 26 : 24,
    title: isTablet() ? 32 : 28,
  },
  iconSize: {
    small: isTablet() ? 20 : 18,
    medium: isTablet() ? 24 : 22,
    large: isTablet() ? 32 : 28,
  },
  buttonHeight: isTablet() ? 54 : 48,
  spacing: {
    xs: isTablet() ? 6 : 4,
    sm: isTablet() ? 12 : 8,
    md: isTablet() ? 20 : 16,
    lg: isTablet() ? 32 : 24,
    xl: isTablet() ? 48 : 32,
  }
};