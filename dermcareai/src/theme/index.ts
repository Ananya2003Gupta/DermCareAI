import { MD3LightTheme } from 'react-native-paper';

// Medical blue color palette
const medicalBlue = {
  primary: '#0077B6', // Deep medical blue
  primaryLight: '#00B4D8', // Light medical blue
  primaryDark: '#023E8A', // Dark medical blue
  secondary: '#90E0EF', // Very light blue
  accent: '#48CAE4', // Bright blue accent
};

export const theme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: medicalBlue.primary,
    primaryContainer: '#E6F3F8',
    onPrimaryContainer: medicalBlue.primaryDark,
    secondary: medicalBlue.secondary,
    secondaryContainer: '#F0F9FC',
    onSecondaryContainer: medicalBlue.primaryDark,
    tertiary: medicalBlue.accent,
    tertiaryContainer: '#E1F6FA',
    onTertiaryContainer: medicalBlue.primaryDark,
    surface: '#FFFFFF',
    surfaceVariant: '#F5F9FB',
    background: '#FFFFFF',
    error: '#B00020',
    onError: '#FFFFFF',
    onErrorContainer: '#B00020',
    success: '#4CAF50',
    info: medicalBlue.primaryLight,
    warning: '#FB8C00',
    elevation: {
      level0: 'transparent',
      level1: '#F5F9FB',
      level2: '#E6F3F8',
      level3: '#E1F6FA',
      level4: '#D8F3F9',
      level5: '#CAF0F8',
    },
  },
  roundness: 8,
  fonts: MD3LightTheme.fonts,
  animation: {
    scale: 1.0,
  },
}; 