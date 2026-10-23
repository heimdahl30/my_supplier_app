import {
    serial,
    text,
    integer,
    numeric,
    doublePrecision,
    timestamp,
    pgTable,
    check,
    varchar,
    boolean,
} from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';

export const products = pgTable('products', {
    id: serial('id').primaryKey(),
    name: text('name').notNull(),
    category: text('category').notNull(),
    pricePerKg: numeric('price_per_kg', { precision: 10, scale: 2 }).notNull(),
    stockKg: integer('stock_kg').notNull(),
    desc: text('desc').notNull(),
});

// 👤 THE CORE IDENTITY TABLE (Cleaned Up)
export const customers = pgTable('customers', {
    id: serial('id').primaryKey(),
    name: text('name').notNull(),
    phone: text('phone').notNull(),
    email: text('email'),
    passwordHash: text('password_hash').notNull(),
    role: text('role').notNull().default('customer'),
    subRole: text('sub_role'),
    razorpaySubAccountId: varchar('razorpay_sub_account_id', { length: 255 }),
});

// 📍 THE Saved RELATIONAL ADDRESS TABLE (With Geolocation tracking)
export const customerAddresses = pgTable('customer_addresses', {
    id: serial('id').primaryKey(),
    // 🔗 THE LINKING WIRE: Connects this address record back to the specific customer row
    customerId: integer('customer_id')
        .notNull()
        .references(() => customers.id, { onDelete: 'cascade' }),
    label: text('label').notNull(), // e.g., 'Home', 'Office', 'Gym'
    fullName: text('full_name').notNull(),
    phone: text('phone').notNull(),
    addressLine: text('address_line').notNull(),

    // 🌍 GEOLOCATION MATRIX CELLS FOR MAP PINPOINTING
    latitude: doublePrecision('latitude').notNull(),
    longitude: doublePrecision('longitude').notNull(),

    isDefault: boolean('is_default').default(false).notNull(),
});

export const orders = pgTable('orders', {
    id: serial('id').primaryKey(),
    customerId: integer('customer_id')
        .notNull()
        .references(() => customers.id),
    totalPrice: numeric('total_price', { precision: 10, scale: 2 }).notNull(),
    deliveryNotes: text('delivery_notes'),
    status: text('status')
        .$type<
            'Packing' | 'Processing' | 'Packed' | 'Out for Delivery' | 'Delivered' | 'Cancelled'
        >()
        .notNull()
        .default('Processing'),
    // 💳 NEW BILLING LIFECYCLE TRACK (Add this to handle the payment flow safely!)
    billingStatus: varchar('billing_status', { length: 50 }).default('Unpaid').notNull(), // 'Unpaid', 'Paid'
    billingGatewayId: varchar('billing_gateway_id', { length: 255 }), // Razorpay unique serial order ID
    deliveryPartnerId: integer('delivery_partner_id').references(() => customers.id),
    orderDate: timestamp('order_date').defaultNow().notNull(), // 📥 Received
    packedAt: timestamp('packed_at'), // 📦 Ready for Delivery
    claimedAt: timestamp('claimed_at'), // 🚚 Claimed by Driver
    deliveredAt: timestamp('delivered_at'),
    refundedAmount: numeric('refunded_amount', { precision: 10, scale: 2 }).default('0'),
    refundStatus: text('refund_status').default('No Refund'), // 💸 No Refund, Requested, Approved, Rejected
    refundRequestedAt: timestamp('refund_requested_at'),
    refundApprovedAt: timestamp('refund_approved_at'),
    refundRejectedAt: timestamp('refund_rejected_at'),
    refundReason: text('refund_reason'),
    payoutStatus: text('payout_status').notNull().default('Unpaid'), // 💰 Unpaid or Paid
    payoutAt: timestamp('payout_at'),
    payoutReferenceId: varchar('payout_reference_id', { length: 255 }),
    deliveryAddressLine: text('delivery_address_line'), // Snapshot of the address at order time
    deliveryLatitude: doublePrecision('delivery_latitude'), // Snapshot of the latitude at order time
    deliveryLongitude: doublePrecision('delivery_longitude'), // Snapshot of the longitude at order time
    deliveryPhone: text('delivery_phone'), // Snapshot of the phone at order time
    deliveryRecipientName: text('delivery_recipient_name'), // Snapshot of the name at order time
    // Stores multiple image web links safely as an array directly within the table row container matrix!
    refundEvidenceUrls: text('refund_evidence_urls')
        .array()
        .default(sql`'{}'::text[]`)
        .notNull(),
});

export const orderItems = pgTable(
    'order_items',
    {
        id: serial('id').primaryKey(),
        orderId: integer('order_id')
            .notNull()
            .references(() => orders.id),
        productId: integer('product_id')
            .notNull()
            .references(() => products.id),
        quantityKg: integer('quantity_kg').notNull(),
    },
    (table) => [
        // 🛡️ THE SECURITY BULLETPROOF SHIELD:
        // This injects a native SQL CHECK constraint into PostgreSQL.
        // If quantity_kg is <= 0, the database rejects the row instantly!
        {
            quantityCheck: check('quantity_positive_check', sql`${table.quantityKg} > 0`),
        },
    ]
);

export const cartItems = pgTable('cart_items', {
    id: serial('id').primaryKey(),
    customerId: integer('customer_id')
        .notNull()
        .references(() => customers.id, { onDelete: 'cascade' }),
    productId: integer('product_id')
        .notNull()
        .references(() => products.id, { onDelete: 'cascade' }),
    quantityKg: integer('quantity_kg').notNull().default(1),
    updatedAt: timestamp('updated_at')
        .defaultNow()
        .$onUpdate(() => new Date()),
});

