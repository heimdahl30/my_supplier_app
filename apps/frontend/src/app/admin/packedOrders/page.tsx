'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';

interface Customer {
    id: number;
    name: string;
    phone: string;
    email: string;
    address: string;
    latitude: number;
    longitude: number;
    role: string;
    subRole: string;
}

interface Orders {
    id: number;
    customer: Customer;
    totalPrice: number;
    deliveryNotes: string;
    status: string;
    deliveryPartnerId: number | null;
    orderDate: string;
    packedAt: string;
    claimedAt: string;
    deliveredAt: string;
}

const PackedOrders = () => {
    const [isTableLoading, setIsTableLoading] = useState(true);
    const [orders, setOrders] = useState<Orders[]>([]);
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    // 1. Pagination State Management
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10; // Number of orders displayed per page

    // 2. Compute Pagination Splice Calculations
    const totalPages = Math.ceil(orders.length / itemsPerPage);
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentOrders = orders.slice(indexOfFirstItem, indexOfLastItem);

    const { user } = useAuth();
    const router = useRouter();

    // 🌟 THE VISUAL FIXED-WIDTH REWRITE: Always returns exactly 7 items!
    const getPageNumbers = () => {
        const pageNumbers: (number | string)[] = [];
        if (totalPages <= 7) {
            for (let i = 1; i <= totalPages; i++) pageNumbers.push(i);
            return pageNumbers;
        }

        // Scenario 1: Stuck against the Left Wall (Pages 1, 2, 3, 4)
        if (currentPage <= 4) {
            return [1, 2, 3, 4, 5, '...', totalPages]; // 🎯 Count: Exactly 7 items!
        }

        // Scenario 2: Stuck against the Right Wall (Pages 97, 98, 99, 100)
        if (currentPage >= totalPages - 3) {
            return [
                1,
                '...',
                totalPages - 4,
                totalPages - 3,
                totalPages - 2,
                totalPages - 1,
                totalPages,
            ]; // 🎯 Count: Exactly 7 items!
        }

        // Scenario 3: Deep in the Middle Pages
        return [
            1,
            '...left',
            currentPage - 1,
            currentPage,
            currentPage + 1,
            '...right',
            totalPages,
        ]; // 🎯 Count: Exactly 7 items!
    };

    useEffect(() => {
        const fetchOrders = async () => {
            setIsTableLoading(true); // Turn on table shimmer skeleton rows right before fetch starts
            try {
                const packedOrders = await fetch(
                    'http://localhost:5000/api/v1/admin/orders/available',
                    {
                        method: 'GET',
                        credentials: 'include', // 🌟 THE MAGIC LINK! Forces fetch to pass your cookies!
                    }
                );

                const ordersData = await packedOrders.json();

                if (!packedOrders.ok) {
                    throw new Error(ordersData.error || 'Failed to fetch packed orders');
                }

                console.log('Packed Orders:', ordersData);
                setOrders(ordersData);
            } catch (error) {
                console.error('Error fetching packed orders:', error);
            } finally {
                setIsTableLoading(false); // Turn off table skeletons safely when the data lands!
            }
        };

        fetchOrders();

        // 3. ⏱️ THE HEARTBEAT: Run the fetch operation automatically every 30 seconds
        const heartbeatTimer = setInterval(() => {
            console.log('Polling background heartbeat triggered for fresh orders...');
            fetchOrders();
        }, 30000); // 30,000 milliseconds = 30 seconds

        // 4. CRUCIAL CLEANUP: Stops the timer if the manager clicks away to another page!
        return () => clearInterval(heartbeatTimer);
    }, [refreshTrigger]);

    const handleStatusUpdate = async (id: number) => {
        if (!user?.razorpaySubAccountId) {
            alert(
                '🛡️ Payout Configuration Required:\n\n' +
                    'You must link your bank account details before you can accept delivery jobs. ' +
                    'We are redirecting you to the payout setup terminal now.'
            );

            // 🚀 AUTOMATED REDIRECTION WARP ROUTE:
            // Directs them straight to the onboarding screen to fill out their settings!
            router.push('/admin/payout-setup');
            return;
        }

        // 🌟 1. DEFENSIVE SECURITY GUARD: Prompts the user BEFORE hitting the network thread
        const userConfirmed = confirm(`Are you sure you want to claim Order #${id} for delivery?`);

        // If the operator clicks "Cancel", this condition triggers and breaks out of the function entirely!
        if (!userConfirmed) {
            console.log(`Action aborted by operator for Order #${id}.`);
            return;
        }
        try {
            const orderPicked = await fetch(
                `http://localhost:5000/api/v1/admin/orders/${id}/claimed`,
                {
                    method: 'PATCH',
                    credentials: 'include',
                }
            );

            // 🌟 Crucial: Await the JSON translation payload
            const data = await orderPicked.json();

            if (orderPicked.ok) {
                setRefreshTrigger((prev) => prev + 1); //Triggers a re-fetch of the orders list
            } else {
                // Backend Error: Display the exact string ("Security Exception", etc.)
                alert(`Failed: ${data.error}`);
            }
        } catch (error) {
            // Severe Network Error
            console.error('Critical transport network failure:', error);
            alert(
                'System Error: Unable to reach the server. Please check your network connection.'
            );
        }
    };

    return (
        <div className="min-h-screen bg-gray-100 p-4">
            <div className="max-w-7xl mx-auto bg-white shadow-md rounded-lg p-6">
                {/* 🌟 THE FIX: This new parent flex row handles the horizontal distribution! */}
                <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
                    {/* Left Side: Title & Live Quantity Counter Badge */}
                    <div className="flex items-center space-x-3">
                        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                            Orders Packed
                        </h1>
                        <span className="inline-flex items-center justify-center bg-slate-100 text-slate-700 font-bold font-mono text-xs px-2.5 py-0.5 rounded-full border border-slate-200">
                            {orders.length}
                        </span>
                    </div>

                    {/* Right Side: Manual Force Refresh Button Action Box */}
                    <button
                        onClick={() => setRefreshTrigger((prev) => prev + 1)}
                        className="inline-flex items-center space-x-2 px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-50 hover:border-slate-300 transition active:scale-95 shadow-sm"
                    >
                        {/* Clean visual anchor loop icon using universal text characters */}
                        <span className="text-sm font-normal text-slate-400">🔄</span>
                        <span>Refresh Now</span>
                    </button>
                </div>
                {/* 1. Main Table Wrapper with horizontal scrolling guardrail */}
                <div className="w-full max-h-[500px] overflow-auto border border-slate-200 rounded-2xl bg-white shadow-sm mt-4">
                    <table className="w-full text-left border-collapse text-sm">
                        {/* 2. Semantic Table Header Column Labels */}
                        <thead className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase tracking-wider">
                            <tr>
                                <th className="p-4 bg-slate-50">Order ID</th>
                                <th className="p-4 bg-slate-50">Customer</th>
                                <th className="p-4 bg-slate-50">Address</th>
                                <th className="p-4 bg-slate-50">Delivery Notes</th>
                                <th className="p-4 bg-slate-50">Total Price ₹</th>
                                <th className="p-4 bg-slate-50 text-center">Status</th>
                                <th className="p-4 bg-slate-50 text-center">Actions</th>
                            </tr>
                        </thead>

                        {/* 3. Paginated & Filtered Data Rows */}
                        <tbody className="divide-y divide-slate-100 text-slate-700">
                            {/* 🌟 THE ARCHITECTURAL GUARD: If your filtered search contains items, render them! */}
                            {/* 🎯 THE SEPARATION OF CONCERNS: The skeleton listens to tableLoading! */}
                            {isTableLoading ? (
                                <TableSkeleton />
                            ) : (
                                currentOrders.map((order) => (
                                    <tr
                                        key={order.id}
                                        className="hover:bg-slate-50/50 transition-colors animate-fadeIn"
                                    >
                                        {/* Order ID Badge Column */}
                                        <td className="p-4 font-mono font-bold text-xs text-slate-900">
                                            #{order.id}
                                        </td>

                                        {/* Customer Profile Column */}
                                        <td className="p-4 font-medium text-slate-900">
                                            {order.customer.name}
                                        </td>

                                        {/* Physical Delivery Address Column */}
                                        <td
                                            className="p-4 max-w-xs truncate"
                                            title={order.customer.address}
                                        >
                                            {order.customer.address}
                                        </td>

                                        {/* Special Dispatch Delivery Notes Column */}
                                        <td
                                            className="p-4 italic text-slate-400 max-w-xs truncate"
                                            title={order.deliveryNotes || 'No notes'}
                                        >
                                            {order.deliveryNotes || '—'}
                                        </td>

                                        {/* Currency Pricing Column */}
                                        <td className="p-4 font-semibold text-slate-900">
                                            ₹{Number(order.totalPrice).toFixed(2)}
                                        </td>

                                        <td className="p-4 font-medium text-slate-900">
                                            {order.status}
                                        </td>

                                        {/* Status Action Button Column */}
                                        <td className="p-4 text-center">
                                            <button
                                                className="px-2.5 py-1 text-[10px] font-black uppercase tracking-widest rounded-full bg-amber-50 text-amber-700 hover:bg-amber-100 transition"
                                                onClick={() => handleStatusUpdate(order.id)}
                                            >
                                                Claim Order
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
                {/* 5. PAGINATION TOOLBAR DOCK: Fixed at the very bottom of the table block container card */}
                <div className="bg-slate-50 border-t border-slate-200 px-4 py-3 flex items-center justify-between sm:px-6 text-xs text-slate-500 font-medium">
                    <div>
                        Showing{' '}
                        <span className="font-semibold text-slate-900">
                            {orders.length === 0 ? 0 : indexOfFirstItem + 1}
                        </span>{' '}
                        to{' '}
                        <span className="font-semibold text-slate-900">
                            {Math.min(indexOfLastItem, orders.length)}
                        </span>{' '}
                        of <span className="font-semibold text-slate-900">{orders.length}</span>{' '}
                        entries
                    </div>

                    <div className="flex gap-1.5 items-center">
                        <button
                            onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                            disabled={currentPage === 1}
                            className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 font-bold hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
                        >
                            Previous
                        </button>
                        {/* 🌟 THE TRUNCATION MAP: Loops through our smart page numbers array */}
                        {getPageNumbers().map((page, idx) => {
                            // If the element in our array is a string text (the dots placeholder)
                            if (typeof page === 'string') {
                                return (
                                    <span
                                        key={`dots-${idx}`}
                                        className="px-2 py-1.5 text-slate-400 font-bold text-xs select-none tracking-widest"
                                    >
                                        ...
                                    </span>
                                );
                            }

                            // Otherwise, draw the clickable standard numeric page button layout
                            return (
                                <button
                                    key={`page-${page}`}
                                    onClick={() => setCurrentPage(page)}
                                    className={`px-3 py-1.5 rounded-lg border font-bold text-xs transition ${
                                        currentPage === page
                                            ? 'bg-amber-500 text-white border-amber-600 shadow-sm'
                                            : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                                    }`}
                                >
                                    {page}
                                </button>
                            );
                        })}
                        <button
                            onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                            disabled={currentPage === totalPages || totalPages === 0}
                            className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 font-bold hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
                        >
                            Next
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PackedOrders;

// 🌟 SKELETON COMPONENT SUB-MODULE (Pasted safely right at the bottom of the same file!)
function TableSkeleton() {
    return Array.from({ length: 10 }).map((_, idx) => (
        <tr key={`skeleton-row-${idx}`} className="animate-pulse">
            <td className="p-4">
                <div className="h-4 w-12 bg-slate-200 rounded-md"></div>
            </td>
            <td className="p-4">
                <div className="h-4 w-28 bg-slate-200 rounded-md"></div>
            </td>
            <td className="p-4">
                <div className="h-4 w-48 bg-slate-200 rounded-md"></div>
            </td>
            <td className="p-4">
                <div className="h-4 w-32 bg-slate-200 rounded-md"></div>
            </td>
            <td className="p-4">
                <div className="h-4 w-16 bg-slate-200 rounded-md"></div>
            </td>
            <td className="p-4">
                <div className="h-4 w-16 bg-slate-200 rounded-md"></div>
            </td>
            <td className="p-4 flex justify-center">
                <div className="h-6 w-24 bg-slate-200 rounded-full"></div>
            </td>
        </tr>
    ));
}
