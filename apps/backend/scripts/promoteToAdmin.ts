// scripts/promoteAdmin.ts
import 'dotenv/config';
import db from '../src/db/db.ts'; // Adjust this path to your exact db initialization file
import { customers } from '../src/db/schema.ts';
import { eq } from 'drizzle-orm';

async function promoteToAdmin() {
    // ⚠️ REPLACE THIS with your exact Postman test user's email address
    const targetEmail = 'sonu@example.com';

    try {
        console.log(`Searching database for: ${targetEmail}...`);

        const [updatedUser] = await db
            .update(customers)
            .set({
                role: 'admin',
                subRole: 'warehouse',
            })
            .where(eq(customers.email, targetEmail))
            .returning();

        if (!updatedUser) {
            console.error('❌ Error: No customer account matched that email string.');
            return;
        }

        console.log(
            `\n🎉 SUCCESS! ${updatedUser.name} has been promoted to Admin [subRole: ${updatedUser.subRole}]!`
        );
        return;
    } catch (error) {
        console.error('❌ Database alteration failed:', error);
        return;
    }
}

promoteToAdmin();
