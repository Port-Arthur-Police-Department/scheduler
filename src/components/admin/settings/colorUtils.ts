// src/components/admin/settings/colorUtils.ts

/**
 * Converts a hex color string to RGB format (e.g., "255,128,0")
 */
export const hexToRgbString = (hex: string): string => {
  hex = hex.replace('#', '');
  
  if (hex.length !== 6) {
    console.warn('Invalid hex length:', hex, 'using default white');
    return '255,255,255';
  }
  
  try {
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    
    if (isNaN(r) || isNaN(g) || isNaN(b)) {
      console.warn('Invalid hex values:', hex, 'using default white');
      return '255,255,255';
    }
    
    return `${r},${g},${b}`;
  } catch (error) {
    console.error('Error converting hex to RGB:', error, 'hex:', hex);
    return '255,255,255';
  }
};

/**
 * Converts an RGB string (e.g., "255,128,0") to hex format (e.g., "#ff8000")
 */
export const rgbStringToHex = (rgb: string | undefined): string => {
  if (!rgb) {
    console.warn('RGB string is undefined, returning default black');
    return '#000000';
  }
  
  try {
    const parts = rgb.split(',').map(part => parseInt(part.trim()));
    
    if (parts.length !== 3 || parts.some(isNaN)) {
      console.warn('Invalid RGB string:', rgb, 'returning default black');
      return '#000000';
    }
    
    return `#${parts[0].toString(16).padStart(2, '0')}${parts[1].toString(16).padStart(2, '0')}${parts[2].toString(16).padStart(2, '0')}`;
  } catch (error) {
    console.error('Error converting RGB to hex:', error, 'rgb:', rgb);
    return '#000000';
  }
};
