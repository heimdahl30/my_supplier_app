'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';

export default function Navbar() {
    // 🌟 Extract ONLY the user object from your context, since logout isn't defined there
    const { user, isLoading, handleLogout } = useAuth();
    const pathname = usePathname();

    if (isLoading) return null;

    if (pathname.startsWith('/store')) {
        return null;
    }

    // 🎯 FLOW 1: GUEST VIEWPORTS (For screens like /login and /register)
    if (!user || !user.role) {
        return (
            <header className="sticky top-0 z-50 w-full bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between font-sans">
                <div className="flex items-center space-x-3">
                    {/* 🟢 THE STRICT LINK PORTAL: Only wraps the actionable brand trigger! */}
                    <Link
                        href="/store"
                        className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-1.5 hover:text-emerald-600 transition"
                    >
                        <span className="text-emerald-600 text-3xl select-none">🥬</span>
                        <span>Fresh Marketplace</span>
                    </Link>

                    {/* 🟢 THE NEUTRAL SHIELD: Description lives safely outside the anchor tag to stay razor-sharp! */}
                    <div className="border-l border-slate-200 pl-3 hidden sm:block">
                        <p className="text-sm text-slate-500 antialiased font-normal">
                            Premium farm-to-table grocery supply pipeline.
                        </p>
                    </div>
                </div>

                <Link
                    href="/store"
                    className="text-xs font-bold text-slate-500 hover:text-emerald-600 transition flex items-center gap-1 group"
                >
                    <span>Browse Store</span>
                    <span className="transition transform group-hover:translate-x-0.5">→</span>
                </Link>
            </header>
        );
    }

    // 🚚 Trigger banner if they are a driver but missing their banking sub-account key
    const showBankingAlert = user.subRole === 'driver' && !user.razorpaySubAccountId;

    return (
        <header className="sticky top-0 z-50 w-full flex flex-col border-b border-slate-100 bg-white">
            {/* 🚚 1. DRIVER CRITICAL ALERT STRIP */}
            {showBankingAlert && (
                <div className="bg-amber-500 text-white font-medium px-4 py-3 text-center flex items-center justify-center gap-2 animate-pulse text-sm">
                    <span>
                        🚚 <strong>Attention Delivery Partner:</strong> You must configure your
                        payout account setup before you can process order dispatches!
                    </span>
                    <Link
                        href="/admin/payout-setup"
                        className="bg-white text-amber-600 px-3 py-1 rounded-md text-xs font-bold shadow hover:bg-amber-700 hover:text-white transition"
                    >
                        Setup Payout Account
                    </Link>
                </div>
            )}

            {/* 🧭 2. DYNAMIC MAIN NAV BAR */}
            <div className="max-w-7xl w-full mx-auto px-4 h-16 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-1.5 select-none">
                        <span className="text-emerald-600">🥬</span>
                        <span>Fresh Marketplace</span>
                    </div>

                    {/* 👁️ THE UNIVERSAL CROSS-OVER ESCAPE LINK FOR ALL STAFF TYPES */}
                    <Link
                        href="/store"
                        className="text-xs font-bold text-slate-400 hover:text-emerald-600 transition border border-slate-200 px-2.5 py-1 rounded-xl shadow-sm bg-white"
                    >
                        Browse Store
                    </Link>
                </div>

                <div className="flex items-center gap-4">
                    {user && user.subRole === 'driver' ? (
                        <>
                            <Link
                                href="/admin/driverClaims"
                                className={`px-4 py-2 text-xs font-bold tracking-wide uppercase rounded-xl transition active:scale-95 ${
                                    pathname === '/admin/driverClaims'
                                        ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/10'
                                        : 'text-slate-400 hover:text-white hover:bg-slate-700/40'
                                }`}
                            >
                                📦 Active Jobs
                            </Link>
                            <Link
                                href="/admin/packedOrders"
                                className={`px-4 py-2 text-xs font-bold tracking-wide uppercase rounded-xl transition active:scale-95 ${
                                    pathname === '/admin/packedOrders'
                                        ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/10'
                                        : 'text-slate-400 hover:text-white hover:bg-slate-700/40'
                                }`}
                            >
                                📦 Orders Ready for Delivery
                            </Link>
                            <Link
                                href="/admin/deliveredOrders"
                                className={`px-4 py-2 text-xs font-bold tracking-wide uppercase rounded-xl transition active:scale-95 ${
                                    pathname === '/admin/deliveredOrders'
                                        ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/10'
                                        : 'text-slate-400 hover:text-white hover:bg-slate-700/40'
                                }`}
                            >
                                📦 Delivered Orders
                            </Link>{' '}
                        </>
                    ) : user && user.subRole === 'warehouse' ? (
                        <Link
                            href="/admin/ordersReceived"
                            className={`px-4 py-2 text-xs font-bold tracking-wide uppercase rounded-xl transition active:scale-95 ${
                                pathname === '/admin/ordersReceived'
                                    ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/10'
                                    : 'text-slate-400 hover:text-white hover:bg-slate-700/40'
                            }`}
                        >
                            📦 Incoming Orders
                        </Link>
                    ) : null}

                    {/* 🌟 Call our new self-contained logout function here */}
                    <button
                        onClick={handleLogout}
                        className="text-xs font-bold text-red-500 hover:text-red-700 transition"
                    >
                        Logout
                    </button>
                </div>
            </div>
        </header>
    );
}
