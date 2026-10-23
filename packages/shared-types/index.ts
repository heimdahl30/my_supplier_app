// packages/shared-types/index.ts
import { type InferSelectModel, type InferInsertModel } from 'drizzle-orm';

// 🔗 LINKING WIRE: Reach directly across into your sibling backend directory to extract the schemas!
import { customers, orders, products, orderItems } from '../../apps/backend/src/db/schema';

// 👔 Customer Matrix Types
export type Customer = InferSelectModel<typeof customers>;
export type NewCustomer = InferInsertModel<typeof customers>;

// 🛒 Inventory Product Types
export type Product = InferSelectModel<typeof products>;

// 📦 Order Item Detail Types (Add this!)
export type OrderItem = InferSelectModel<typeof orderItems>;

// 📋 Order & Logistics Pipeline History Types
export type BaseOrder = InferSelectModel<typeof orders>;

// 2. 🌟 COMPOSITE TYPE A: Customer Profile Dossier View
// Use this type specifically for the customer's "/account" history view screen!
export type CustomerWithOrders = Omit<Customer, 'passwordHash'> & {
    placedOrders: (BaseOrder & {
        orderItems: (OrderItem & { product: Product })[];
    })[];
};

// 🚀 ENHANCED MATRIX JOIN: Explicitly define relational payloads for the Frontend!
// This guarantees your Next.js components know exactly what a manager ledger or driver log looks like.
export type OrderWithRelations = BaseOrder & {
    customer: Omit<Customer, 'passwordHash'>;
    deliveryPartner?: Pick<Customer, 'id' | 'name' | 'phone'>;
    orderItems: (OrderItem & {
        product: Product; // Deeply nests product details inside each item slot!
    })[]
};
