import { Router } from 'express';
import {
  createUnit,
  getAllUnits,
  updateUnit,
  deleteUnit,
} from '../controllers/unitController.js';
import { protect } from '../middlewares/authMiddleware.js';

const router = Router();

router.use(protect);

router.get('/', getAllUnits);
router.post('/', createUnit);
router.put('/:id', updateUnit);
router.patch('/:id', updateUnit);
router.delete('/:id', deleteUnit);

export default router;
