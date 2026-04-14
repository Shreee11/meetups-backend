const cloudinary = require('cloudinary').v2;

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Warn at startup if credentials are placeholder / missing
const { cloud_name, api_key, api_secret } = cloudinary.config();
if (!cloud_name || !api_key || !api_secret ||
    cloud_name === 'your-cloud-name' || api_key === 'your-api-key') {
  console.warn('[Cloudinary] WARNING: credentials are not configured. Media uploads will fail. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET in .env');
}

/**
 * Upload an image to Cloudinary
 * @param {Buffer} buffer - Image buffer
 * @param {Object} options - Upload options
 * @returns {Promise<Object>} - Cloudinary upload result
 */
const uploadImage = (buffer, options = {}) => {
  return new Promise((resolve, reject) => {
    const uploadOptions = {
      folder: options.folder || 'tender',
      resource_type: 'image',
      ...options,
    };

    const uploadStream = cloudinary.uploader.upload_stream(
      uploadOptions,
      (error, result) => {
        if (error) reject(error);
        else resolve(result);
      }
    );

    // Convert buffer to stream and pipe to upload
    const Readable = require('stream').Readable;
    const readableStream = new Readable();
    readableStream.push(buffer);
    readableStream.push(null);
    readableStream.pipe(uploadStream);
  });
};

/**
 * Delete an image from Cloudinary
 * @param {string} publicId - Image public ID
 * @returns {Promise<Object>} - Cloudinary deletion result
 */
const deleteImage = (publicId) => {
  return cloudinary.uploader.destroy(publicId);
};

/**
 * Generate optimized URL for an image
 * @param {string} publicId - Image public ID
 * @param {Object} transformations - Cloudinary transformations
 * @returns {string} - Optimized image URL
 */
const getOptimizedUrl = (publicId, transformations = {}) => {
  const defaultTransformations = {
    fetch_format: 'auto',
    quality: 'auto',
    ...transformations,
  };

  return cloudinary.url(publicId, defaultTransformations);
};

/**
 * Generate a thumbnail URL
 * @param {string} publicId - Image public ID
 * @param {number} width - Thumbnail width
 * @param {number} height - Thumbnail height
 * @returns {string} - Thumbnail URL
 */
const getThumbnailUrl = (publicId, width = 200, height = 200) => {
  return cloudinary.url(publicId, {
    width,
    height,
    crop: 'fill',
    gravity: 'face',
    fetch_format: 'auto',
    quality: 'auto',
  });
};

module.exports = {
  cloudinary,
  uploadImage,
  deleteImage,
  getOptimizedUrl,
  getThumbnailUrl,
};
