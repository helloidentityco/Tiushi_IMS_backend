import { Router } from 'express';
import {
  createBrand,
  getAllBrands,
  updateBrand,
  deleteBrand,
} from '../controllers/brandController.js';
import { protect } from '../middlewares/authMiddleware.js';

const router = Router();

router.use(protect);

router.get('/', getAllBrands);
router.post('/', createBrand);
router.put('/:id', updateBrand);
router.patch('/:id', updateBrand);
router.delete('/:id', deleteBrand);

export default router;
