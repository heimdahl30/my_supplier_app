import { test, expect } from '@playwright/test';

test.describe('Customer Registration & Real Map E2E Flow', () => {
  test('registers a new customer with real Leaflet map coordinates', async ({ page }) => {
    // Generate a unique email and 10-digit phone number for every test run
    const uniqueTimestamp = Date.now();
    const testEmail = `e2e.customer.${uniqueTimestamp}@example.com`;
    const testPhone = `98${String(uniqueTimestamp).slice(-8)}`;
    const testPassword = 'Password123!';

    // 1. Navigate directly to your registration page
    await page.goto('/register');

    // 2. Wait for the REAL Leaflet map to load
    const leafletMap = page.locator('.leaflet-container');
    await expect(leafletMap).toBeVisible({ timeout: 10000 });

    // 3. Click on the real map canvas to trigger reverse-geocoding
    await leafletMap.click({ position: { x: 180, y: 120 } });

    // 4. Fill out the registration form fields matching your register() names
    await page.locator('input[name="name"]').fill('Abhinav E2E User');
    await page.locator('input[name="phone"]').fill(testPhone);
    await page.locator('input[name="email"]').fill(testEmail);
    await page.locator('input[name="password"]').fill(testPassword);
    await page.locator('input[name="confirmPassword"]').fill(testPassword);

    // 5. Verify the address input is populated
    const addressInput = page.locator('input[name="address"]');
    await expect(addressInput).not.toHaveValue('', { timeout: 10000 });

    // 6. Submit registration and verify redirect to /login
    await page.locator('button[type="submit"]').click();
    await page.waitForURL('**/login', { timeout: 10000 });
    expect(page.url()).toContain('/login');
  });
});
