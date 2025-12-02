/**
 * Cloudinary Image Transformation Utilities
 * Optimizes image URLs based on quality settings
 */

/**
 * Transform Cloudinary URL based on quality setting
 * @param {string} url - Original Cloudinary URL
 * @param {string} quality - 'hd' or 'sd'
 * @returns {string} Transformed URL
 */
export const getOptimizedImageUrl = (url, quality = 'hd') => {
  if (!url || !url.includes('cloudinary.com')) {
    return url; // Return original if not a Cloudinary URL
  }

  if (quality === 'hd') {
    return url; // Return original URL for HD
  }

  // For SD quality, add Cloudinary transformations
  // q_70 = 70% quality (good balance between size and quality)
  // f_auto = auto format selection (WebP where supported)
  // No dimension changes to preserve 360° panorama dimensions
  
  try {
    const transformation = 'q_70,f_auto';
    
    // Cloudinary URL format: https://res.cloudinary.com/{cloud_name}/image/upload/v{version}/{folder}/{filename}
    // Insert transformation: https://res.cloudinary.com/{cloud_name}/image/upload/{transformation}/v{version}/{folder}/{filename}
    
    const parts = url.split('/upload/');
    if (parts.length === 2) {
      return `${parts[0]}/upload/${transformation}/${parts[1]}`;
    }
    
    return url; // Return original if URL format is unexpected
  } catch (error) {
    console.error('Error transforming Cloudinary URL:', error);
    return url; // Return original URL on error
  }
};

/**
 * Get quality description
 * @param {string} quality - 'hd' or 'sd'
 * @returns {string} Quality description
 */
export const getQualityDescription = (quality) => {
  return quality === 'hd' 
    ? 'HD - Original Quality' 
    : 'SD - Optimized (70% smaller)';
};

/**
 * Estimate file size reduction
 * @param {string} quality - 'hd' or 'sd'
 * @returns {number} Percentage reduction (0-100)
 */
export const getEstimatedSizeReduction = (quality) => {
  return quality === 'sd' ? 70 : 0;
};

export default {
  getOptimizedImageUrl,
  getQualityDescription,
  getEstimatedSizeReduction,
};
