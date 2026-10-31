import { Router } from 'express';
import {
  getAllUsers,
  createUser,
  updateUser,
  deleteUser,
} from '../controllers/userController.js';
import { protect, authorizeRoles } from '../middlewares/authMiddleware.js';

const router = Router();

// All routes require authenticated session
router.use(protect);

router.get('/', getAllUsers);
router.post('/', authorizeRoles('Admin'), createUser);
router.put('/:id', authorizeRoles('Admin'), updateUser);
router.patch('/:id', authorizeRoles('Admin'), updateUser);
router.delete('/:id', authorizeRoles('Admin'), deleteUser);

export default router;
