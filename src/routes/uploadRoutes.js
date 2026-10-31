import { Router } from 'express';
import { upload } from '../middlewares/uploadMiddleware.js';
import { uploadToCloudinary, cloudinary } from '../utils/cloudinary.js';
import { protect } from '../middlewares/authMiddleware.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';

const router = Router();

// Protect image upload route
router.use(protect);

router.post('/', upload.single('image'), async (req, res, next) => {
  try {
    const folder = req.body.folder || 'identity_ims/categories';
    const resourceType = req.file?.mimetype === 'application/pdf' ? 'auto' : 'image';
    let secureUrl = null;

    if (req.file?.buffer) {
      const uploadResult = await uploadToCloudinary(req.file.buffer, folder, resourceType);
      secureUrl = uploadResult.secure_url;
    } else if (req.body.image) {
      const uploadResult = await cloudinary.uploader.upload(req.body.image, {
        folder,
        resource_type: resourceType,
      });
      secureUrl = uploadResult.secure_url;
    } else {
      throw new ApiError(400, 'No file or image data provided.');
    }

    return res.status(200).json(
      new ApiResponse(200, { url: secureUrl }, 'File uploaded successfully.')
    );
  } catch (error) {
    next(error);
  }
});

export default router;
