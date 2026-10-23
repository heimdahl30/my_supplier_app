'use client';

import React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';

export default function AdminDashboardLayout({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const pathname = usePathname();
    const { user } = useAuth(); // Extracted safely from your global vault

    // Quick logout action handler to return to the public storefront safely
    const handleAdminExit = () => {
        // Here you can clear session contexts if needed
        router.push('/store');
    };

    return (
        <div className="min-h-screen bg-slate-900 flex flex-col">
            {/* ─────────────── 🏗️ THE FIXED ADMIN TOP NAVIGATION HEADER BAR ─────────────── */}
            <header className="sticky top-16 w-full bg-slate-800 border-b border-slate-700/60 px-8 py-4 shadow-xl z-50">
                <div className="max-w-7xl mx-auto flex items-center justify-between">
                    {/* Left Side: Brand Workspace Title Identity */}
                    <div className="flex items-center space-x-3">
                        <span className="text-2xl bg-amber-500/10 p-2 rounded-xl text-amber-500 border border-amber-500/20">
                            🛡️
                        </span>
                        <div>
                            <h2 className="text-base font-black tracking-tight text-white">
                                Master Ledger
                            </h2>
                            <p className="text-[11px] font-medium text-slate-400 mt-0.5">
                                Authorized personnel:{' '}
                                <span className="text-amber-400 font-bold">{user?.name}</span>
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center space-x-6">
                        {/* Middle: Active Segment Path Switching Link Tabs */}
                        <nav className="hidden sm:flex items-center space-x-1">
                            <button
                                onClick={() => router.push('/admin/add-product')}
                                className={`px-4 py-2 text-xs font-bold tracking-wide uppercase rounded-xl transition active:scale-95 ${
                                    pathname === '/admin/addProduct'
                                        ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/10'
                                        : 'text-slate-400 hover:text-white hover:bg-slate-700/40'
                                }`}
                            >
                                📦 Add Stock
                            </button>

                            <button
                                onClick={() => router.push('/admin/ledger')}
                                className={`px-4 py-2 text-xs font-bold tracking-wide uppercase rounded-xl transition text-slate-400 hover:bg-emerald-800 ${pathname === '/admin/ledger' ? 'bg-emerald-600 text-white' : ''}`}
                            >
                                📊 Financial Ledger
                            </button>
                        </nav>

                        {/* Right Side: Secure System Exit Portal Escape Button */}
                        <button
                            onClick={handleAdminExit}
                            className="border border-slate-700 hover:border-red-500/30 hover:bg-red-500/10 text-slate-400 hover:text-red-400 px-4 py-2 rounded-xl text-xs font-bold tracking-wide uppercase transition active:scale-95"
                        >
                            Exit Portal 🚪
                        </button>
                    </div>
                </div>
            </header>

            {/* ─────────────── 📦 ACTIVE SUB-PAGE ELEMENT PANEL VIEWS ─────────────── */}
            <main className="flex-1 w-full">
                {children}{' '}
                {/* This is where your AdminAddProductPage component automatically renders! */}
            </main>
        </div>
    );
}