export const refreshTokens = pgTable('refresh_tokens', {
    id: serial('id').primaryKey(),
    customerId: integer('customer_id')
        .notNull()
        .references(() => customers.id),
    token: text('token').unique().notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const productRelation = relations(products, ({ many }) => ({
    orderItems: many(orderItems),
}));

export const customerRelation = relations(customers, ({ many }) => ({
    placedOrders: many(orders, {
        relationName: 'customer_orders', // Matches your customer key name exactly
    }),
    handledDeliveries: many(orders, {
        relationName: 'driver_deliveries', // Matches your driver key name exactly
    }),
    addresses: many(customerAddresses),
    refreshTokens: many(refreshTokens),
}));

export const orderRelation = relations(orders, ({ one, many }) => ({
    customer: one(customers, {
        fields: [orders.customerId],
        references: [customers.id],
        relationName: 'customer_orders',
    }),
    deliveryPartner: one(customers, {
        fields: [orders.deliveryPartnerId],
        references: [customers.id],
        relationName: 'driver_deliveries',
    }),
    orderItems: many(orderItems),
}));

export const orderItemsRelation = relations(orderItems, ({ one }) => ({
    order: one(orders, {
        fields: [orderItems.orderId],
        references: [orders.id],
    }),
    product: one(products, {
        fields: [orderItems.productId],
        references: [products.id],
    }),
}));

export const customerAddressesRelations = relations(customerAddresses, ({ one }) => ({
    customer: one(customers, {
        fields: [customerAddresses.customerId],
        references: [customers.id], // Maps back to the unique parent customer row
    }),
}));

export const refreshTokenRelation = relations(refreshTokens, ({ one }) => ({
    customer: one(customers, {
        fields: [refreshTokens.customerId],
        references: [customers.id],
    }),
}));

/*

Frontend Maps address autocomplete

import React, { useState, useRef, useEffect } from 'react';
import { APIProvider, Map, AdvancedMarker, useMapsLibrary } from '@vis.gl/react-google-maps';

export default function AddressPicker({ onLocationConfirmed }) {
  const [selectedLocation, setSelectedLocation] = useState({ lat: 22.8046, lng: 86.2029 }); // Default to city center
  const [textAddress, setTextAddress] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Load the official Google Places Autocomplete Library
  const placesLibrary = useMapsLibrary('places');

  useEffect(() => {
    if (!placesLibrary || !inputRef.current) return;

    // Connect Google Autocomplete to your text input element
    const autocomplete = new placesLibrary.Autocomplete(inputRef.current, {
      fields: ['geometry', 'formatted_address'],
      componentRestrictions: { country: 'in' } // Restrict search to India
    });

    // When the user selects an address from the dropdown list
    autocomplete.addListener('place_changed', () => {
      const place = autocomplete.getPlace();

      if (place.geometry?.location) {
        const newLat = place.geometry.location.lat();
        const newLng = place.geometry.location.lng();

        // 1. Move the map and pin to the selected coordinates
        setSelectedLocation({ lat: newLat, lng: newLng });
        setTextAddress(place.formatted_address || '');
      }
    });
  }, [placesLibrary]);

  // When the user drags the pin on the map to find their exact door
  const handleMarkerDragEnd = (event: google.maps.MapMouseEvent) => {
    if (event.latLng) {
      setSelectedLocation({
        lat: event.latLng.lat(),
        lng: event.latLng.lng()
      });
    }
  };

  return (
    // Wrap your components with your Google Maps API Key
    <APIProvider apiKey="YOUR_GOOGLE_MAPS_API_KEY">
      <div className="location-picker-container" style={{ width: '100%', maxWidth: '500px' }}>

        The Text Search input box the user interacts with
        <div className="search-box">
          <label>Type your delivery address:</label>
          <input
            ref={inputRef}
            type="text"
            placeholder="Search building, street, or locality..."
            style={{ width: '100%', padding: '10px', marginBottom: '15px' }}
          />
        </div>

        The Interactive Map Component
        <div style={{ height: '350px', width: '100%', marginBottom: '15px' }}>
          <Map
            center={selectedLocation}
            defaultZoom={15}
            mapId="YOUR_MAP_ID" // Required for Advanced Markers
          >
            The Draggable Delivery Pin
            <AdvancedMarker
              position={selectedLocation}
              draggable={true}
              onDragEnd={handleMarkerDragEnd}
            />
          </Map>
        </div>

        The Action Button to feed data back into your signup form state
        <button
          type="button"
          onClick={() => onLocationConfirmed(textAddress, selectedLocation.lat, selectedLocation.lng)}
          style={{ width: '100%', padding: '12px', backgroundColor: '#28a745', color: '#fff', border: 'none', cursor: 'pointer' }}
        >
          Confirm Delivery Location
        </button>

      </div>
    </APIProvider>
  );
}
*/

/*

Location picker

import React, { useState } from 'react';
import axios from 'axios';
import AddressPicker from './AddressPicker';

export default function SignupForm() {
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    password: '',
    address: '',      // Captured from Map
    latitude: 0,      // Captured from Map
    longitude: 0      // Captured from Map
  });

  const handleLocationSave = (address: string, lat: number, lng: number) => {
    setFormData(prev => ({
      ...prev,
      address: address,
      latitude: lat,
      longitude: lng
    }));
    alert("Location coordinates locked in successfully!");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Fires off exactly to your clean backend signup endpoint
      const response = await axios.post('http://localhost:5000/api/v1/auth/signup', formData);
      console.log('Signup successful:', response.data);
    } catch (err) {
      console.error('Registration failed', err);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
    Name, Phone, Email fields go here...

      Insert our new custom map selector element
      <AddressPicker onLocationConfirmed={handleLocationSave} />

      <button type="submit" style={{ marginTop: '20px' }}>Register Account</button>
    </form>
  );
}

*/
