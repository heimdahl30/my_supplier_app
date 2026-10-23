CREATE TABLE "cart_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"customer_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"quantity_kg" integer DEFAULT 1 NOT NULL,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "customer_addresses" (
	"id" serial PRIMARY KEY NOT NULL,
	"customer_id" integer NOT NULL,
	"label" text NOT NULL,
	"full_name" text NOT NULL,
	"phone" text NOT NULL,
	"address_line" text NOT NULL,
	"latitude" double precision NOT NULL,
	"longitude" double precision NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "order_date" SET DATA TYPE timestamp;--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "order_date" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "role" text DEFAULT 'customer' NOT NULL;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "sub_role" text;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "razorpay_sub_account_id" varchar(255);--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "status" text DEFAULT 'Processing' NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "billing_status" varchar(50) DEFAULT 'Unpaid' NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "billing_gateway_id" varchar(255);--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "delivery_partner_id" integer;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "packed_at" timestamp;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "claimed_at" timestamp;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "delivered_at" timestamp;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "refunded_amount" numeric(10, 2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "refund_status" text DEFAULT 'No Refund';--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "refund_requested_at" timestamp;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "refund_approved_at" timestamp;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "refund_rejected_at" timestamp;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "refund_reason" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "payout_status" text DEFAULT 'Unpaid' NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "payout_at" timestamp;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "payout_reference_id" varchar(255);--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "delivery_address_line" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "delivery_phone" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "delivery_recipient_name" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "desc" text NOT NULL;--> statement-breakpoint
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_addresses" ADD CONSTRAINT "customer_addresses_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_delivery_partner_id_customers_id_fk" FOREIGN KEY ("delivery_partner_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customers" DROP COLUMN "address";--> statement-breakpoint
ALTER TABLE "customers" DROP COLUMN "latitude";--> statement-breakpoint
ALTER TABLE "customers" DROP COLUMN "longitude";--> statement-breakpoint
ALTER TABLE "orders" DROP COLUMN "is_delivered";