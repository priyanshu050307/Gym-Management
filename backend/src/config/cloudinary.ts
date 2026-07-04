import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import multer from 'multer';
import logger from './logger.js';

const isConfigured = !!(
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET
);

if (isConfigured) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });
  logger.info('Cloudinary: File storage configured successfully');
} else {
  logger.warn('Cloudinary: Not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET to enable photo uploads.');
}

// ──────────────────────────────────────────────
// Storage Engine
// ──────────────────────────────────────────────

const storage = isConfigured
  ? new CloudinaryStorage({
      cloudinary,
      params: {
        folder: 'gymnasium/profiles',
        allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
        transformation: [{ width: 400, height: 400, crop: 'fill', gravity: 'face' }],
      } as any,
    })
  : multer.memoryStorage(); // fallback if cloudinary not configured

export const profileUpload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
  fileFilter: (_req: any, file: any, cb: any) => {
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPG, PNG and WebP images are allowed') as any);
    }
  },
});

export const uploadToCloudinary = async (filePath: string, publicId?: string): Promise<string> => {
  if (!isConfigured) throw new Error('Cloudinary not configured');
  const result = await cloudinary.uploader.upload(filePath, {
    folder: 'gymnasium/profiles',
    public_id: publicId,
    transformation: [{ width: 400, height: 400, crop: 'fill', gravity: 'face' }],
  });
  return result.secure_url;
};

export const deleteFromCloudinary = async (publicId: string): Promise<void> => {
  if (!isConfigured) return;
  await cloudinary.uploader.destroy(publicId);
};

export { isConfigured as cloudinaryConfigured };
