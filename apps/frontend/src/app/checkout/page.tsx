'use client';

import { useAuth } from '@/hooks/useAuth';
import AddAddressModal from '@/components/AddAddressModal'; // Import our new reusable validated sub-form modal
import api from '@/services/api';
import axios from 'axios';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

interface SavedAddress {
    id: number;
    label: string;
    fullName: string;
    phone: string;
    addressLine: string;
    latitude: number;
    longitude: number;
    isDefault: boolean;
}

interface RazorpaySuccessResponse {
    razorpay_payment_id: string;
    razorpay_order_id: string;
    razorpay_signature: string;
}

// 🚀 1. THE TYPE EXTENSION PORTAL: Tells TypeScript that Razorpay safely exists globally on the browser DOM window object
interface RazorpayWindow extends Window {
    Razorpay?: new (options: Record<string, unknown>) => {
        open: () => void;
    };
}

// Ensure window context references compile beautifully without warnings
declare let window: RazorpayWindow;

// 🚀 Helper Routine: Dynamically drops Razorpay's native payment tracking overlay onto the document window
const loadRazorpayScriptInstance = (): Promise<boolean> => {
    return new Promise((resolve) => {
        if (window.Razorpay) {
            resolve(true);
            return;
        }
        const script = document.createElement('script');
        script.src = 'https://checkout.razorpay.com/v1/checkout.js';
        script.onload = () => resolve(true);
        script.onerror = () => resolve(false);
        document.body.appendChild(script);
    });
};

