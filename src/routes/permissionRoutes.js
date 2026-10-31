import { Router } from 'express';
import { getPermissions, updatePermission } from '../controllers/permissionController.js';

const router = Router();

// Read permission matrix (Accessible to all authenticated users & on boot)
router.get('/', getPermissions);

// Update permission matrix / role capabilities
router.put('/', updatePermission);
router.patch('/', updatePermission);

export default router;
