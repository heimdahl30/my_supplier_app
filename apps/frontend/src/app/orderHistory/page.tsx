'use client';
import { Fragment, useEffect, useState } from 'react';
import Link from 'next/dist/client/link';
import { useAuth } from '@/hooks/useAuth';
import { io } from 'socket.io-client';
import api from '@/services/api';
import axios from 'axios';

interface DatabaseOrderItem {
    id: number;
    orderId: number;
    productId: number;
    quantityKg: number;
    priceAtPurchase: string;
    // If your backend schema includes a name field directly or inside a product relation, map it here
    product?: {
        id: number;
        name: string;
        category: string;
        desc: string;
        pricePerKg: number;
        stockKg: number;
    };
}

interface DatabaseOrder {
    id: number;
    customerId: number;
    totalPrice: string; // Postgres numeric values come back as text strings
    status: 'Packing' | 'Processing' | 'Packed' | 'Out for Delivery' | 'Delivered' | 'Cancelled';
    deliveryNotes: string | null;
    orderDate: string;
    driverLat?: string | null;
    driverLon?: string | null;
    orderItems: DatabaseOrderItem[]; // 🌟 Maps perfectly to your backend 'with: { orderItems: true }' relation!
    refundStatus: string;
}

export default function CustomerOrdersPage() {
    const { user, isAuthenticated } = useAuth();
    const [orders, setOrders] = useState<DatabaseOrder[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const [activeRefundOrderId, setActiveRefundOrderId] = useState<number | null>(null);
    const [refundReason, setRefundReason] = useState<string>('');
    const [isSubmittingRefund, setIsSubmittingRefund] = useState<boolean>(false);

    const [uploadedImages, setUploadedImages] = useState<File[]>([]);

    // 🌟 FEATURE 1: Track which historical row index is currently toggled open for item details
    const [expandedOrderId, setExpandedOrderId] = useState<number | null>(null);

    // 🌟 FEATURE 2: Independent History Pagination State
    const [historyPage, setHistoryPage] = useState(1);
    const itemsPerHistoryPage = 5; // Clean, compact display block

    useEffect(() => {
        if (!isAuthenticated) {
            setTimeout(() => {
                setIsLoading(false);
            }, 0);
            return;
        }
        const fetchAccountData = async () => {
            setIsLoading(true);
            try {
                const response = await api.get('/orders/myHistory');
                setOrders(response.data); // Directly updates table state rows!
            } catch (err) {
                console.error('Failed to read user account ledger rows:', err);
            } finally {
                setIsLoading(false);
            }
        };

        fetchAccountData();

        const socketInstance = io('http://localhost:5000', { transports: ['websocket'] });

        socketInstance.on('connect', () => {
            console.log(`🔌 Connected! Joining personal updates channel for customer_${user?.id}`);
            socketInstance.emit('join_customer_dashboard_room', { customerId: user?.id });
        });

        // 🟢 THE RE-FETCH MATCH: The exact millisecond the backend emits this event signal,
        // this handler wakes up and triggers a single fresh API call to sync the data grid instantly!
        socketInstance.on('order_list_updated', () => {
            console.log(
                '⚡ Change detected on server ledger records! Synchronizing UI components...'
            );
            fetchAccountData();
        });

        // 3. Clear memory handles cleanly when the tab session drops out [1.13]
        return () => {
            if (socketInstance) {
                socketInstance.off('connect');
                socketInstance.off('order_list_updated');
                socketInstance.disconnect();
            }
        };
    }, [isAuthenticated, user?.id]);

    console.log('orders', orders);

    // Split target categories
    const activeOrders = orders.filter((o) => o.status !== 'Delivered' && o.status !== 'Cancelled');
    const orderHistory = orders.filter((o) => o.status === 'Delivered' || o.status === 'Cancelled');

    // Compute independent pagination splice markers for past purchases shelf
    const totalHistoryPages = Math.ceil(orderHistory.length / itemsPerHistoryPage);
    const indexOfLastHistoryItem = historyPage * itemsPerHistoryPage;
    const indexOfFirstHistoryItem = indexOfLastHistoryItem - itemsPerHistoryPage;
    const currentHistoryOrders = orderHistory.slice(
        indexOfFirstHistoryItem,
        indexOfLastHistoryItem
    );

    const toggleOrderDetails = (orderId: number) => {
        setExpandedOrderId((prev) => (prev === orderId ? null : orderId));
    };

    if (isLoading)
        return (
            <div className="p-8 text-center text-slate-500 font-medium animate-pulse">
                Reading grocery ledger tracking lines...
            </div>
        );

    return (
        <div className="min-h-screen bg-slate-50/50 p-6 space-y-8">
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">My Orders</h1>

            {/* 🏍️ SECTION 1: ACTIVE LIVE TRACKING CARDS */}
            {activeOrders.length > 0 && (
                <div className="space-y-4">
                    <h2 className="text-lg font-bold text-emerald-700 flex items-center gap-2">
                        Base Deliveries 🟢
                    </h2>
                    {activeOrders.map((order) => (
                        <div
                            key={order.id}
                            className="bg-white border border-slate-100 shadow-sm rounded-2xl p-6 grid grid-cols-1 md:grid-cols-2 gap-6"
                        >
                            <div className="space-y-4">
                                <div className="flex justify-between items-center">
                                    <span className="font-mono text-xs font-bold text-slate-400">
                                        ORDER #{order.id}
                                    </span>
                                    <span>
                                        <Link
                                            href={`/orders/${order.id}`}
                                            className="font-mono text-xs font-bold text-slate-400 hover:bg-slate-400 hover:text-white transition-colors shadow-sm text-center"
                                        >
                                            Track Live Logistics Status
                                        </Link>
                                    </span>
                                    <span className="px-3 py-1 bg-amber-50 text-amber-700 rounded-full font-bold text-xs uppercase tracking-wider">
                                        {order.status}
                                    </span>
                                </div>
                                <div className="relative pt-4">
                                    <div className="flex justify-between text-xs text-slate-500 font-bold">
                                        <span
                                            className={
                                                order.status !== 'Processing'
                                                    ? 'text-emerald-600'
                                                    : 'text-slate-400'
                                            }
                                        >
                                            ✓ Received
                                        </span>
                                        <span
                                            className={
                                                ['Packed', 'Out for Delivery'].includes(
                                                    order.status
                                                )
                                                    ? 'text-emerald-600'
                                                    : 'text-slate-400'
                                            }
                                        >
                                            ✓ Packed
                                        </span>
                                        <span
                                            className={
                                                order.status === 'Out for Delivery'
                                                    ? 'text-emerald-600 font-extrabold animate-pulse'
                                                    : 'text-slate-400'
                                            }
                                        >
                                            🚚 Out Now
                                        </span>
                                    </div>
                                </div>
                                <p className="text-xl font-black text-slate-900 mt-4">
                                    Total Bill: ₹{Number(order.totalPrice).toFixed(2)}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* 📦 SECTION 2: PAST PURCHASES WITH DROPDOWN ITEMIZATION AND PAGINATION */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                <h3 className="text-lg font-bold text-slate-800 mb-4">Past Purchases</h3>
                {orderHistory.length === 0 ? (
                    <p className="text-sm text-slate-400 font-medium">
                        You haven&apos;t placed any historical orders on our network yet.
                    </p>
                ) : (
                    <div className="space-y-4">
                        <div className="overflow-x-auto">
                            <table className="w-full table-fixed text-center text-sm text-slate-600">
                                <thead>
                                    <tr className="border-b border-slate-100 text-xs font-bold uppercase tracking-wider text-slate-400">
                                        <th className="pb-3">Order ID</th>
                                        <th className="pb-3">Date</th>
                                        <th className="pb-3">Status</th>
                                        <th className="pb-3">Amount</th>
                                        <th className="pb-3">Action</th>
                                        <th className="pb-3">Refund status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {/* 🌟 Loop through spliced pagination data instead of raw array list! */}
                                    {currentHistoryOrders.map((historyOrder) => (
                                        <Fragment key={historyOrder.id}>
                                            <tr className="hover:bg-slate-50/50 transition duration-150">
                                                <td className="py-3.5 pl-2 font-mono font-bold text-slate-900">
                                                    #{historyOrder.id}
                                                </td>
                                                <td className="py-3.5 text-center text-xs text-slate-500">
                                                    {(() => {
                                                        // Strip the 'Z' from the string if it exists to treat it as local time
                                                        const dateStr =
                                                            historyOrder.orderDate.endsWith('Z')
                                                                ? historyOrder.orderDate.slice(
                                                                      0,
                                                                      -1
                                                                  )
                                                                : historyOrder.orderDate;

                                                        return new Date(dateStr).toLocaleString(
                                                            [],
                                                            {
                                                                dateStyle: 'medium',
                                                                timeStyle: 'short',
                                                            }
                                                        );
                                                    })()}
                                                </td>
                                                <td className="py-3.5 text-center">
                                                    <span
                                                        className={`px-2 py-0.5 rounded-full text-xs font-bold ${historyOrder.status === 'Delivered' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}
                                                    >
                                                        {historyOrder.status}
                                                    </span>
                                                </td>
                                                <td className="py-3.5 text-center font-bold text-slate-900">
                                                    ₹{Number(historyOrder.totalPrice).toFixed(2)}
                                                </td>
                                                <td className="py-3.5">
                                                    <button
                                                        onClick={() =>
                                                            toggleOrderDetails(historyOrder.id)
                                                        }
                                                        className="px-2.5 py-1 text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg transition"
                                                    >
                                                        {expandedOrderId === historyOrder.id
                                                            ? 'Hide Items ▴'
                                                            : 'View Items ▾'}
                                                    </button>
                                                </td>
                                                <td className="py-3.5">
                                                    {/* 🚀 CONDITION 1: Fresh baseline order with no refund history yet */}
                                                    {historyOrder.refundStatus === 'No Refund' &&
                                                        historyOrder.status === 'Delivered' && (
                                                            <button
                                                                onClick={() => {
                                                                    setActiveRefundOrderId(
                                                                        historyOrder.id
                                                                    );
                                                                    setRefundReason('');
                                                                    setUploadedImages([]); // Clear out any previous image states cleanly
                                                                }}
                                                                className="px-2.5 py-1 text-xs bg-red-50 hover:bg-red-100 text-red-700 font-bold rounded-lg transition border border-red-100"
                                                            >
                                                                Request Refund
                                                            </button>
                                                        )}

                                                    {/* Gate check wrapper if they try to refund an item that hasn't arrived yet */}
                                                    {historyOrder.refundStatus === 'No Refund' &&
                                                        historyOrder.status !== 'Delivered' && (
                                                            <span className="text-[11px] font-bold text-slate-400 italic">
                                                                Awaiting Delivery
                                                            </span>
                                                        )}

                                                    {/* 🚀 CONDITION 2: Ticket logged, awaiting administrative manager audit review */}
                                                    {historyOrder.refundStatus === 'Requested' && (
                                                        <span className="px-2.5 py-1 text-[10px] font-black uppercase rounded-lg bg-amber-50 text-amber-700 border border-amber-100 animate-pulse">
                                                            Refund Requested
                                                        </span>
                                                    )}

                                                    {/* 🚀 CONDITION 3: Audit complete, request approved by manager */}
                                                    {historyOrder.refundStatus === 'Approved' && (
                                                        <span className="px-2.5 py-1 text-[10px] font-black uppercase rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-100">
                                                            Refund Approved ✅
                                                        </span>
                                                    )}

                                                    {/* 🚀 CONDITION 4: Audit complete, request rejected by manager */}
                                                    {historyOrder.refundStatus === 'Rejected' && (
                                                        <span className="px-2.5 py-1 text-[10px] font-black uppercase rounded-lg bg-rose-50 text-rose-700 border border-rose-100">
                                                            Refund Denied ✕
                                                        </span>
                                                    )}
                                                </td>
                                            </tr>

                                            {/* 🌟 ITEM DETAILS REWRITE: Render conditionally inside a smooth embedded row block */}
                                            {expandedOrderId === historyOrder.id && (
                                                <tr className="bg-slate-50/60 animate-fadeIn">
                                                    <td
                                                        colSpan={5}
                                                        className="p-4 border-t border-b border-slate-100"
                                                    >
                                                        <div className="bg-white rounded-xl p-4 border border-slate-200/60 shadow-sm space-y-3 max-w-xl">
                                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                                                Receipt Itemization:
                                                            </p>

                                                            {historyOrder.orderItems &&
                                                            historyOrder.orderItems.length > 0 ? (
                                                                <div className="divide-y divide-slate-100">
                                                                    {historyOrder.orderItems.map(
                                                                        (item) => (
                                                                            <div
                                                                                key={
                                                                                    item?.product
                                                                                        ?.id
                                                                                }
                                                                                className="flex justify-between items-center text-xs py-2"
                                                                            >
                                                                                <span className="font-semibold text-slate-800">
                                                                                    {
                                                                                        item.product
                                                                                            ?.name
                                                                                    }{' '}
                                                                                    <span className="text-slate-400 font-normal ml-1">
                                                                                        x
                                                                                        {
                                                                                            item.quantityKg
                                                                                        }
                                                                                    </span>
                                                                                </span>
                                                                                <span className="font-mono text-slate-900 font-bold">
                                                                                    ₹
                                                                                    {(
                                                                                        Number(
                                                                                            item
                                                                                                .product
                                                                                                ?.pricePerKg
                                                                                        ) *
                                                                                        item.quantityKg
                                                                                    ).toFixed(2)}
                                                                                </span>
                                                                            </div>
                                                                        )
                                                                    )}
                                                                </div>
                                                            ) : (
                                                                <p className="text-xs italic text-slate-400">
                                                                    Product item listing unavailable
                                                                    for this transaction record.
                                                                </p>
                                                            )}
                                                            {/* 🟢 ADJUSTMENT POINT: PLACED PERFECTLY AT THE BASE OF THE RECEIPT BOX CARD */}
                                                            <div className="flex justify-between items-center bg-slate-50 p-4 rounded-xl border border-slate-200 mt-2">
                                                                <div>
                                                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                                                        Logistics Status:
                                                                    </p>
                                                                    <p className="text-xs font-bold text-amber-700 mt-1 flex items-center gap-1.5">
                                                                        {/* 💡 Dynamic text adjustment: Match badge text directly to your backend database string records! */}
                                                                        {historyOrder.status ===
                                                                            'Packing' &&
                                                                            '🚚 Crate is currently being packed by warehouse crews.'}
                                                                        {historyOrder.status ===
                                                                            'Processing' &&
                                                                            '⏳ Payment received. Authorizing order lines.'}
                                                                        {historyOrder.status ===
                                                                            'Out for Delivery' &&
                                                                            '🚴 Driver has collected your box and is inbound!'}
                                                                        {historyOrder.status ===
                                                                            'Delivered' &&
                                                                            '✅ Package safely handed over at destination doorstep.'}
                                                                        {historyOrder.status !==
                                                                            'Packing' &&
                                                                            historyOrder.status !==
                                                                                'Processing' &&
                                                                            historyOrder.status !==
                                                                                'Out for Delivery' &&
                                                                            historyOrder.status !==
                                                                                'Delivered' &&
                                                                            `📦 Status: ${historyOrder.status}`}
                                                                    </p>
                                                                </div>

                                                                {/* 🚀 THE UX GUARDRAIL LINK: Appears only for active transits, routing them to the dedicated single map node! */}
                                                                {historyOrder.status !==
                                                                    'Delivered' && (
                                                                    <Link
                                                                        href={`/orders/${historyOrder.id}`}
                                                                        className="px-3 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-bold hover:bg-slate-800 transition whitespace-nowrap"
                                                                    >
                                                                        Track on Map ↗
                                                                    </Link>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </Fragment>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        {totalHistoryPages > 1 && (
                            <div className="flex items-center justify-between pt-2">
                                <button
                                    onClick={() => setHistoryPage((page) => Math.max(1, page - 1))}
                                    disabled={historyPage === 1}
                                    className="px-3 py-1.5 text-xs font-bold rounded-lg bg-slate-100 text-slate-700 disabled:opacity-50"
                                >
                                    Previous
                                </button>
                                <span className="text-xs font-semibold text-slate-500">
                                    Page {historyPage} of {totalHistoryPages}
                                </span>
                                <button
                                    onClick={() =>
                                        setHistoryPage((page) =>
                                            Math.min(totalHistoryPages, page + 1)
                                        )
                                    }
                                    disabled={historyPage === totalHistoryPages}
                                    className="px-3 py-1.5 text-xs font-bold rounded-lg bg-slate-100 text-slate-700 disabled:opacity-50"
                                >
                                    Next
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
            {/* 🚀 THE DYNAMIC FINANCIAL REFUND PORTAL MODAL LAYER */}
            {activeRefundOrderId !== null && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm transition duration-300">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md border border-slate-100 overflow-hidden transform transition-all scale-100 p-6">
                        {/* Modal Heading Structure */}
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-sm font-black uppercase tracking-wider text-slate-800">
                                File Refund Ticket — Order #
                                {activeRefundOrderId.toString().padStart(4, '0')}
                            </h3>
                            <button
                                onClick={() => setActiveRefundOrderId(null)}
                                className="text-slate-400 hover:text-slate-600 text-base font-bold transition p-1"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Input Submission Content Form Wrapper */}
                        <form
                            onSubmit={async (e) => {
                                e.preventDefault();
                                if (!refundReason.trim())
                                    return alert('Please enter a valid audit statement.');

                                try {
                                    setIsSubmittingRefund(true);

                                    // 🟢 PACKAGING FORM DATA MULTI-PART ENVELOPE:
                                    const packageData = new FormData();
                                    packageData.append('reason', refundReason.trim());

                                    // Loop through and attach each file binary cleanly onto the upload stream array key
                                    uploadedImages.forEach((imageFile) => {
                                        packageData.append('evidencePhotos', imageFile);
                                    });

                                    // 📡 POST DOWN THE WIRE: Set headers explicitly to multipart formatting rules
                                    const response = await api.post(
                                        `/orders/${activeRefundOrderId}/request-refund`,
                                        packageData,
                                        {
                                            headers: {
                                                'Content-Type': 'multipart/form-data',
                                            },
                                        }
                                    );

                                    alert(
                                        response.data.message ||
                                            'Refund successfully requested! Websocket signals updated.'
                                    );

                                    // 🟢 UI INSTANT SYNCHRONIZATION:
                                    // Update the local array element directly so the status badge flips to "Refund Requested"
                                    // the exact millisecond the server returns 200, without waiting for socket returns!
                                    setOrders((prevOrders: DatabaseOrder[]) =>
                                        prevOrders.map((ord: DatabaseOrder) =>
                                            ord.id === activeRefundOrderId
                                                ? { ...ord, refundStatus: 'Requested' }
                                                : ord
                                        )
                                    );

                                    setActiveRefundOrderId(null);
                                    setRefundReason('');
                                    setUploadedImages([]);
                                } catch (err) {
                                    if (axios.isAxiosError(err)) {
                                        // TypeScript now 100% knows this object contains response variables!
                                        const serverErrorMessage =
                                            err.response?.data?.error ||
                                            'A network constraint prevented ticket logging.';
                                        alert(serverErrorMessage);
                                    } else if (err instanceof Error) {
                                        // Fallback catch block handles native standard JavaScript browser runtime engine bugs
                                        alert(err.message);
                                    } else {
                                        // Extreme fallback for unidentifiable error structures
                                        alert(
                                            'An unexpected internal tracking validation anomaly occurred.'
                                        );
                                    }
                                } finally {
                                    setIsSubmittingRefund(false);
                                }
                            }}
                        >
                            <div className="space-y-4">
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide">
                                    State Reason for Refund
                                </label>
                                <textarea
                                    required
                                    value={refundReason}
                                    onChange={(e) => setRefundReason(e.target.value)}
                                    placeholder="Please describe what went wrong (e.g., Damaged produce items, Missing items crate, Arrived cold)..."
                                    rows={4}
                                    className="w-full text-xs p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-800 placeholder-slate-400 transition"
                                />
                            </div>
                            {/* 📸 VISUAL EVIDENCE DROP-ZONE PORTAL */}
                            <div className="space-y-2 mt-4">
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide">
                                    Upload Evidence Photos (Max 3)
                                </label>
                                <input
                                    type="file"
                                    multiple
                                    accept="image/*"
                                    onChange={(e) => {
                                        if (e.target.files) {
                                            const filesArray = Array.from(e.target.files);
                                            if (filesArray.length > 3) {
                                                alert(
                                                    'Security Limit: You can only upload a maximum of 3 validation images.'
                                                );
                                                return;
                                            }
                                            setUploadedImages(filesArray);
                                        }
                                    }}
                                    className="w-full text-xs p-2 bg-slate-50 border border-dashed border-slate-300 rounded-xl cursor-pointer text-slate-600 focus:outline-none"
                                />

                                {/* Minimalist visual preview tags grid indicator */}
                                {uploadedImages.length > 0 && (
                                    <div className="flex space-x-2 mt-2">
                                        {uploadedImages.map((file, idx) => (
                                            <span
                                                key={idx}
                                                className="bg-slate-100 text-slate-700 text-[10px] font-mono px-2 py-1 rounded border border-slate-200 truncate max-w-[120px]"
                                            >
                                                📄 {file.name}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Lower Dialog Control Action Bars Grid */}
                            <div className="flex justify-end space-x-3 mt-6">
                                <button
                                    type="button"
                                    disabled={isSubmittingRefund}
                                    onClick={() => setActiveRefundOrderId(null)}
                                    className="px-4 py-2 text-xs text-slate-500 hover:text-slate-700 font-bold transition disabled:opacity-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmittingRefund || !refundReason.trim()}
                                    className="px-4 py-2 text-xs bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl transition shadow-sm shadow-red-600/10 disabled:opacity-50"
                                >
                                    {isSubmittingRefund
                                        ? 'Submitting Ticket...'
                                        : 'Confirm Submission'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
