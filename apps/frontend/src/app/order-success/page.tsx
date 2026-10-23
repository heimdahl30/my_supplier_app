'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';

export default function OrderSuccessPage() {
    const searchParams = useSearchParams();
    const router = useRouter();

    // 🚀 Extract the custom query parameter (?id=...) passed by your checkout router line!
    const orderId = searchParams.get('id');

    // If a user manually browses here without a real transaction reference, slide them home safely
    if (!orderId) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
                <div className="bg-white p-8 rounded-2xl shadow-sm max-w-md w-full text-center border border-slate-100">
                    <p className="text-slate-600 font-medium">No order context found.</p>
                    <button
                        onClick={() => router.push('/')}
                        className="mt-4 bg-slate-900 text-white px-6 py-2 rounded-xl text-sm font-semibold hover:bg-slate-800 transition"
                    >
                        Return to Storefront
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 antialiased">
            <div className="bg-white p-8 md:p-12 rounded-3xl shadow-sm max-w-xl w-full text-center border border-slate-100">
                {/* 🎉 Animated Success Checkmark Badge */}
                <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-6 border border-emerald-100 animate-bounce">
                    <svg
                        className="w-10 h-10 text-emerald-600"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2.5"
                            d="M5 13l4 4L19 7"
                        />
                    </svg>
                </div>

                <h1 className="text-2xl md:text-3xl font-bold text-slate-900 mb-2">
                    Payment Verified Natively!
                </h1>
                <p className="text-slate-500 text-sm md:text-base max-w-sm mx-auto mb-8">
                    Your grocery essentials have been locked into our database and dispatched
                    straight to our warehouse packing crews.
                </p>

                {/* 📊 Transaction Receipt Info Card */}
                <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100 text-left mb-8 space-y-3">
                    <div className="flex justify-between items-center text-sm">
                        <span className="text-slate-500 font-medium">
                            Junction Order Registry ID
                        </span>
                        <span className="text-slate-900 font-bold family-mono bg-white px-3 py-1 rounded-md border border-slate-200">
                            #{orderId}
                        </span>
                    </div>
                    <div className="flex justify-between items-center text-sm pt-2 border-t border-slate-200">
                        <span className="text-slate-500 font-medium">
                            Estimated Allocation Drop
                        </span>
                        <span className="text-emerald-700 font-semibold bg-emerald-50 px-3 py-1 rounded-md border border-emerald-100">
                            Tomorrow, before 2:00 PM
                        </span>
                    </div>
                </div>

                {/* 🚀 Dynamic Flow Control Lanes */}
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    {/* Primary Call-to-Action: Directs straight to live warehouse logistics trackers */}
                    <Link
                        href={`/orders/${orderId}`}
                        className="bg-slate-900 text-white px-6 py-3 rounded-xl text-sm font-semibold hover:bg-slate-800 transition-colors shadow-sm text-center"
                    >
                        Track Live Logistics Status
                    </Link>

                    <Link
                        href="/"
                        className="bg-white text-slate-700 border border-slate-200 px-6 py-3 rounded-xl text-sm font-semibold hover:bg-slate-50 transition-colors text-center"
                    >
                        Continue Groceries Shopping
                    </Link>
                </div>
            </div>
        </div>
    );
}
