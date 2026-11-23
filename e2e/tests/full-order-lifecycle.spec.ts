import { test, expect, Page } from '@playwright/test';
import { Client } from 'pg';
import crypto from 'crypto';

const TEST_DB_URL = process.env.TEST_DATABASE_URL;
const RAZORPAY_SECRET = process.env.RAZORPAY_KEY_SECRET || 'your_razorpay_test_secret_here';

// Helper: Register a user via UI with real Leaflet map interaction
async function registerUserViaUI(
    page: Page,
    user: { name: string; phone: string; email: string; password: string },
    mapOffset = { x: 180, y: 120 }
) {
    await page.goto('/register');
    const leafletMap = page.locator('.leaflet-container');
    await expect(leafletMap).toBeVisible({ timeout: 10000 });
    await leafletMap.click({ position: mapOffset });

    await page.locator('input[name="name"]').fill(user.name);
    await page.locator('input[name="phone"]').fill(user.phone);
    await page.locator('input[name="email"]').fill(user.email);
    await page.locator('input[name="password"]').fill(user.password);
    await page.locator('input[name="confirmPassword"]').fill(user.password);
    await expect(page.locator('input[name="address"]')).not.toHaveValue('', { timeout: 10000 });

    await page.locator('button[type="submit"]').click();
    await page.waitForURL('**/login', { timeout: 10000 });
}

// Helper: Log in a user via /login
async function loginUserViaUI(page: Page, email: string, password: string) {
    await page.goto('/login');
    await page.locator('input[name="email"]').fill(email);
    await page.locator('input[name="password"]').fill(password);
    await page.locator('button[type="submit"]').click();
    await expect(page).not.toHaveURL(/\/login$/, { timeout: 10000 });
}

