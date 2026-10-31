import { eq, desc, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { suppliers, purchaseOrders } from '../db/schema.js';
import {
  insertSupplierSchema,
  updateSupplierSchema,
} from '../utils/validations.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';

/**
 * Create New Supplier (Admin, Store Manager)
 */
export const createSupplier = async (req, res, next) => {
  try {
    const parseResult = insertSupplierSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw new ApiError(
        400,
        'Validation Error: Invalid supplier details provided.',
        parseResult.error.errors
      );
    }

    const { name, email, contact, phone, address } = parseResult.data;
    const finalPhone = phone?.trim() || contact?.trim() || null;

    const [newSupplier] = await db
      .insert(suppliers)
      .values({
        name: name.trim(),
        email: email ? email.trim().toLowerCase() : null,
        contact: finalPhone,
        phone: finalPhone,
        address: address ? address.trim() : null,
      })
      .returning();

    return res.status(201).json(
      new ApiResponse(201, newSupplier, 'Supplier registered successfully.')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Get All Suppliers with PO count and balance summary (All Authenticated)
 */
export const getAllSuppliers = async (req, res, next) => {
  try {
    const allSuppliers = await db.query.suppliers.findMany({
      orderBy: [desc(suppliers.createdAt)],
      with: {
        purchaseOrders: {
          columns: {
            id: true,
            poNumber: true,
            status: true,
            paymentStatus: true,
            grandTotal: true,
            balanceDue: true,
            amountPaid: true,
            createdAt: true,
          },
        },
      },
    });

    // Compute summary metrics and Accounts Payable per supplier
    const enrichedSuppliers = allSuppliers.map((supplier) => {
      const pos = supplier.purchaseOrders || [];
      const totalOrders = pos.length;
      const totalSpend = pos.reduce((sum, po) => sum + Number(po.grandTotal || 0), 0);
      const totalBalanceDue = pos.reduce((sum, po) => sum + Number(po.balanceDue || 0), 0);
      const totalAmountPaid = pos.reduce((sum, po) => sum + Number(po.amountPaid || 0), 0);

      // Accounts Payable calculation:
      // Sum the totalAmount (grandTotal) of all POs linked to that supplier where the status is
      // 'Issued' or 'Partially Paid', and subtract any amountPaid.
      const payableAmount = pos.reduce((sum, po) => {
        const s = (po.status || '').trim();
        const ps = (po.paymentStatus || '').trim();
        const isTargetStatus = s === 'Issued' || s === 'Partially Paid' || ps === 'Partially Paid';
        if (isTargetStatus) {
          const total = Number(po.grandTotal || 0);
          const paid = Number(po.amountPaid || 0);
          return sum + Math.max(0, total - paid);
        }
        return sum;
      }, 0);

      return {
        ...supplier,
        phone: supplier.phone || supplier.contact || '',
        payableAmount: Number(payableAmount.toFixed(2)),
        metrics: {
          totalOrders,
          totalSpend: totalSpend.toFixed(2),
          totalBalanceDue: totalBalanceDue.toFixed(2),
          totalAmountPaid: totalAmountPaid.toFixed(2),
          payableAmount: Number(payableAmount.toFixed(2)),
        },
      };
    });

    return res.status(200).json(
      new ApiResponse(200, enrichedSuppliers, 'Suppliers retrieved successfully.')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Get Single Supplier by ID
 */
export const getSupplierById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const supplier = await db.query.suppliers.findFirst({
      where: eq(suppliers.id, id),
      with: {
        purchaseOrders: true,
        debitNotes: true,
      },
    });

    if (!supplier) {
      throw new ApiError(404, 'Supplier not found.');
    }

    const pos = supplier.purchaseOrders || [];
    const payableAmount = pos.reduce((sum, po) => {
      const s = (po.status || '').trim();
      const ps = (po.paymentStatus || '').trim();
      const isTargetStatus = s === 'Issued' || s === 'Partially Paid' || ps === 'Partially Paid';
      if (isTargetStatus) {
        const total = Number(po.grandTotal || 0);
        const paid = Number(po.amountPaid || 0);
        return sum + Math.max(0, total - paid);
      }
      return sum;
    }, 0);

    return res.status(200).json(
      new ApiResponse(200, {
        ...supplier,
        phone: supplier.phone || supplier.contact || '',
        payableAmount: Number(payableAmount.toFixed(2)),
      }, 'Supplier retrieved successfully.')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Update Supplier (Admin, Store Manager)
 */
export const updateSupplier = async (req, res, next) => {
  try {
    const { id } = req.params;

    const parseResult = updateSupplierSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw new ApiError(
        400,
        'Validation Error: Invalid update details provided.',
        parseResult.error.errors
      );
    }

    // Verify supplier exists
    const [existing] = await db
      .select({ id: suppliers.id })
      .from(suppliers)
      .where(eq(suppliers.id, id))
      .limit(1);

    if (!existing) {
      throw new ApiError(404, 'Supplier not found.');
    }

    const finalPhone = req.body.phone !== undefined 
      ? (req.body.phone ? req.body.phone.trim() : null)
      : (req.body.contact !== undefined ? (req.body.contact ? req.body.contact.trim() : null) : undefined);

    const updatePayload = {
      ...parseResult.data,
      ...(finalPhone !== undefined && { phone: finalPhone, contact: finalPhone }),
      updatedAt: new Date(),
    };

    const [updatedSupplier] = await db
      .update(suppliers)
      .set(updatePayload)
      .where(eq(suppliers.id, id))
      .returning();

    return res.status(200).json(
      new ApiResponse(200, updatedSupplier, 'Supplier updated successfully.')
    );
  } catch (error) {
    next(error);
  }
};
