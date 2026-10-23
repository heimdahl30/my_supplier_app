'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import api from '@/services/api';

interface CustomerAddresses {
    id: number;
    customerId: number;
    label: string;
    fullName: string;
    phone: string;
    addressLine: string;
    latitude: number;
    longitude: number;
    isDefault: boolean;
}

// --- TypeScript Contracts ---
interface JoinedCustomer {
    id: number;
    name: string;
    phone: string;
    addresses: CustomerAddresses[];
}

interface MasterOrder {
    id: number;
    totalPrice: string;
    deliveryNotes: string | null;
    status: string;
    orderDate: string;
    packedAt: string | null;
    claimedAt: string | null;
    deliveredAt: string | null;
    deliveryAddressLine: string | null;
    customer: JoinedCustomer;
    deliveryPartner?: JoinedCustomer;
    efficiencyMinutes?: number;
    wasDeliveredOnTime?: boolean;
    refundStatus: string;
    refundRequestedAt: string | null;
    refundApprovedAt: string | null;
    refundRejectedAt: string | null;
    refundedAmount: string;
    refundReason: string | null;
    refundEvidenceUrls: string[];
}

interface ServerPayload {
    grossPipelineValue: number;
    packingMetrics: { total: number; normal: number; critical: number };
    shelfMetrics: { total: number; normal: number; critical: number };
    transitMetrics: { total: number; normal: number; critical: number };
    deliveryMetrics: { total: number; normal: number; critical: number };

    pendingRefundCount: number;

    // Arrays packed fresh off the backend query compiler [I13]
    packingOrders: MasterOrder[];
    criticalPackingOrders: MasterOrder[];
    shelfOrders: MasterOrder[];
    criticalShelfOrders: MasterOrder[];
    transitOrders: MasterOrder[];
    criticalTransitOrders: MasterOrder[];
    deliveredOrders: MasterOrder[];
    criticalDeliveredOrders: MasterOrder[];
}