test.describe('Complete Supply Chain & Logistics Lifecycle E2E', () => {
    test('executes full 8-phase lifecycle with Master Ledger tracking & driver commission verification', async ({
        browser,
    }) => {
        // Allow generous timeout for the complete 8-phase multi-context journey
        test.setTimeout(120000);

        const uniqueId = Date.now();
        const productName = `E2E Farm Apples ${uniqueId}`;

        const manager = {
            name: 'E2E Store Manager',
            email: `manager.${uniqueId}@example.com`,
            phone: `97${String(uniqueId).slice(-8)}`,
            password: 'Password123!',
        };

        const driver = {
            name: 'E2E Delivery Driver',
            email: `driver.${uniqueId}@example.com`,
            phone: `96${String(uniqueId).slice(-8)}`,
            password: 'Password123!',
        };

        const customer = {
            name: 'E2E Grocery Buyer',
            email: `buyer.${uniqueId}@example.com`,
            phone: `98${String(uniqueId).slice(-8)}`,
            password: 'Password123!',
        };

        // 3 isolated browser contexts so Manager, Driver, and Customer stay logged in simultaneously
        const managerContext = await browser.newContext();
        const driverContext = await browser.newContext();
        const customerContext = await browser.newContext();

        const managerPage = await managerContext.newPage();
        const driverPage = await driverContext.newPage();
        const customerPage = await customerContext.newPage();

        // Auto-accept confirm() dialogs on Driver pages (Claim Order & DELIVERED)
        driverPage.on('dialog', (dialog) => dialog.accept());

        // =========================================================
        // PHASE 1: REGISTER MANAGER & PROMOTE IN POSTGRESQL
        // =========================================================
        await registerUserViaUI(managerPage, manager, { x: 170, y: 110 });

        const managerDb = new Client({ connectionString: TEST_DB_URL });
        await managerDb.connect();
        await managerDb.query(
            `UPDATE customers SET role = 'admin', sub_role = 'manager' WHERE email = $1`,
            [manager.email]
        );
        await managerDb.end();

        // =========================================================
        // PHASE 2: MANAGER LOGS IN & ADDS PRODUCT TO INVENTORY
        // =========================================================
        await loginUserViaUI(managerPage, manager.email, manager.password);
        await managerPage.goto('/admin/addProduct');

        await managerPage.locator('input[name="name"]').fill(productName);
        await managerPage.locator('select[name="category"]').selectOption('produce');
        await managerPage.locator('input[name="price"]').fill('120');
        await managerPage.locator('input[name="stockKg"]').fill('50');
        await managerPage
            .locator('input[name="description"]')
            .fill('Fresh orchard apples tested via full-stack Playwright E2E.');

        await managerPage.getByRole('button', { name: /Commit Product to Inventory/i }).click();
        await expect(managerPage.getByText(/Inventory Updated Successfully/i)).toBeVisible({
            timeout: 10000,
        });

        // =========================================================
        // PHASE 3 & 4: CUSTOMER REGISTERS, SHOPS & PAYS VIA RAZORPAY
        // =========================================================
        await registerUserViaUI(customerPage, customer, { x: 200, y: 140 });
        await loginUserViaUI(customerPage, customer.email, customer.password);

        // Expose Node crypto helper so browser-side Razorpay mock generates a genuine HMAC signature
        await customerPage.exposeFunction(
            'generateValidRazorpaySignature',
            (rzpOrderId: string, rzpPaymentId: string) => {
                return crypto
                    .createHmac('sha256', RAZORPAY_SECRET)
                    .update(`${rzpOrderId}|${rzpPaymentId}`)
                    .digest('hex');
            }
        );

        // Inject mock window.Razorpay SDK
        await customerPage.addInitScript(() => {
            (window as unknown as Record<string, unknown>).Razorpay = function (options: {
                order_id?: string;
                handler?: (response: Record<string, string>) => void;
            }) {
                return {
                    open: async () => {
                        const paymentId = `pay_e2e_${Date.now()}`;
                        const orderId = options.order_id || 'order_e2e_mock';
                        const genSig = (
                            window as unknown as {
                                generateValidRazorpaySignature: (
                                    o: string,
                                    p: string
                                ) => Promise<string>;
                            }
                        ).generateValidRazorpaySignature;
                        const validSignature = await genSig(orderId, paymentId);

                        options.handler?.({
                            razorpay_payment_id: paymentId,
                            razorpay_order_id: orderId,
                            razorpay_signature: validSignature,
                        });
                    },
                };
            };
        });

        await customerPage.goto('/store');
        const productCard = customerPage.locator('div', { hasText: productName }).first();
        await expect(productCard).toBeVisible({ timeout: 10000 });
        await productCard.getByRole('button', { name: /add/i }).first().click();

        await customerPage.getByRole('button', { name: /My Basket/i }).click();
        await customerPage.getByRole('button', { name: /Proceed to Delivery Details/i }).click();

        await customerPage.waitForURL('**/checkout', { timeout: 10000 });
        const finalizeBtn = customerPage.getByRole('button', {
            name: 'Confirm & Authorize Delivery',
        });
        await expect(finalizeBtn).toBeEnabled({ timeout: 10000 });

        customerPage.once('dialog', (dialog) => dialog.accept());
        await finalizeBtn.click();

        // Capture the real Order ID from /order-success?id=...
        await customerPage.waitForURL('**/order-success**', { timeout: 15000 });
        const orderUrl = new URL(customerPage.url());
        const orderId = orderUrl.searchParams.get('id');
        expect(orderId).toBeTruthy();

        const paddedOrderId = `#000${orderId}`;

        // Open live tracking page (/orders/[id]) to verify map & Socket.IO room
        await customerPage.getByRole('link', { name: /Track Live Logistics Status/i }).click();
        await customerPage.waitForURL(`**/orders/${orderId}`, { timeout: 10000 });
        await expect(customerPage.getByText('Logistics Console')).toBeVisible();
        await expect(customerPage.locator('.leaflet-container')).toBeVisible({ timeout: 10000 });

        // ✅ LEDGER CHECK 1: Verify order starts in "1. Packing Channels" on Master Ledger
        await managerPage.goto('/admin/ledger');
        await expect(managerPage.locator('tr', { hasText: paddedOrderId })).toBeVisible({
            timeout: 10000,
        });

        // =========================================================
        // PHASE 5: WAREHOUSE PACKING (/admin/ordersReceived)
        // =========================================================
        await managerPage.goto('/admin/ordersReceived');
        const packingRow = managerPage.locator('tr', { hasText: `#${orderId}` });
        await expect(packingRow).toBeVisible({ timeout: 10000 });

        managerPage.once('dialog', (dialog) => dialog.accept());
        await packingRow.getByRole('button', { name: /Ready for Delivery/i }).click();

        // Wait until row disappears from ordersReceived after PATCH /packed succeeds
        await expect(packingRow).toHaveCount(0, { timeout: 10000 });

        // ✅ LEDGER CHECK 2: Verify order moves to "2. Shelf Staging" on Master Ledger
        await managerPage.goto('/admin/ledger');
        await managerPage.getByRole('button', { name: /Total/i }).nth(1).click();
        await expect(managerPage.locator('tr', { hasText: paddedOrderId })).toBeVisible({
            timeout: 10000,
        });

        // =========================================================
        // PHASE 6: DRIVER SETUP, CLAIM, DELIVERY & COMMISSION CHECK
        // =========================================================
        await registerUserViaUI(driverPage, driver, { x: 190, y: 130 });

        // Promote driver in PostgreSQL (and attach razorpay_sub_account_id so Claim Order is authorized)
        const driverDb = new Client({ connectionString: TEST_DB_URL });
        await driverDb.connect();
        await driverDb.query(
            `UPDATE customers SET role = 'admin', sub_role = 'driver', razorpay_sub_account_id = 'acc_dev_test_e2e_driver' WHERE email = $1`,
            [driver.email]
        );
        await driverDb.end();
        await loginUserViaUI(driverPage, driver.email, driver.password);
        // 6A. Claim the packed order on /admin/packedOrders
        await driverPage.goto('/admin/packedOrders');
        const packedRow = driverPage.locator('tr', { hasText: `#${orderId}` });
        await expect(packedRow).toBeVisible({ timeout: 10000 });
        await packedRow.getByRole('button', { name: /Claim Order/i }).click();
        await expect(packedRow).toHaveCount(0, { timeout: 10000 });

        // ✅ LEDGER CHECK 3: Verify order moves to "3. Road Transit Fleet" with Driver name
        await managerPage.goto('/admin/ledger');
        await managerPage.getByRole('button', { name: /Total/i }).nth(2).click();
        const transitRow = managerPage.locator('tr', { hasText: paddedOrderId });
        await expect(transitRow).toBeVisible({ timeout: 10000 });
        await expect(transitRow.getByText(driver.name)).toBeVisible();

        // 6B. Deliver the claimed order on /admin/driverClaims
        await driverPage.goto('/admin/driverClaims');
        const claimedRow = driverPage.locator('tr', { hasText: `#${orderId}` });
        await expect(claimedRow).toBeVisible({ timeout: 10000 });
        await claimedRow.getByRole('button', { name: 'DELIVERED' }).click();
        await expect(claimedRow).toHaveCount(0, { timeout: 10000 });

        // 6C. Verify order appears in /admin/deliveredOrders with driver payout status updated
        await driverPage.goto('/admin/deliveredOrders');
        const deliveredOrdersRow = driverPage.locator('tr', { hasText: `#${orderId}` });
        await expect(deliveredOrdersRow).toBeVisible({ timeout: 10000 });
        // Verify driver's on-time payout status directly in PostgreSQL 'orders' table
        const payoutCheckDb = new Client({ connectionString: TEST_DB_URL });
        await payoutCheckDb.connect();
        const payoutRes = await payoutCheckDb.query(
            'SELECT status, payout_status, payout_reference_id FROM orders WHERE id = $1',
            [Number(orderId)]
        );
        await payoutCheckDb.end();
        expect(payoutRes.rows[0].status).toBe('Delivered');
        expect(payoutRes.rows[0].payout_status).toBe('Paid');
        expect(payoutRes.rows[0].payout_reference_id).toContain('trf_mock_payout_');

        // ✅ LEDGER CHECK 4: Verify order moves to "4. Historical Audits" ("On Time" bucket)
        await managerPage.goto('/admin/ledger');
        await managerPage
            .locator('div', { hasText: '4. Historical Audits' })
            .getByRole('button', { name: /On Time/i })
            .click();
        const settledLedgerRow = managerPage.locator('tr', { hasText: paddedOrderId });
        await expect(settledLedgerRow).toBeVisible({ timeout: 10000 });
        await expect(settledLedgerRow.getByText(driver.name)).toBeVisible();

        // =========================================================
        // PHASE 7: CUSTOMER FILES REFUND WITH PHOTO EVIDENCE
        // =========================================================
        await customerPage.goto('/orderHistory');
        const historyRow = customerPage.locator('tr', { hasText: `#${orderId}` });
        await expect(historyRow).toBeVisible({ timeout: 10000 });
        await historyRow.getByRole('button', { name: /Request Refund/i }).click();
        await customerPage
            .locator('textarea')
            .fill('Bruised apples found inside crate upon delivery.');

        // Create a valid 1x1 PNG buffer in memory for Multer image upload
        const tinyPngBuffer = Buffer.from(
            'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
            'base64'
        );
        await customerPage.locator('input[type="file"]').setInputFiles({
            name: 'damaged-produce-evidence.png',
            mimeType: 'image/png',
            buffer: tinyPngBuffer,
        });
        customerPage.once('dialog', (dialog) => dialog.accept());
        await customerPage.getByRole('button', { name: /Confirm Submission/i }).click();
        await expect(historyRow.getByText(/Refund Requested/i)).toBeVisible({ timeout: 10000 });

        // =========================================================
        // PHASE 8: MANAGER MASTER LEDGER AUDIT & REFUND APPROVAL
        // =========================================================
        await managerPage.goto('/admin/ledger');
        // Open Dispute Tickets queue
        await managerPage.getByRole('button', { name: /View Dispute Tickets/i }).click();
        const disputeRow = managerPage.locator('tr', { hasText: paddedOrderId });
        await expect(disputeRow).toBeVisible({ timeout: 10000 });
        // Verify grievance text and uploaded evidence photo thumbnail are visible
        await expect(disputeRow.getByText(/Bruised apples found inside crate/i)).toBeVisible();
        await expect(disputeRow.locator('img[alt="Evidence image"]')).toBeVisible();
        // Handle the two sequential prompt() dialogs triggered by handleResolveRefundTicket
        let promptCount = 0;
        managerPage.on('dialog', async (dialog) => {
            promptCount += 1;
            if (promptCount === 1) {
                await dialog.accept('Verified photo evidence. Approving full refund.');
            } else {
                await dialog.accept(''); // Blank = full refund
            }
        });
        await disputeRow.getByRole('button', { name: /Approve/i }).click();
        // Verify ticket status updates to "Approved" and shows "Ticket Settled"
        await expect(disputeRow.getByText('Approved')).toBeVisible({ timeout: 10000 });
        await expect(disputeRow.getByText('Ticket Settled')).toBeVisible();
        // Clean up all 3 browser contexts
        await managerContext.close();
        await driverContext.close();
        await customerContext.close();
    });
});
