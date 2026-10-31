import { eq, and, or } from 'drizzle-orm';
import { db } from '../db/index.js';
import { rolePermissions } from '../db/schema.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';

export const DEFAULT_PERMISSIONS_MATRIX = [
  { 
    id: 'dashboard', 
    feature: 'Dashboard Analytics & Financial KPIs', 
    admin: true, 
    manager: true, 
    warehouse: false, 
    cashier: false 
  },
  { id: 'pos', feature: 'POS Terminal Sales & Invoicing', admin: true, manager: true, warehouse: false, cashier: true },
  { id: 'discount_override', feature: 'Cart Price Overrides & High Discounts', admin: true, manager: true, warehouse: false, cashier: false },
  { id: 'inventory', feature: 'Product Creation & SKU Generation', admin: true, manager: true, warehouse: false, cashier: false },
  { id: 'transfers', feature: 'Inter-Warehouse Stock Transfers', admin: true, manager: true, warehouse: true, cashier: false },
  { id: 'cycle_counts', feature: 'Cycle Count Audits & Discrepancy Reconciliation', admin: true, manager: true, warehouse: true, cashier: false },
  { id: 'receiving', feature: 'Goods Received Notes (GRN) Inward Signing', admin: true, manager: true, warehouse: true, cashier: false },
  { id: 'suppliers', feature: 'Vendor Purchase Orders (PO) Authorization', admin: true, manager: false, warehouse: false, cashier: false },
  { id: 'reports', feature: 'Stock Valuation & Financial Reports', admin: true, manager: true, warehouse: false, cashier: false },
  { id: 'security', feature: 'Full System Audit Log Review', admin: true, manager: false, warehouse: false, cashier: false }
];

export const normalizeRole = (role) => {
  const r = (role || '').trim().toLowerCase();
  if (r === 'manager' || r === 'store manager' || r === 'store_manager') return 'manager';
  if (r === 'warehouse' || r === 'warehouse staff' || r === 'warehouse_staff') return 'warehouse';
  if (r === 'cashier') return 'cashier';
  if (r === 'admin') return 'admin';
  return r;
};

export const getRoleDisplayName = (role) => {
  const norm = normalizeRole(role);
  if (norm === 'manager') return 'Store Manager';
  if (norm === 'warehouse') return 'Warehouse Staff';
  if (norm === 'cashier') return 'Cashier';
  if (norm === 'admin') return 'Admin';
  return role;
};

/**
 * Seed initial permission matrix rows if role_permissions table is empty
 */
const seedPermissionsIfEmpty = async () => {
  const existing = await db.select().from(rolePermissions).limit(1);
  if (existing.length === 0) {
    const rowsToInsert = [];
    for (const p of DEFAULT_PERMISSIONS_MATRIX) {
      rowsToInsert.push({
        role: 'manager',
        feature: p.feature,
        featureId: p.id,
        isAllowed: p.manager,
      });
      rowsToInsert.push({
        role: 'warehouse',
        feature: p.feature,
        featureId: p.id,
        isAllowed: p.warehouse,
      });
      rowsToInsert.push({
        role: 'cashier',
        feature: p.feature,
        featureId: p.id,
        isAllowed: p.cashier,
      });
    }
    await db.insert(rolePermissions).values(rowsToInsert);
  }
};

/**
 * Reconstruct matrix array from database rows
 */
export const buildPermissionsMatrix = (records) => {
  const lookup = {};
  for (const rec of (records || [])) {
    const normRole = normalizeRole(rec.role);
    const key = (rec.featureId || rec.feature || '').toLowerCase();
    if (!lookup[key]) lookup[key] = {};
    lookup[key][normRole] = rec.isAllowed;

    if (rec.feature) {
      const featKey = rec.feature.toLowerCase();
      if (!lookup[featKey]) lookup[featKey] = {};
      lookup[featKey][normRole] = rec.isAllowed;
    }
  }

  return DEFAULT_PERMISSIONS_MATRIX.map(def => {
    const idKey = def.id.toLowerCase();
    const featKey = def.feature.toLowerCase();
    const roleMap = lookup[idKey] || lookup[featKey] || {};

    return {
      id: def.id,
      feature: def.feature,
      admin: true,
      manager: roleMap.manager !== undefined ? roleMap.manager : def.manager,
      warehouse: roleMap.warehouse !== undefined ? roleMap.warehouse : def.warehouse,
      cashier: roleMap.cashier !== undefined ? roleMap.cashier : def.cashier,
    };
  });
};

