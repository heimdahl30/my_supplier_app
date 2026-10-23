import { redirect } from 'next/navigation';

export default function RootLandingPage() {
    // 🚀 AUTOMATED ROUTING ENGINE:
    // The millisecond a human hits the base URL, slide them straight to your storefront!
    redirect('/store');
}
