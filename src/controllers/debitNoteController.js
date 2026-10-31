import { eq, desc } from 'drizzle-orm';
import { db } from '../db/index.js';
import { debitNotes } from '../db/schema.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';

/**
 * Get All Debit Notes with nested PO, Supplier, and Warehouse details
 * (All Authenticated Users)
 */
export const getAllDebitNotes = async (req, res, next) => {
  try {
    const list = await db.query.debitNotes.findMany({
      orderBy: [desc(debitNotes.createdAt)],
      with: {
        purchaseOrder: {
          columns: {
            id: true,
            poNumber: true,
            status: true,
            grandTotal: true,
            createdAt: true,
          },
        },
        supplier: {
          columns: {
            id: true,
            name: true,
            email: true,
            contact: true,
          },
        },
        warehouse: {
          columns: {
            id: true,
            code: true,
            name: true,
          },
        },
        items: {
          with: {
            product: true,
            resource: true,
          },
        },
      },
    });

    const formattedList = list.map((dn) => ({
      ...dn,
      debit_note_items: dn.items || [],
    }));

    return res.status(200).json(
      new ApiResponse(200, formattedList, 'Debit Notes & Returns retrieved successfully.')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Get Single Debit Note by ID
 */
export const getDebitNoteById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const note = await db.query.debitNotes.findFirst({
      where: eq(debitNotes.id, id),
      with: {
        purchaseOrder: true,
        supplier: true,
        warehouse: true,
        items: {
          with: {
            product: true,
            resource: true,
          },
        },
      },
    });

    if (!note) {
      throw new ApiError(404, 'Debit note not found.');
    }

    const formattedNote = {
      ...note,
      debit_note_items: note.items || [],
    };

    return res.status(200).json(
      new ApiResponse(200, formattedNote, 'Debit note retrieved successfully.')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Mark Debit Note as Refunded / Settled (Admin, Store Manager)
 */
export const markDebitNoteRefunded = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Check existing debit note
    const [existingNote] = await db
      .select()
      .from(debitNotes)
      .where(eq(debitNotes.id, id))
      .limit(1);

    if (!existingNote) {
      throw new ApiError(404, 'Debit note not found.');
    }

    if (existingNote.refundStatus === 'Refunded') {
      return res.status(200).json(
        new ApiResponse(
          200,
          existingNote,
          'Debit note is already marked as Refunded.'
        )
      );
    }

    const [updatedNote] = await db
      .update(debitNotes)
      .set({
        refundStatus: 'Refunded',
        updatedAt: new Date(),
      })
      .where(eq(debitNotes.id, id))
      .returning();

    return res.status(200).json(
      new ApiResponse(
        200,
        updatedNote,
        'Debit note marked as Refunded successfully.'
      )
    );
  } catch (error) {
    next(error);
  }
};
