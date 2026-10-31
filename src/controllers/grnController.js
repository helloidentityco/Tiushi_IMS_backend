import { eq, and } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  grns,
  purchaseOrders,
  poItems,
  warehouseStock,
  warehouseResourceStock,
  debitNotes,
  debitNoteItems,
  products,
  resources,
} from '../db/schema.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';

/**
 * Get all Goods Received Notes (GRNs)
 */
export const getAllGRNs = async (req, res, next) => {
  try {
    const list = await db.query.grns.findMany({
      orderBy: (grnsTable, { desc }) => [desc(grnsTable.createdAt)],
      with: {
        purchaseOrder: {
          with: {
            supplier: true,
          },
        },
        warehouse: true,
      },
    });

    return res.status(200).json(
      new ApiResponse(200, list, 'GRNs retrieved successfully')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Create Goods Received Note (GRN) & QA Inspection
 * (Admin, Store Manager, Warehouse Staff)
 */
export const createGRN = async (req, res, next) => {
  try {
    const {
      grnNumber,
      poId,
      batchNumber,
      expiryDate,
      unitsReceived,
      receivingDate,
      qualityStatus,
      warehouseId,
      deliveryNote,
      notes,
      items,
    } = req.body;

    if (!poId) {
      throw new ApiError(400, 'poId is required to process GRN receipt.');
    }

    const grnResult = await db.transaction(async (tx) => {
      // 1. Fetch Purchase Order
      const [po] = await tx
        .select()
        .from(purchaseOrders)
        .where(eq(purchaseOrders.id, poId))
        .limit(1);

      if (!po) {
        throw new ApiError(404, 'Purchase Order not found.');
      }

      if (po.status === 'Completed') {
        throw new ApiError(
          400,
          'Cannot receive items: This Purchase Order is already marked as Completed.'
        );
      }

      const targetWarehouseId = warehouseId || po.warehouseId;
      let totalRejectedAmount = 0;
      let totalPassedUnits = 0;
      let totalRejectedUnits = 0;
      let totalQuarantineUnits = 0;
      let totalProcessedReceived = 0;
      const stockUpdates = [];
      const rejectedBreakdown = [];

      // 2. Process inspection items if provided
      if (Array.isArray(items) && items.length > 0) {
        const currentPOItems = await tx
          .select()
          .from(poItems)
          .where(eq(poItems.poId, poId));

        const poItemMap = new Map(currentPOItems.map((item) => [item.id, item]));

        for (const inspectedItem of items) {
          const lineItem = poItemMap.get(inspectedItem.itemId) || currentPOItems.find(
            (p) => (inspectedItem.productId && p.productId === inspectedItem.productId) ||
                   (inspectedItem.resourceId && p.resourceId === inspectedItem.resourceId)
          );

          if (!lineItem) {
            continue;
          }

          const passedQty = Number(inspectedItem.passedQty || 0);
          const rejectedQty = Number(inspectedItem.rejectedQty || 0);
          const quarantineQty = Number(inspectedItem.quarantineQty || 0);

          const totalReceivedInThisBatch = passedQty + rejectedQty + quarantineQty;
          if (totalReceivedInThisBatch <= 0) continue;

          totalPassedUnits += passedQty;
          totalRejectedUnits += rejectedQty;
          totalQuarantineUnits += quarantineQty;
          totalProcessedReceived += totalReceivedInThisBatch;

          const newReceivedQty = lineItem.receivedQty + totalReceivedInThisBatch;

          if (newReceivedQty > lineItem.orderedQty) {
            throw new ApiError(
              400,
              `Received quantity (${newReceivedQty}) exceeds ordered quantity (${lineItem.orderedQty}) for line item ${lineItem.id}.`
            );
          }

          // Update line item receivedQty
          await tx
            .update(poItems)
            .set({
              receivedQty: newReceivedQty,
              updatedAt: new Date(),
            })
            .where(eq(poItems.id, lineItem.id));

          // Stock Update: ONLY increment usable stock for QA PASSED goods
          if (passedQty > 0) {
            if (lineItem.resourceId) {
              const [existingResourceStock] = await tx
                .select()
                .from(warehouseResourceStock)
                .where(
                  and(
                    eq(warehouseResourceStock.warehouseId, targetWarehouseId),
                    eq(warehouseResourceStock.resourceId, lineItem.resourceId)
                  )
                )
                .limit(1);

              if (existingResourceStock) {
                const newQty = existingResourceStock.quantity + passedQty;
                await tx
                  .update(warehouseResourceStock)
                  .set({
                    quantity: newQty,
                    updatedAt: new Date(),
                  })
                  .where(eq(warehouseResourceStock.id, existingResourceStock.id));

                stockUpdates.push({
                  resourceId: lineItem.resourceId,
                  warehouseId: targetWarehouseId,
                  incrementedBy: passedQty,
                  newQuantity: newQty,
                });
              } else {
                await tx.insert(warehouseResourceStock).values({
                  warehouseId: targetWarehouseId,
                  resourceId: lineItem.resourceId,
                  quantity: passedQty,
                });

                stockUpdates.push({
                  resourceId: lineItem.resourceId,
                  warehouseId: targetWarehouseId,
                  incrementedBy: passedQty,
                  newQuantity: passedQty,
                });
              }
            } else if (lineItem.productId) {
              const [existingStock] = await tx
                .select()
                .from(warehouseStock)
                .where(
                  and(
                    eq(warehouseStock.warehouseId, targetWarehouseId),
                    eq(warehouseStock.productId, lineItem.productId)
                  )
                )
                .limit(1);

              if (existingStock) {
                const newQty = existingStock.quantity + passedQty;
                await tx
                  .update(warehouseStock)
                  .set({
                    quantity: newQty,
                    updatedAt: new Date(),
                  })
                  .where(eq(warehouseStock.id, existingStock.id));

                stockUpdates.push({
                  productId: lineItem.productId,
                  warehouseId: targetWarehouseId,
                  incrementedBy: passedQty,
                  newQuantity: newQty,
                });
              } else {
                await tx.insert(warehouseStock).values({
                  warehouseId: targetWarehouseId,
                  productId: lineItem.productId,
                  quantity: passedQty,
                });

                stockUpdates.push({
                  productId: lineItem.productId,
                  warehouseId: targetWarehouseId,
                  incrementedBy: passedQty,
                  newQuantity: passedQty,
                });
              }
            }
          }

          // Track financial deduction for REJECTED goods
          if (rejectedQty > 0) {
            const lineDeduction = rejectedQty * Number(lineItem.unitPrice);
            totalRejectedAmount += lineDeduction;

            rejectedBreakdown.push({
              productId: lineItem.productId || null,
              resourceId: lineItem.resourceId || null,
              rejectedQty,
              unitPrice: lineItem.unitPrice,
              deduction: lineDeduction.toFixed(2),
              reason: inspectedItem.rejectionReason || 'Inspection QA Failed',
            });
          }
        }

        // Generate Debit Note if items were rejected
        if (totalRejectedAmount > 0 || (Array.isArray(req.body.rejectedItems) && req.body.rejectedItems.length > 0)) {
          const rejectionNotes = rejectedBreakdown
            .map((r) => `${r.rejectedQty} units rejected: ${r.reason}`)
            .join('; ');

          const [newDebitNote] = await tx
            .insert(debitNotes)
            .values({
              poId: po.id,
              supplierId: po.supplierId,
              warehouseId: targetWarehouseId,
              totalAmount: totalRejectedAmount.toFixed(2),
              refundStatus: 'Deducted',
              notes: `GRN Delivery Note: ${deliveryNote || 'N/A'}. Deductions: ${rejectionNotes || 'Defective units rejected during inspection'}`,
            })
            .returning();

          const itemsToInsert = [];

          if (Array.isArray(req.body.rejectedItems) && req.body.rejectedItems.length > 0) {
            for (const item of req.body.rejectedItems) {
              const qty = Number(item.quantity || item.rejectedQty || 0);
              const cost = Number(item.unitCost || item.unitPrice || 0);
              if (qty > 0) {
                itemsToInsert.push({
                  debitNoteId: newDebitNote.id,
                  productId: item.productId || null,
                  resourceId: item.resourceId || null,
                  quantity: qty,
                  unitCost: cost.toFixed(2),
                });
              }
            }
          }

          // Fallback to rejectedBreakdown if rejectedItems was not explicitly provided
          if (itemsToInsert.length === 0 && rejectedBreakdown.length > 0) {
            for (const item of rejectedBreakdown) {
              itemsToInsert.push({
                debitNoteId: newDebitNote.id,
                productId: item.productId || null,
                resourceId: item.resourceId || null,
                quantity: Number(item.rejectedQty || 1),
                unitCost: Number(item.unitPrice || 0).toFixed(2),
              });
            }
          }

          if (itemsToInsert.length > 0) {
            await tx.insert(debitNoteItems).values(itemsToInsert);
          }
        }

        // PO Fulfillment Synchronization
        const updatedLineItems = await tx
          .select()
          .from(poItems)
          .where(eq(poItems.poId, poId));

        const isFullyReceived = updatedLineItems.every(
          (item) => item.receivedQty >= item.orderedQty
        );

        let newGrandTotal = Number(po.grandTotal);
        let newBalanceDue = Number(po.balanceDue);
        if (totalRejectedAmount > 0) {
          newGrandTotal = Math.max(0, newGrandTotal - totalRejectedAmount);
          newBalanceDue = Math.max(0, newBalanceDue - totalRejectedAmount);
        }

        const newPOStatus = isFullyReceived ? 'Completed' : 'Partially Received';
        const newPaymentStatus = newBalanceDue <= 0.001 ? 'Paid' : po.paymentStatus;

        await tx
          .update(purchaseOrders)
          .set({
            status: newPOStatus,
            grandTotal: newGrandTotal.toFixed(2),
            balanceDue: newBalanceDue.toFixed(2),
            paymentStatus: newPaymentStatus,
            updatedAt: new Date(),
          })
          .where(eq(purchaseOrders.id, poId));
      }

      // Calculate final units received
      const finalUnitsReceived = Number(
        unitsReceived !== undefined ? unitsReceived : (totalProcessedReceived || 0)
      );

      // Determine quality status
      let determinedQualityStatus = qualityStatus;
      if (!determinedQualityStatus) {
        if (totalRejectedUnits > 0) {
          determinedQualityStatus = 'QC Issues / Rejected';
        } else if (totalQuarantineUnits > 0) {
          determinedQualityStatus = 'Quarantine Hold';
        } else {
          determinedQualityStatus = 'QA Passed';
        }
      }

      const generatedGrnNumber = grnNumber || `GRN-${Date.now().toString().slice(-6)}`;

      // Insert record into grns table
      const [savedGRN] = await tx
        .insert(grns)
        .values({
          grnNumber: generatedGrnNumber,
          poId,
          batchNumber: batchNumber || null,
          expiryDate: expiryDate ? expiryDate : null,
          unitsReceived: finalUnitsReceived,
          receivingDate: receivingDate ? receivingDate : new Date().toISOString().split('T')[0],
          qualityStatus: determinedQualityStatus,
          warehouseId: targetWarehouseId,
          deliveryNote: deliveryNote || null,
          notes: notes || null,
          items: items || [],
          status: 'Completed',
          isReversed: false,
          totalRejectedValue: totalRejectedAmount.toFixed(2),
        })
        .returning();

      return {
        ...savedGRN,
        stockUpdates,
        debitNoteGenerated: totalRejectedAmount > 0,
      };
    });

    return res.status(201).json(
      new ApiResponse(201, grnResult, 'Goods Received Note (GRN) created successfully.')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Reversal of GRN
 */
export const reverseGRN = async (req, res, next) => {
  try {
    const { id } = req.params;
    const [existing] = await db.select().from(grns).where(eq(grns.id, id)).limit(1);

    if (!existing) {
      throw new ApiError(404, 'GRN not found.');
    }

    if (existing.isReversed || existing.status === 'Reversed') {
      throw new ApiError(400, 'This GRN has already been reversed.');
    }

    const [updated] = await db
      .update(grns)
      .set({
        isReversed: true,
        status: 'Reversed',
        updatedAt: new Date(),
      })
      .where(eq(grns.id, id))
      .returning();

    return res.status(200).json(
      new ApiResponse(200, updated, 'GRN reversed successfully.')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Backward compatibility alias for receiveGRN
 */
export const receiveGRN = createGRN;