/**
 * GET /api/permissions
 * Retrieve current permission matrix from Neon DB
 */
export const getPermissions = async (req, res, next) => {
  try {
    let records = await db.select().from(rolePermissions);
    if (!records || records.length === 0) {
      await seedPermissionsIfEmpty();
      records = await db.select().from(rolePermissions);
    }

    const matrix = buildPermissionsMatrix(records);
    return res.status(200).json(
      new ApiResponse(200, matrix, 'Permissions matrix retrieved successfully.')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * PUT or PATCH /api/permissions
 * Update a specific role's permission for a specific feature, or update full matrix
 */
export const updatePermission = async (req, res, next) => {
  try {
    const { role, roleKey, feature, featureId, isAllowed, matrix } = req.body;

    // Case A: Full matrix array payload
    if (Array.isArray(matrix)) {
      for (const item of matrix) {
        const featId = item.id;
        const featName = item.feature || featId;
        const roles = ['manager', 'warehouse', 'cashier'];
        for (const r of roles) {
          if (item[r] !== undefined) {
            const allowed = Boolean(item[r]);
            const [existing] = await db
              .select()
              .from(rolePermissions)
              .where(
                and(
                  or(eq(rolePermissions.role, r), eq(rolePermissions.role, getRoleDisplayName(r))),
                  or(eq(rolePermissions.featureId, featId), eq(rolePermissions.feature, featName))
                )
              )
              .limit(1);

            if (existing) {
              await db
                .update(rolePermissions)
                .set({ isAllowed: allowed, updatedAt: new Date() })
                .where(eq(rolePermissions.id, existing.id));
            } else {
              await db.insert(rolePermissions).values({
                role: r,
                feature: featName,
                featureId: featId,
                isAllowed: allowed,
              });
            }
          }
        }
      }

      const records = await db.select().from(rolePermissions);
      const updatedMatrix = buildPermissionsMatrix(records);
      return res.status(200).json(
        new ApiResponse(200, updatedMatrix, 'Permissions matrix updated successfully.')
      );
    }

    // Case B: Single permission update
    const targetRole = normalizeRole(role || roleKey);
    if (!targetRole) {
      throw new ApiError(400, 'Target role is required (e.g., manager, warehouse, cashier).');
    }

    if (targetRole === 'admin') {
      throw new ApiError(400, 'Admin permissions cannot be modified.');
    }

    const targetFeatureId = (featureId || '').trim();
    const targetFeatureName = (feature || '').trim();

    if (!targetFeatureId && !targetFeatureName) {
      throw new ApiError(400, 'Feature or featureId is required.');
    }

    // Resolve feature metadata
    const def = DEFAULT_PERMISSIONS_MATRIX.find(
      d => (targetFeatureId && d.id === targetFeatureId) || 
           (targetFeatureName && (d.feature === targetFeatureName || d.id === targetFeatureName))
    );

    const resolvedFeatureId = def ? def.id : (targetFeatureId || targetFeatureName);
    const resolvedFeatureName = def ? def.feature : (targetFeatureName || targetFeatureId);
    const allowed = Boolean(isAllowed);

    // Check if record exists
    const [existing] = await db
      .select()
      .from(rolePermissions)
      .where(
        and(
          or(eq(rolePermissions.role, targetRole), eq(rolePermissions.role, getRoleDisplayName(targetRole))),
          or(eq(rolePermissions.featureId, resolvedFeatureId), eq(rolePermissions.feature, resolvedFeatureName))
        )
      )
      .limit(1);

    if (existing) {
      await db
        .update(rolePermissions)
        .set({
          role: targetRole,
          feature: resolvedFeatureName,
          featureId: resolvedFeatureId,
          isAllowed: allowed,
          updatedAt: new Date(),
        })
        .where(eq(rolePermissions.id, existing.id));
    } else {
      await db.insert(rolePermissions).values({
        role: targetRole,
        feature: resolvedFeatureName,
        featureId: resolvedFeatureId,
        isAllowed: allowed,
      });
    }

    const records = await db.select().from(rolePermissions);
    const updatedMatrix = buildPermissionsMatrix(records);

    return res.status(200).json(
      new ApiResponse(200, updatedMatrix, `Permission for ${getRoleDisplayName(targetRole)} updated successfully.`)
    );
  } catch (error) {
    next(error);
  }
};
