import { Router } from 'express';
import {
  createVariant,
  getAllVariants,
  updateVariant,
  deleteVariant,
} from '../controllers/variantController.js';
import { protect } from '../middlewares/authMiddleware.js';

const router = Router();

router.use(protect);

router.get('/', getAllVariants);
router.post('/', createVariant);
router.put('/:id', updateVariant);
router.patch('/:id', updateVariant);
router.delete('/:id', deleteVariant);

export default router;