export default function CheckoutPage() {
    const { user, quantities, setQuantities, isAuthenticated, totalBill } = useAuth();
    const router = useRouter();

    const [addresses, setAddresses] = useState<SavedAddress[]>([]);
    const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);
    const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);
    const [isFetchingAddresses, setIsFetchingAddresses] = useState(true);
    const [selectedAddressId, setSelectedAddressId] = useState<number | null>(null);

    const [modalToken, setModalToken] = useState('initial-frame-signature');

    // 1. Wrap your root-level function in useCallback to freeze its pointer reference in RAM
    const fetchAddresses = useCallback(
        async (isActive = true) => {
            if (!isAuthenticated) return;
            try {
                const response = await api.get('/customers/addresses');
                if (!isActive) return;
                setAddresses(response.data);

                const defaultAddr = response.data.find((addr: SavedAddress) => addr.isDefault);
                if (defaultAddr) {
                    setSelectedAddressId(defaultAddr.id);
                } else if (response.data.length > 0) {
                    setSelectedAddressId(response.data[0].id);
                }
            } catch (err) {
                if (isActive) console.error('Failed to load records:', err);
            } finally {
                if (isActive) setIsFetchingAddresses(false);
            }
        },
        [isAuthenticated]
    ); // Only recreates the function signature if login states alter

    // 2. Now it is completely safe to list inside your dependency array!
    useEffect(() => {
        let isCurrentMount = true;

        const triggerInitialFetch = async () => {
            await fetchAddresses(isCurrentMount);
        };
        triggerInitialFetch();

        return () => {
            isCurrentMount = false;
        };
    }, [fetchAddresses]);

    // 2. SECURITY GUARD GATEWAY ACCESS RULE
    if (!isAuthenticated || !user) {
        return (
            <div className="max-w-md mx-auto my-24 p-8 text-center bg-white border border-slate-100 rounded-3xl shadow-sm">
                <p className="text-red-500 font-black text-sm tracking-wide">🔒 ACCESS DENIED</p>
                <p className="text-slate-500 text-xs mt-1">
                    Please log in to review your delivery coordinates.
                </p>
                <button
                    onClick={() => router.push('/store')}
                    className="mt-4 bg-slate-900 text-white px-4 py-2 rounded-xl text-xs font-bold"
                >
                    Return to Store
                </button>
            </div>
        );
    }

    // 3. SECURE TRANSACTION COMMIT SUBMISSION HANDLER
    const handleFinalizeCheckout = async () => {
        if (!selectedAddressId) {
            alert('Please pick or save a delivery destination card first.');
            return;
        }

        setIsSubmittingOrder(true);
        try {
            // 1. Force load Razorpay's core gateway visual bundle panel layout context
            const isGatewayReady = await loadRazorpayScriptInstance();
            if (!isGatewayReady) {
                alert(
                    'Financial transaction server connection dropped. Please check network configurations.'
                );
                setIsSubmittingOrder(false);
                return;
            }

            // Transform internal quantities object record grid into strict payload array contracts for Drizzle backend
            const orderPayload = {
                addressId: selectedAddressId, // Passes chosen destination target ID registry
                items: Object.entries(quantities).map(([productId, qty]) => ({
                    productId: Number(productId),
                    quantityKg: qty,
                })),
                totalPrice: totalBill,
                deliveryNotes: 'No special delivery notes provided.',
            };

            // Hits your backend route: POST /api/v1/orders/orderplacing
            const backendResponse = await api.post('/orders/orderplacing', orderPayload);

            // Extract the metadata returned straight out of your database transaction block!
            const { orderId, razorpayOrderId, amount, keyId } = backendResponse.data;

            // 3. STEP TWO: Configure the floating popup interface parameters natively
            const gatewayOptions = {
                key: keyId || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID, // Public API Key Token
                amount: amount.toString(), // Paise subunits matching backend parameters
                currency: 'INR',
                name: 'Fresh Grocery Storefront',
                description: `Payment lock authorization for Order Verification reference ID #${orderId}`,
                order_id: razorpayOrderId, // 🔗 The absolute link: Maps directly to your backend order instance token!
                handler: async function (paymentSuccessPayload: RazorpaySuccessResponse) {
                    // 🚀 THIS HANDLER EXECUTES THE EXACT MILLISECOND THE TRANSACTION IS FUNDED!
                    setIsSubmittingOrder(true);
                    try {
                        // 4. STEP THREE: Send signature parameters to your validation route to update statuses
                        const paymentVerificationResponse = await axios.post(
                            'http://localhost:5000/api/v1/payment/verify-signature',
                            {
                                orderId: orderId,
                                razorpayPaymentId: paymentSuccessPayload.razorpay_payment_id,
                                razorpayOrderId: paymentSuccessPayload.razorpay_order_id,
                                razorpaySignature: paymentSuccessPayload.razorpay_signature,
                            }
                        );

                        if (paymentVerificationResponse.status === 200) {
                            setQuantities({});
                            alert(
                                '🎉 Order placed and verified successfully! Sent straight to warehouse queues.'
                            );
                            router.push(`/order-success?id=${orderId}`);
                            return;
                        }
                    } catch (verifyError) {
                        console.error(
                            'Cryptographic transaction status synchronization failure:',
                            verifyError
                        );
                        alert(
                            'Payment captured but state failed to synchronize. Ledger rows will be updated via webhook fallback processing paths.'
                        );
                    } finally {
                        setIsSubmittingOrder(false);
                    }
                },
                prefill: {
                    name: 'Customer Name',
                    email: 'customer@email.com',
                    contact: '9999999999',
                },
                theme: { color: '#0f172a' }, // Deep slate matching your input borders and dashboard sheets
                modal: {
                    ondismiss: () => {
                        setIsSubmittingOrder(false);
                        console.log(
                            '💳 Payment portal modal frame overlay dismissed by checkout client.'
                        );
                    },
                },
            };

            // 5. STEP FOUR: Open the floating payment box frame overlay directly over the screen layout!
            if (typeof window !== 'undefined' && window.Razorpay) {
                const razorpayPaymentWindow = new window.Razorpay(
                    gatewayOptions as unknown as Record<string, unknown>
                );
                razorpayPaymentWindow.open();
            } else {
                console.error(
                    'Razorpay window constructor context was not found on the runtime DOM tree.'
                );
                alert('Payment processing bundle failed to initialize. Please try again.');
            }
        } catch (error) {
            if (axios.isAxiosError(error)) {
                alert(
                    error.response?.data?.error ||
                        'Transaction aborted by database constraint validation engine.'
                );
            } else {
                alert('A fatal local execution error halted checkout.');
            }
        } finally {
            setIsSubmittingOrder(false);
        }
    };

    const handleOpenAddressModal = () => {
        // 🌟 THE MUTATION PHASE: Generating a new timestamp string forces a state change!
        // This tells React: "The old layout token is dead. Throw everything away."
        setModalToken(`modal-track-${Date.now()}`);

        setIsAddressModalOpen(true);
    };

    const handleCloseAddressModal = () => {
        setIsAddressModalOpen(false);
    };

    console.log('Addresses', addresses);
    console.log('Selected Address ID from Auth Context in checkout:', selectedAddressId);

    return (
        <div className="max-w-2xl mx-auto my-12 p-6 bg-white border border-slate-100 rounded-3xl shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div>
                    <h2 className="text-xl font-black text-slate-900 tracking-tight">
                        Delivery Details
                    </h2>
                    <p className="text-xs text-slate-400 font-medium mt-0.5">
                        Choose where we should drop off your fresh groceries.
                    </p>
                </div>

                {/* BUTTON TRIGGER: OPENS OUR FLOATING ADD-ADDRESS MODAL */}
                <button
                    onClick={handleOpenAddressModal}
                    className="bg-blue-50 text-blue-600 hover:bg-blue-100 px-3 py-2 rounded-xl font-bold text-xs tracking-wide transition active:scale-95 shadow-sm border border-blue-100/50"
                >
                    + Add New Address
                </button>
            </div>

            {/* GRID SELECTION VIEW CONTAINER MAP LOOP */}
            {isFetchingAddresses ? (
                <div className="py-8 text-center text-xs text-slate-400 font-medium">
                    Loading your address book registry lines...
                </div>
            ) : addresses.length === 0 ? (
                <div className="p-6 text-center border-2 border-dashed border-slate-100 rounded-2xl bg-slate-50/50">
                    <p className="text-xs font-semibold text-slate-400">
                        No saved locations found on file profile charts.
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                        Click the button above to pin your very first address on the map canvas
                        wrapper.
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {addresses.map((addr) => (
                        <div
                            key={addr.id}
                            onClick={() => setSelectedAddressId(addr.id)}
                            className={`p-4 rounded-2xl border transition cursor-pointer text-left relative flex flex-col justify-between select-none ${
                                selectedAddressId === addr.id
                                    ? 'border-blue-600 bg-blue-50/10 ring-2 ring-blue-600/10 shadow-sm'
                                    : 'border-slate-100 hover:border-slate-300 bg-white'
                            }`}
                        >
                            <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-black text-slate-900 bg-slate-100 px-2 py-0.5 rounded-md uppercase tracking-wider text-[10px]">
                                        {addr.label}
                                    </span>
                                    {addr.isDefault && (
                                        <span className="text-emerald-600 text-[10px] font-bold bg-emerald-50 px-1.5 py-0.5 rounded-md">
                                            Primary
                                        </span>
                                    )}
                                </div>
                                <p className="text-sm font-bold text-slate-800 pt-1">
                                    {addr.fullName}
                                </p>
                                <p className="text-xs text-slate-500 font-medium">{addr.phone}</p>
                                <p className="text-xs text-slate-600 line-clamp-2 pt-0.5">
                                    {addr.addressLine}
                                </p>
                            </div>

                            {/* Visual radio check marker circle item */}
                            <div
                                className={`absolute top-4 right-4 h-4 w-4 rounded-full border flex items-center justify-center transition ${
                                    selectedAddressId === addr.id
                                        ? 'border-blue-600 bg-blue-600'
                                        : 'border-slate-300'
                                }`}
                            >
                                {selectedAddressId === addr.id && (
                                    <div className="h-1.5 w-1.5 bg-white rounded-full" />
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* BOTTOM TRANSACTION ACTIONS BLOCK CONTROL TRAY */}
            <div className="border-t border-slate-100 pt-6 flex items-center justify-between gap-4">
                <button
                    onClick={() => router.push('/store')}
                    className="px-4 py-3 border border-slate-200 hover:border-slate-300 rounded-xl font-bold text-slate-500 text-xs transition"
                >
                    Back to Store
                </button>

                <button
                    disabled={
                        isSubmittingOrder ||
                        !selectedAddressId ||
                        Object.keys(quantities).length === 0
                    }
                    onClick={handleFinalizeCheckout}
                    className="flex-1 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed text-white p-4 rounded-2xl font-black text-sm tracking-wide transition active:scale-98 shadow-md text-center"
                >
                    {isSubmittingOrder
                        ? 'Executing Secure Lock Transaction...'
                        : 'Confirm & Authorize Delivery'}
                </button>
            </div>

            {/* 💎 OUR FLOATING BACKDROP POPUP MODAL INTEGRATION */}
            <AddAddressModal
                renderKey={modalToken} // Forces React to throw away old modal state and re-render a fresh new instance
                isOpen={isAddressModalOpen}
                onClose={handleCloseAddressModal} // Closes overlay sheet window
                onAddressAdded={fetchAddresses} // Refetches fresh rows automatically right upon success save loop!
            />
        </div>
    );
}