export default function ManagerLedgerCockpit() {
    const router = useRouter();
    const { user, isAuthenticated, isLoading } = useAuth();

    // 🎯 THE MASTER CONTROLLER: Keeps track of exactly which metric card is active!
    const [activeTab, setActiveTab] = useState<string>('packing-all');
    const [filterRange, setFilterRange] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState<string>('');

    const [payload, setPayload] = useState<ServerPayload | null>(null);
    const [isNetworkLoading, setIsNetworkLoading] = useState(true);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    const [isResolvingId, setIsResolvingId] = useState<number | null>(null);

    const [currentPage, setCurrentPage] = useState<number>(1);
    const itemsPerPage = 10; // Hard ceiling to keep rendering speeds maximum [I13]

    useEffect(() => {
        if (!isLoading) {
            if (!isAuthenticated || !user || user.subRole !== 'manager') {
                router.push('/store');
                return;
            }

            async function fetchMasterLedger() {
                try {
                    const res = await fetch(
                        'http://localhost:5000/api/v1/admin/orders/ledger-master',
                        {
                            method: 'GET',
                            credentials: 'include',
                        }
                    );
                    const data = await res.json();
                    if (!res.ok) throw new Error(data.error || 'Fetch failure.');
                    setPayload(data);
                } catch (err) {
                    if (err instanceof Error) {
                        setErrorMsg(err.message);
                    } else {
                        setErrorMsg('Unknown error occurred while fetching ledger data.');
                    }
                } finally {
                    setIsNetworkLoading(false);
                }
            }
            fetchMasterLedger();
        }
    }, [isLoading, isAuthenticated, user, router]);

    if (isLoading || isNetworkLoading || !payload) {
        return (
            <div className="flex min-h-screen flex-col items-center justify-center bg-slate-900 text-white">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-amber-500 border-t-transparent"></div>
                <p className="mt-4 text-xs font-mono uppercase tracking-widest animate-pulse text-slate-400">
                    Syncing Matrix Command Center...
                </p>
            </div>
        );
    }
    // 🧮 EXTRAORDINARILY FAST FRONTEND ARRAY ROUTER POINTERS
    const getActiveGridData = (): {
        list: MasterOrder[];
        type: 'packing' | 'shelf' | 'transit' | 'delivered' | 'billing';
    } => {
        switch (activeTab) {
            case 'packing-all':
                return { list: payload.packingOrders, type: 'packing' };
            case 'packing-normal':
                return {
                    list: payload.packingOrders.filter(
                        (o) => !payload.criticalPackingOrders.some((c) => c.id === o.id)
                    ),
                    type: 'packing',
                };
            case 'packing-critical':
                return { list: payload.criticalPackingOrders, type: 'packing' };

            case 'shelf-all':
                return { list: payload.shelfOrders, type: 'shelf' };
            case 'shelf-normal':
                return {
                    list: payload.shelfOrders.filter(
                        (o) => !payload.criticalShelfOrders.some((c) => c.id === o.id)
                    ),
                    type: 'shelf',
                };
            case 'shelf-critical':
                return { list: payload.criticalShelfOrders, type: 'shelf' };

            case 'transit-all':
                return { list: payload.transitOrders, type: 'transit' };
            case 'transit-normal':
                return {
                    list: payload.transitOrders.filter(
                        (o) => !payload.criticalTransitOrders.some((c) => c.id === o.id)
                    ),
                    type: 'transit',
                };
            case 'transit-critical':
                return { list: payload.criticalTransitOrders, type: 'transit' };

            case 'delivered-all':
                return { list: payload.deliveredOrders, type: 'delivered' };
            case 'delivered-normal':
                return {
                    list: payload.deliveredOrders.filter((o) => o.wasDeliveredOnTime === true),
                    type: 'delivered',
                };
            case 'delivered-critical':
                return { list: payload.criticalDeliveredOrders, type: 'delivered' };
            case 'billing-tickets':
                return {
                    list: payload.deliveredOrders.filter(
                        (o) =>
                            o.refundStatus === 'Requested' ||
                            o.refundStatus === 'Approved' ||
                            o.refundStatus === 'Rejected'
                    ),
                    type: 'billing',
                };

            default:
                return { list: payload.packingOrders, type: 'packing' };
        }
    };

    const { list: displayedRows, type: currentTableLayout } = getActiveGridData();

    console.log('Displayed Rows:', displayedRows);

    // 🟢 CLEAN, OPTIMIZED FEWER-LINES WRITE:
    const timeFilteredOrders = displayedRows.filter((order) => {
        const orderTime = new Date(order.orderDate).getTime();
        const nowTime = new Date().getTime();
        const hoursElapsed = (nowTime - orderTime) / (1000 * 60 * 60);

        if (filterRange === 'today') return hoursElapsed <= 24;
        if (filterRange === '7d') return hoursElapsed <= 24 * 7;
        if (filterRange === '30d') return hoursElapsed <= 24 * 30;
        if (filterRange === '1y') return hoursElapsed <= 24 * 365;

        // 🛡️ NATURAL FALLBACK: If filterRange is 'all', it skips every single 'if'
        // block above and safely drops down here to keep the row!
        return true;
    });

    // 🧮 STEP 3: APPLY LIVE KEYWORD TEXT SEARCH FILTERING CRITERIA
    const searchedRows = timeFilteredOrders.filter((order) => {
        const query = searchQuery.toLowerCase().trim();
        if (!query) return true;

        // 🚀 STEP 1: Core Padded String Formats
        const rawIdStr = order.id.toString(); // "7"
        const paddedIdStr = rawIdStr.padStart(4, '0'); // "0007"
        const visualIdStr = `#${paddedIdStr}`; // "#0007"

        // 🚀 STEP 2: Safe String Fallbacks (Prevents short-circuit corruption!)
        const customerName = (order.customer?.name || '').toLowerCase();
        const customerPhone = order.customer?.phone || '';
        const partnerName = (order.deliveryPartner?.name || '').toLowerCase();

        return (
            rawIdStr.includes(query) || // ✅ Safely catches pure inputs like "7"
            paddedIdStr.includes(query) || // ✅ Safely catches partial zero matches like "000" or "0007"
            visualIdStr.includes(query) ||
            customerName.includes(query) ||
            customerPhone.includes(query) ||
            partnerName.includes(query)
        );
    });

    const totalItemsCount = searchedRows.length;
    const totalPagesCount = Math.ceil(totalItemsCount / itemsPerPage);
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;

    // Slice the correctly searched rows array right inside browser memory tracks
    const paginatedRows = searchedRows.slice(indexOfFirstItem, indexOfLastItem);

    console.log('Paginated Rows:', paginatedRows);

    // 🧮 STEP 4: AGGREGATE TOTAL LIVE NET VALUE GENERATED ACROSS FILTERED DATA ENTRIES
    const grossPipelineValue = searchedRows.reduce((acc, curr) => {
        const total = parseFloat(curr.totalPrice);
        const refunded = parseFloat(curr.refundedAmount || '0.00');
        return acc + (total - refunded);
    }, 0);

    const formatClock = (isoString: string | null) => {
        if (!isoString) return '—';

        try {
            // 🚀 THE TIMESHIFT SHIELD: If the string ends with 'Z', strip it off
            // to force the browser to parse it directly in the local user's timezone context!
            const cleanIsoString = isoString.endsWith('Z') ? isoString.slice(0, -1) : isoString;

            const dateInstance = new Date(cleanIsoString);

            return dateInstance.toLocaleTimeString('en-IN', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                hour12: true, // 🟢 Changes 18:44 into a clean, human-readable "06:44 PM" layout!
            });
        } catch (error) {
            console.error('Clock formatting failure:', error);
            return '—';
        }
    };

    // 📁 Add this function inside your component body block:
    const handleResolveRefundTicket = async (
        orderId: number,
        action: 'APPROVED' | 'REJECT',
        totalPrice: string
    ) => {
        // 1. Gather manager feedback logging strings
        const managerRemarks = prompt(
            `Reviewing Order #000${orderId} (Total Value: ₹${totalPrice})\n\n` +
                `Enter administrative audit notes for this ${action.toLowerCase()} decision:`
        );

        // Exit silently if the manager cancels out of the prompt window
        if (managerRemarks === null) return;

        const payloadBody: { action: string; managerRemarks: string; amount?: string } = {
            action,
            managerRemarks:
                managerRemarks.trim() !== '' ? managerRemarks.trim() : `Authorized by admin user.`,
        };

        // 💸 If it's an approval, check if they want to do a partial or complete refund [I13]
        if (action === 'APPROVED') {
            const amountInput = prompt(
                `Leave blank and click OK to refund the full balance (₹${totalPrice}).\n` +
                    `Or type a specific partial numerical amount (e.g., 150.00):`
            );
            if (amountInput === null) return; // Exit if cancelled
            if (amountInput.trim() !== '') {
                const parsedAmount = parseFloat(amountInput);
                if (isNaN(parsedAmount) || parsedAmount <= 0) {
                    alert('Validation Error: Enter a valid positive numerical amount.');
                    return;
                }
                payloadBody.amount = parsedAmount.toFixed(2);
            }
        }

        setIsResolvingId(orderId);
        try {
            const response = await api.post(`/admin/orders/${orderId}/refund-resolve`, payloadBody);

            const data = response.data; // Backend returns: { message: "...", updatedOrder: { ... } }

            // 🌟 THE STATE CHANGE MUTATION: Update memory variables directly with ZERO page flicker!
            setPayload((prevPayload) => {
                if (!prevPayload) return null;

                // Map over your historical delivered orders pool right inside browser RAM [I20]
                const updatedDeliveredOrders = prevPayload.deliveredOrders.map((order) => {
                    if (order.id === orderId) {
                        // Fuses your existing row with the freshly stamped columns returned from Express!
                        return {
                            ...order,
                            ...data.updatedOrder,
                        };
                    }
                    return order; // Leave healthy rows completely untouched
                });

                // Return a fresh new payload state object container to React's core scheduler loop [I20]
                return {
                    ...prevPayload,
                    deliveredOrders: updatedDeliveredOrders,
                };
            });

            // Soft notice banner replacement instead of destructive alert window loops
            console.log(`Audit resolved successfully for record #000${orderId}`);
        } catch (err) {
            if (err instanceof Error) {
                alert(`Audit Lane Exception: ${err.message}`);
            } else {
                alert(`Something went wrong`);
            }
        } finally {
            setIsResolvingId(null);
        }
    };

    return (
        <div className="min-h-screen bg-slate-900 text-white p-8">
            <div className="max-w-7xl mx-auto space-y-10">
                {/* HEADLINE BLOCK */}
                <div className="md:flex md:items-center md:justify-between border-b border-slate-800 pb-6 min-w-0 flex-1">
                    <div>
                        <h1 className="text-3xl font-black tracking-tight">
                            Logistics Command Center
                        </h1>
                        <p className="mt-1 text-sm text-slate-400">
                            Omniscient multi-role exceptions management ledger cockpit.
                        </p>
                    </div>

                    {/* 🚨 THE MASTER COCKPIT UNRESOLVED REFUNDS ALARM BAR */}
                    {payload.pendingRefundCount > 0 && (
                        <div className="p-4 rounded-xl border border-red-500/30 bg-red-500/10 text-xs font-black tracking-wider text-red-400 uppercase sm:flex sm:items-center sm:justify-between animate-pulse">
                            <div className="flex items-center gap-2">
                                <span>💸 SYSTEM ALERT:</span>
                                <span className="text-white font-normal normal-case font-sans">
                                    There are currently{' '}
                                    <span className="font-bold text-red-400 font-mono">
                                        {payload.pendingRefundCount}
                                    </span>{' '}
                                    unresolved client refund tickets awaiting audit resolution.
                                </span>
                            </div>
                            <button
                                onClick={() => {
                                    setActiveTab('billing-tickets'); // 🌟 SNAPS INSTANTLY TO YOUR NEW DEDICATED BILLING VIEW!
                                    setSearchQuery('');
                                }}
                                className="mt-2 sm:mt-0 px-3 py-1 bg-red-500 text-white rounded-lg text-[10px] font-black tracking-widest hover:bg-red-600 transition"
                            >
                                Inspect Queue →
                            </button>
                        </div>
                    )}

                    {/* TIME-SERIES CHANNELS FILTER CONTROLLERS ROW */}
                    <div className="mt-4 flex flex-wrap gap-1.5 sm:mt-0">
                        {['today', '7d', '30d', '1y', 'all'].map((range) => (
                            <button
                                key={range}
                                onClick={() => setFilterRange(range)}
                                className={`rounded-lg px-2.5 py-1.5 text-xs font-black uppercase tracking-wider transition ${
                                    filterRange === range
                                        ? 'bg-amber-500 text-slate-950 shadow-md font-bold'
                                        : 'bg-slate-800 text-slate-400 hover:text-white'
                                }`}
                            >
                                {range}
                            </button>
                        ))}
                    </div>
                </div>
                {errorMsg && (
                    <div className="p-4 rounded-xl border border-red-500/20 bg-red-500/10 text-xs font-semibold font-sans text-red-400 text-center animate-pulse tracking-wide">
                        ⚠️ NETWORK LINK BROKEN: {errorMsg}
                    </div>
                )}
                {/* 📊 DYNAMIC LIVE VALUE HIGHLIGHT METERS ROW */}
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
                    <div className="rounded-2xl border border-slate-800 bg-slate-800/40 p-5 shadow-xl">
                        <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                            Selected Segment Cash Value
                        </p>
                        <p className="mt-2 text-3xl font-black text-emerald-400 tracking-tight">
                            ₹
                            {grossPipelineValue.toLocaleString('en-IN', {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                            })}
                        </p>
                        <p className="mt-1 text-[11px] text-slate-400 font-medium">
                            Aggregated valuation of current list rows in view
                        </p>
                    </div>
                    <div className="rounded-2xl border border-slate-800 bg-slate-800/40 p-5 shadow-xl">
                        <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                            Active Supply Queues
                        </p>
                        <p className="mt-2 text-3xl font-black text-amber-400 tracking-tight">
                            {payload.packingMetrics.total +
                                payload.shelfMetrics.total +
                                payload.transitMetrics.total}
                        </p>
                        <p className="mt-1 text-[11px] text-slate-400 font-medium">
                            Unfinished jobs currently traversing fulfillment channels
                        </p>
                    </div>
                    <div className="rounded-2xl border border-slate-800 bg-slate-800/40 p-5 shadow-xl">
                        <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                            Gross Lifetime Pool Size
                        </p>
                        <p className="mt-2 text-3xl font-black text-white tracking-tight">
                            {payload.packingMetrics.total +
                                payload.shelfMetrics.total +
                                payload.transitMetrics.total +
                                payload.deliveryMetrics.total}
                        </p>
                        <p className="mt-1 text-[11px] text-slate-400 font-medium">
                            Total structural rows registered inside PostgreSQL logs
                        </p>
                    </div>
                </div>
                {/* 🏷️ THE 4-PILLAR ANALYTICAL METRIC MATRIX CARDS ROW */}
                <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
                    {/* PILLAR 1: WAREHOUSE PACKING MATRIX */}
                    <div className="bg-slate-800/30 border border-slate-800 rounded-2xl p-4 space-y-3">
                        <p className="text-[11px] font-black uppercase tracking-wider text-slate-500">
                            1. Packing Channels
                        </p>
                        <div className="grid grid-cols-3 gap-2">
                            <button
                                onClick={() => {
                                    setActiveTab('packing-all');
                                    setCurrentPage(1);
                                }}
                                className={`p-2 rounded-xl border text-center transition ${activeTab === 'packing-all' ? 'bg-slate-100 text-slate-950 border-white' : 'border-slate-800 hover:border-slate-700 bg-slate-900/40'}`}
                            >
                                <span className="block text-lg font-black">
                                    {payload.packingMetrics.total}
                                </span>
                                <span className="text-[9px] text-slate-400 font-bold uppercase">
                                    Total
                                </span>
                            </button>
                            <button
                                onClick={() => {
                                    setActiveTab('packing-normal');
                                    setCurrentPage(1);
                                }}
                                className={`p-2 rounded-xl border text-center transition ${activeTab === 'packing-normal' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40' : 'border-slate-800 hover:border-slate-700 bg-slate-900/40'}`}
                            >
                                <span className="block text-lg font-black">
                                    {payload.packingMetrics.total - payload.packingMetrics.critical}
                                </span>
                                <span className="text-[9px] text-emerald-500 font-bold uppercase">
                                    Normal
                                </span>
                            </button>
                            <button
                                onClick={() => {
                                    setActiveTab('packing-critical');
                                    setCurrentPage(1);
                                }}
                                className={`p-2 rounded-xl border text-center transition ${activeTab === 'packing-critical' ? 'bg-red-500/20 text-red-400 border-red-500/40 animate-pulse' : 'border-slate-800 hover:border-slate-700 bg-slate-900/40'}`}
                            >
                                <span className="block text-lg font-black text-red-400">
                                    {payload.packingMetrics.critical}
                                </span>
                                <span className="text-[9px] text-red-500 font-bold uppercase">
                                    🚨 Delay
                                </span>
                            </button>
                        </div>
                    </div>

                    {/* PILLAR 2: WAREHOUSE UNCLAIMED SHELF MATRIX */}
                    <div className="bg-slate-800/30 border border-slate-800 rounded-2xl p-4 space-y-3">
                        <p className="text-[11px] font-black uppercase tracking-wider text-slate-500">
                            2. Shelf Staging
                        </p>
                        <div className="grid grid-cols-3 gap-2">
                            <button
                                onClick={() => {
                                    setActiveTab('shelf-all');
                                    setCurrentPage(1);
                                }}
                                className={`p-2 rounded-xl border text-center transition ${activeTab === 'shelf-all' ? 'bg-slate-100 text-slate-950 border-white' : 'border-slate-800 hover:border-slate-700 bg-slate-900/40'}`}
                            >
                                <span className="block text-lg font-black">
                                    {payload.shelfMetrics.total}
                                </span>
                                <span className="text-[9px] text-slate-400 font-bold uppercase">
                                    Total
                                </span>
                            </button>
                            <button
                                onClick={() => {
                                    setActiveTab('shelf-normal');
                                    setCurrentPage(1);
                                }}
                                className={`p-2 rounded-xl border text-center transition ${activeTab === 'shelf-normal' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40' : 'border-slate-800 hover:border-slate-700 bg-slate-900/40'}`}
                            >
                                <span className="block text-lg font-black">
                                    {payload.shelfMetrics.total - payload.shelfMetrics.critical}
                                </span>
                                <span className="text-[9px] text-emerald-500 font-bold uppercase">
                                    Normal
                                </span>
                            </button>
                            <button
                                onClick={() => {
                                    setActiveTab('shelf-critical');
                                    setCurrentPage(1);
                                }}
                                className={`p-2 rounded-xl border text-center transition ${
                                    activeTab === 'shelf-critical'
                                        ? 'bg-red-500/20 text-red-400 border-red-500/40'
                                        : 'border-slate-800 hover:border-slate-700 bg-slate-900/40'
                                }`}
                            >
                                <span className="block text-lg font-black text-red-400">
                                    {payload.shelfMetrics.critical}
                                </span>
                                <span className="text-[9px] text-red-500 font-bold uppercase">
                                    🚨 Stale
                                </span>
                            </button>
                        </div>
                    </div>

                    {/* 📊 PILLAR 3: TRANSIT ROAD FLEET MATRIX CARD */}
                    <div className="bg-slate-800/30 border border-slate-800 rounded-2xl p-4 space-y-3">
                        <p className="text-[11px] font-black uppercase tracking-wider text-slate-500">
                            3. Road Transit Fleet
                        </p>
                        <div className="grid grid-cols-3 gap-2">
                            <button
                                onClick={() => {
                                    setActiveTab('transit-all');
                                    setCurrentPage(1);
                                }}
                                className={`p-2 rounded-xl border text-center transition ${
                                    activeTab === 'transit-all'
                                        ? 'bg-slate-100 text-slate-950 border-white'
                                        : 'border-slate-800 hover:border-slate-700 bg-slate-900/40'
                                }`}
                            >
                                <span className="block text-lg font-black">
                                    {payload.transitMetrics.total}
                                </span>
                                <span className="text-[9px] text-slate-400 font-bold uppercase">
                                    Total
                                </span>
                            </button>
                            <button
                                onClick={() => {
                                    setActiveTab('transit-normal');
                                    setCurrentPage(1);
                                }}
                                className={`p-2 rounded-xl border text-center transition ${
                                    activeTab === 'transit-normal'
                                        ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                                        : 'border-slate-800 hover:border-slate-700 bg-slate-900/40'
                                }`}
                            >
                                <span className="block text-lg font-black">
                                    {payload.transitMetrics.total - payload.transitMetrics.critical}
                                </span>
                                <span className="text-[9px] text-emerald-500 font-bold uppercase">
                                    Moving
                                </span>
                            </button>
                            <button
                                onClick={() => {
                                    setActiveTab('transit-critical');
                                    setCurrentPage(1);
                                }}
                                className={`p-2 rounded-xl border text-center transition ${
                                    activeTab === 'transit-critical'
                                        ? 'bg-red-500/20 text-red-400 border-red-500/40 animate-pulse'
                                        : 'border-slate-800 hover:border-slate-700 bg-slate-900/40'
                                }`}
                            >
                                <span className="block text-lg font-black text-red-400">
                                    {payload.transitMetrics.critical}
                                </span>
                                <span className="text-[9px] text-red-500 font-bold uppercase">
                                    🚨 Stalled
                                </span>
                            </button>
                        </div>
                    </div>

                    {/* 📊 PILLAR 4: HISTORICAL AUDIT COMPLETIONS MATRIX CARD */}
                    <div className="bg-slate-800/30 border border-slate-800 rounded-2xl p-4 space-y-3">
                        <p className="text-[11px] font-black uppercase tracking-wider text-slate-500">
                            4. Historical Audits
                        </p>
                        <div className="grid grid-cols-3 gap-2">
                            <button
                                onClick={() => {
                                    setActiveTab('delivered-all');
                                    setCurrentPage(1);
                                }}
                                className={`p-2 rounded-xl border text-center transition ${
                                    activeTab === 'delivered-all'
                                        ? 'bg-slate-100 text-slate-950 border-white'
                                        : 'border-slate-800 hover:border-slate-700 bg-slate-900/40'
                                }`}
                            >
                                <span className="block text-lg font-black">
                                    {payload.deliveryMetrics.total}
                                </span>
                                <span className="text-[9px] text-slate-400 font-bold uppercase">
                                    Settled
                                </span>
                            </button>
                            <button
                                onClick={() => {
                                    setActiveTab('delivered-normal');
                                    setCurrentPage(1);
                                }}
                                className={`p-2 rounded-xl border text-center transition ${
                                    activeTab === 'delivered-normal'
                                        ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                                        : 'border-slate-800 hover:border-slate-700 bg-slate-900/40'
                                }`}
                            >
                                <span className="block text-lg font-black">
                                    {payload.deliveryMetrics.total -
                                        payload.deliveryMetrics.critical}
                                </span>
                                <span className="text-[9px] text-emerald-500 font-bold uppercase">
                                    On Time
                                </span>
                            </button>
                            <button
                                onClick={() => {
                                    setActiveTab('delivered-critical');
                                    setCurrentPage(1);
                                }}
                                className={`p-2 rounded-xl border text-center transition ${
                                    activeTab === 'delivered-critical'
                                        ? 'bg-red-500/20 text-red-400 border-red-500/40'
                                        : 'border-slate-800 hover:border-slate-700 bg-slate-900/40'
                                }`}
                            >
                                <span className="block text-lg font-black text-red-400">
                                    {payload.deliveryMetrics.critical}
                                </span>
                                <span className="text-[9px] text-red-500 font-bold uppercase">
                                    ⚠️ Breach
                                </span>
                            </button>
                        </div>
                        {/* 🚀 INSERTED HERE: THE DEDICATED BILLING TICKETS CONTROL STRIP */}
                        <button
                            onClick={() => {
                                setActiveTab('billing-tickets');
                                setCurrentPage(1);
                            }}
                            className={`w-full mt-2 p-2 rounded-xl border text-center transition flex items-center justify-between px-3 ${
                                activeTab === 'billing-tickets'
                                    ? 'bg-red-600 text-white border-red-500 shadow-lg shadow-red-900/30'
                                    : 'border-slate-800 hover:border-slate-700 bg-slate-950/40 text-slate-400 hover:text-slate-300'
                            }`}
                        >
                            <span className="text-[10px] font-black uppercase tracking-wider">
                                💸 View Dispute Tickets
                            </span>
                            {payload.pendingRefundCount > 0 && (
                                <span className="bg-white text-red-600 px-1.5 py-0.5 text-[9px] font-black rounded-md animate-pulse">
                                    {payload.pendingRefundCount} NEW
                                </span>
                            )}
                        </button>
                    </div>
                </div>{' '}
                {/* End of Cards Grid wrapper row */}
                {/* 📋 THE DYNAMIC DOCK DATA SHEET TABLE CONTAINER CARD */}
                <div className="rounded-2xl border border-slate-800 bg-slate-800/10 p-6 shadow-2xl space-y-4 mt-10">
                    <div className="sm:flex sm:items-center sm:justify-between gap-4">
                        <h3 className="text-xs font-black uppercase tracking-widest text-amber-400 min-w-0 flex-1">
                            Live Inspector Segment:{' '}
                            <span className="text-white font-mono lowercase font-normal bg-slate-800 px-2 py-0.5 rounded ml-1">
                                {activeTab.replace('-', ' ')} ({searchedRows.length})
                            </span>
                        </h3>

                        {/* 🌟 LIVE DATA KEYWORD TEXT SEARCH FILTERS BAR INPUT BOX */}
                        <div className="mt-2 sm:mt-0 max-w-xs w-full">
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => {
                                    setSearchQuery(e.target.value);
                                    setCurrentPage(1);
                                }}
                                placeholder="Search Client, ID, or Crew..."
                                className="w-full bg-slate-900 text-xs text-white border border-slate-800 rounded-xl px-3 py-2 placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors"
                            />
                        </div>
                    </div>
                    <div className="overflow-x-auto border border-slate-800 rounded-xl bg-slate-900/30">
                        <table className="w-full text-left border-collapse text-sm">
                            <thead>
                                <tr className="border-b border-slate-800 text-[11px] font-black uppercase text-slate-400 bg-slate-900/60">
                                    <th className="p-4">Order ID</th>
                                    <th className="p-4">Client Buyer</th>
                                    {currentTableLayout === 'billing' ? (
                                        <>
                                            <th className="p-4">Refund Ticket Status</th>
                                            <th className="p-4">Dispute Reason / Audits</th>
                                            <th className="p-4">Financial Lifecycle Logs</th>
                                        </>
                                    ) : (
                                        <>
                                            <th className="p-4">Fulfillment Address</th>
                                            {currentTableLayout === 'packing' && (
                                                <th className="p-4">Received Time</th>
                                            )}
                                            {currentTableLayout === 'shelf' && (
                                                <th className="p-4">Packed Ready At</th>
                                            )}
                                            {currentTableLayout === 'transit' && (
                                                <>
                                                    <th className="p-4">Active Driver</th>
                                                    <th className="p-4">Dispatched At</th>
                                                </>
                                            )}
                                            {currentTableLayout === 'delivered' && (
                                                <>
                                                    <th className="p-4">Dropped Off By</th>
                                                    <th className="p-4">Transit Performance</th>
                                                </>
                                            )}
                                        </>
                                    )}
                                    {/* 🟢 FIXED: The actions header track now strictly filters to post-fulfillment views only! */}
                                    {(currentTableLayout === 'delivered' ||
                                        currentTableLayout === 'billing') && (
                                        <th className="p-4 text-center">
                                            Fulfillment Core Actions Lanes
                                        </th>
                                    )}
                                    <th className="p-4 text-right">Invoice Value</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/60 text-sm text-slate-300">
                                {paginatedRows.length === 0 ? (
                                    <tr>
                                        <td
                                            colSpan={
                                                currentTableLayout === 'transit' ||
                                                currentTableLayout === 'delivered' ||
                                                currentTableLayout === 'billing'
                                                    ? 6
                                                    : 5
                                            }
                                            className="p-12 text-center text-slate-500 italic font-medium"
                                        >
                                            No active logistics rows currently matching this chosen
                                            visual grid channel.
                                        </td>
                                    </tr>
                                ) : (
                                    paginatedRows.map((order) => (
                                        <tr
                                            key={order.id}
                                            className="hover:bg-slate-800/30 transition-colors"
                                        >
                                            <td className="p-4 font-mono font-bold text-xs text-slate-200">
                                                #000{order.id}
                                            </td>
                                            <td className="p-4">
                                                <div className="font-bold text-white text-xs">
                                                    {order.customer?.name || '—'}
                                                </div>
                                                <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                                                    {order.customer?.phone || '—'}
                                                </div>
                                            </td>
                                            {currentTableLayout === 'billing' ? (
                                                <>
                                                    {/* 1. STATUS BADGE CORES */}
                                                    <td className="p-4">
                                                        <span
                                                            className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider border ${
                                                                order.refundStatus === 'Approved'
                                                                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                                                    : order.refundStatus ===
                                                                        'Rejected'
                                                                      ? 'bg-red-500/10 text-red-400 border-red-500/20'
                                                                      : 'bg-amber-500/10 text-amber-400 border-amber-500/20 animate-pulse'
                                                            }`}
                                                        >
                                                            {order.refundStatus || 'No Refund'}
                                                        </span>
                                                    </td>

                                                    {/* 2. REMARKS NOTES TEXT LAYER */}
                                                    <td
                                                        className="p-4 max-w-xs truncate text-xs text-slate-400"
                                                        title={order.refundReason || ''}
                                                    >
                                                        {order.refundReason || (
                                                            <span className="text-slate-600 italic">
                                                                No notes logged.
                                                            </span>
                                                        )}
                                                        {/* 📸 EVIDENCE MINI-THUMBNAIL DOCK: Maps images directly to this Order ID! */}
                                                        {order.refundEvidenceUrls &&
                                                        order.refundEvidenceUrls.length > 0 ? (
                                                            <div className="flex gap-2 mt-2">
                                                                {order.refundEvidenceUrls.map(
                                                                    (
                                                                        imageUrl: string,
                                                                        idx: number
                                                                    ) => (
                                                                        <a
                                                                            key={idx}
                                                                            href={`http://localhost:5000${imageUrl}`}
                                                                            target="_blank"
                                                                            rel="noopener noreferrer"
                                                                            className="w-10 h-10 rounded-xl border border-slate-800 bg-slate-950 overflow-hidden hover:border-amber-500 transition-colors flex items-center justify-center group flex-shrink-0 cursor-pointer relative"
                                                                        >
                                                                            <div className="absolute inset-0 flex items-center justify-center text-slate-700 text-xs font-sans font-bold select-none group-hover:text-slate-500 transition-colors">
                                                                                🖼️
                                                                            </div>
                                                                            <Image
                                                                                src={`http://localhost:5000${imageUrl}`}
                                                                                alt="Evidence image"
                                                                                fill // ✅ Tells Next.js to fill up the parent 10x10 anchor button container automatically
                                                                                sizes="40px" // Tells the engine the explicit width scaling bounds to compress network payloads
                                                                                unoptimized
                                                                                className="object-cover group-hover:scale-105 transition duration-300 relative z-10"
                                                                            />
                                                                        </a>
                                                                    )
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <span className="text-[10px] text-slate-600 font-medium italic block mt-1">
                                                                No images uploaded.
                                                            </span>
                                                        )}
                                                    </td>

                                                    {/* 3. CHRONOLOGICAL DATA TIMESTAMPS TRACK */}
                                                    <td className="p-4 font-mono text-[10px] text-slate-400 space-y-0.5">
                                                        <div>
                                                            📥 Req:{' '}
                                                            {order.refundRequestedAt
                                                                ? formatClock(
                                                                      order.refundRequestedAt
                                                                  )
                                                                : '—'}
                                                        </div>
                                                        {order.refundApprovedAt && (
                                                            <div className="text-emerald-400">
                                                                ✅ App:{' '}
                                                                {formatClock(
                                                                    order.refundApprovedAt
                                                                )}
                                                            </div>
                                                        )}
                                                        {order.refundRejectedAt && (
                                                            <div className="text-red-400">
                                                                ❌ Rej:{' '}
                                                                {formatClock(
                                                                    order.refundRejectedAt
                                                                )}
                                                            </div>
                                                        )}
                                                    </td>
                                                </>
                                            ) : (
                                                <>
                                                    {/* STANDARD LOGISTICS SLICES: Fall back natively to your original tracking views */}
                                                    <td
                                                        className="p-4 max-w-xs truncate text-slate-400 text-xs"
                                                        title={
                                                            order.deliveryAddressLine ||
                                                            'No delivery address logged.'
                                                        }
                                                    >
                                                        {order.deliveryAddressLine || '-'}
                                                    </td>

                                                    {currentTableLayout === 'packing' && (
                                                        <td className="p-4 font-mono text-xs text-slate-400">
                                                            {formatClock(order.orderDate)}
                                                        </td>
                                                    )}

                                                    {currentTableLayout === 'shelf' && (
                                                        <td className="p-4 font-mono text-xs text-slate-400">
                                                            {formatClock(order.packedAt)}
                                                        </td>
                                                    )}

                                                    {currentTableLayout === 'transit' && (
                                                        <>
                                                            <td className="p-4 text-amber-400 font-bold text-xs">
                                                                {order.deliveryPartner?.name || '—'}
                                                            </td>
                                                            <td className="p-4 font-mono text-xs text-slate-400">
                                                                {formatClock(order.claimedAt)}
                                                            </td>
                                                        </>
                                                    )}

                                                    {currentTableLayout === 'delivered' && (
                                                        <>
                                                            <td className="p-4 text-slate-200 font-medium text-xs">
                                                                {order.deliveryPartner?.name || '—'}
                                                            </td>
                                                            <td
                                                                className={`p-4 font-mono text-xs font-black ${
                                                                    order.wasDeliveredOnTime ===
                                                                    false
                                                                        ? 'text-red-400 bg-red-500/5 px-2 rounded-md'
                                                                        : 'text-slate-400'
                                                                }`}
                                                            >
                                                                ⏱️ {order.efficiencyMinutes || 0}{' '}
                                                                mins
                                                            </td>
                                                        </>
                                                    )}
                                                </>
                                            )}
                                            {/* 🟢 FIXED: The data button cell now maps dynamically, keeping active workflows completely clean! */}
                                            {(currentTableLayout === 'delivered' ||
                                                currentTableLayout === 'billing') && (
                                                <td className="p-4 text-center">
                                                    <div className="flex items-center justify-center gap-2">
                                                        {currentTableLayout === 'billing' ? (
                                                            order.refundStatus === 'Requested' ? (
                                                                <>
                                                                    <button
                                                                        onClick={() =>
                                                                            handleResolveRefundTicket(
                                                                                order.id,
                                                                                'APPROVED',
                                                                                order.totalPrice
                                                                            )
                                                                        }
                                                                        disabled={
                                                                            isResolvingId !== null
                                                                        }
                                                                        className="px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider bg-emerald-500 text-slate-950 hover:bg-emerald-400 disabled:opacity-40 transition"
                                                                    >
                                                                        {isResolvingId === order.id
                                                                            ? '...'
                                                                            : '✓ Approve'}
                                                                    </button>
                                                                    <button
                                                                        onClick={() =>
                                                                            handleResolveRefundTicket(
                                                                                order.id,
                                                                                'REJECT',
                                                                                order.totalPrice
                                                                            )
                                                                        }
                                                                        disabled={
                                                                            isResolvingId !== null
                                                                        }
                                                                        className="px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider bg-red-600 text-white hover:bg-red-500 disabled:opacity-40 transition"
                                                                    >
                                                                        {isResolvingId === order.id
                                                                            ? '...'
                                                                            : '✕ Reject'}{' '}
                                                                    </button>
                                                                </>
                                                            ) : (
                                                                <span className="text-[10px] font-mono text-slate-500 italic">
                                                                    Ticket Settled
                                                                </span>
                                                            )
                                                        ) : (
                                                            <a
                                                                href={`https://wa.me/${order.customer?.phone}?text=Hello%20${encodeURIComponent(order.customer?.name || '')},%20this%20is%20Grocers%20Logistics%20Support%20regarding%20Order%20%23000${order.id}.`}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700 transition"
                                                            >
                                                                💬 Chat Support
                                                            </a>
                                                        )}
                                                    </div>
                                                </td>
                                            )}

                                            {/* 💰 INVOICE VALUE COLUMN */}
                                            <td className="p-4 text-right font-black text-emerald-400">
                                                ₹{Number(order.totalPrice).toFixed(2)}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                    {/* 🎮 🌟 NEW: THE METALLIC PAGINATION TOOLBAR FOOTER DOCK */}
                    {/* 🎮 THE ULTIMATE METALLIC MULTI-PAGE NAV FOOTER TRACK DOCK */}
                    {totalPagesCount > 1 && (
                        <div className="flex flex-col lg:flex-row items-center justify-between gap-4 border-t border-slate-800 pt-5 mt-6">
                            {/* LEFT PILLAR: RUNTIME DATA CAPACITY METRIC COUNTERS */}
                            <p className="text-xs text-slate-500 font-medium order-3 lg:order-1">
                                Showing{' '}
                                <span className="text-slate-300 font-bold">
                                    {indexOfFirstItem + 1}
                                </span>{' '}
                                to{' '}
                                <span className="text-slate-300 font-bold">
                                    {Math.min(indexOfLastItem, totalItemsCount)}
                                </span>{' '}
                                of{' '}
                                <span className="text-amber-500 font-bold">{totalItemsCount}</span>{' '}
                                audited entries
                            </p>

                            {/* RIGHT PILLAR: INTERACTIVE NUMERIC STRIP + FAST WARP OVERLAY LANES */}
                            <div className="flex flex-col sm:flex-row items-center gap-4 order-1 lg:order-3 w-full sm:w-auto justify-end">
                                {/* A. THE DYNAMIC CELL TRUNCATION GENERATOR TRACK */}
                                <div className="flex items-center space-x-1 bg-slate-950/60 p-1 rounded-xl border border-slate-800/80">
                                    {/* PREVIOUS CONTROL */}
                                    <button
                                        onClick={() =>
                                            setCurrentPage((prev) => Math.max(prev - 1, 1))
                                        }
                                        disabled={currentPage === 1}
                                        className="px-2.5 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider bg-slate-900 border border-slate-800 text-slate-400 hover:text-white disabled:opacity-30 disabled:hover:text-slate-400 transition"
                                    >
                                        « Prev
                                    </button>

                                    {/* CLIPPED ELLIPSES ELIDED STRIP CORE GENERATOR */}
                                    {(() => {
                                        const pages: (number | string)[] = [];
                                        const maxVisibleNeighbors = 1;

                                        for (let i = 1; i <= totalPagesCount; i++) {
                                            if (
                                                i === 1 ||
                                                i === totalPagesCount ||
                                                (i >= currentPage - maxVisibleNeighbors &&
                                                    i <= currentPage + maxVisibleNeighbors)
                                            ) {
                                                pages.push(i);
                                            } else if (pages[pages.length - 1] !== '...') {
                                                pages.push('...');
                                            }
                                        }

                                        return pages.map((page, index) => {
                                            const isEllipsis = page === '...';
                                            const isActive = currentPage === page;

                                            if (isEllipsis) {
                                                return (
                                                    <span
                                                        key={`ellipsis-${index}`}
                                                        className="h-7 w-7 flex items-center justify-center text-xs font-bold text-slate-600 font-mono"
                                                    >
                                                        ...
                                                    </span>
                                                );
                                            }

                                            return (
                                                <button
                                                    key={`page-${page}`}
                                                    onClick={() => setCurrentPage(page as number)}
                                                    className={`h-7 w-7 rounded-lg text-xs font-mono font-bold transition-all ${
                                                        isActive
                                                            ? 'bg-amber-500 text-slate-950 font-black shadow-lg shadow-amber-500/10 scale-105'
                                                            : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                                                    }`}
                                                >
                                                    {page}
                                                </button>
                                            );
                                        });
                                    })()}

                                    {/* NEXT CONTROL */}
                                    <button
                                        onClick={() =>
                                            setCurrentPage((prev) =>
                                                Math.min(prev + 1, totalPagesCount)
                                            )
                                        }
                                        disabled={currentPage === totalPagesCount}
                                        className="px-2.5 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider bg-slate-900 border border-slate-800 text-slate-400 hover:text-white disabled:opacity-30 disabled:hover:text-slate-400 transition"
                                    >
                                        Next »
                                    </button>
                                </div>

                                {/* B. 🌟 THE JUMP OVERLAY BAR INTERFACE INPUT BOX */}
                                <div className="flex items-center space-x-2 bg-slate-950/40 px-3 py-1.5 rounded-xl border border-slate-800 w-full sm:w-auto justify-center">
                                    <label
                                        htmlFor="jump-page"
                                        className="text-[10px] uppercase font-black tracking-wider text-slate-500"
                                    >
                                        Jump to:
                                    </label>
                                    <input
                                        id="jump-page"
                                        type="text"
                                        placeholder={currentPage.toString()}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                const targetedValue = parseInt(
                                                    (e.target as HTMLInputElement).value
                                                );
                                                // 🛡️ Safety Guardrail Range Boundary Checks [I20]
                                                if (
                                                    !isNaN(targetedValue) &&
                                                    targetedValue >= 1 &&
                                                    targetedValue <= totalPagesCount
                                                ) {
                                                    setCurrentPage(targetedValue);
                                                } else {
                                                    alert(
                                                        `Boundary Exception: Out of range. Enter a valid segment between 1 and ${totalPagesCount}.`
                                                    );
                                                }
                                                (e.target as HTMLInputElement).value = ''; // Clean box input out natively after warp [I20]
                                            }
                                        }}
                                        className="w-12 bg-slate-900 text-center font-mono font-bold text-xs text-amber-400 border border-slate-800 rounded-md py-0.5 placeholder-slate-600 focus:outline-none focus:border-amber-500 transition-colors"
                                    />
                                    <span className="text-[10px] font-mono font-bold text-slate-600">
                                        / {totalPagesCount}
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
