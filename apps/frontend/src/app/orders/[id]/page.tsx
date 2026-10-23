'use client';

import { useParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { io } from 'socket.io-client';
import dynamic from 'next/dynamic';
import api from '@/services/api';
import { useRouter } from 'next/navigation';

const LiveTrackingMap = dynamic(() => import('./LiveTrackingMap'), {
    ssr: false,
    loading: () => (
        <div className="w-full h-full bg-slate-100 flex items-center justify-center rounded-3xl">
            <p className="text-xs font-semibold text-slate-400 animate-pulse">
                Initializing map canvases...
            </p>
        </div>
    ),
});

interface OrderTrackerState {
    id: number;
    status: 'Processing' | 'Packing' | 'Packed' | 'Out for Delivery' | 'Delivered' | 'Cancelled';
    deliveryAddressLine: string;
    deliveryRecipientName: string;
    driverLat: number;
    driverLng: number;
}

interface DriverLocationPayload {
    latitude: number;
    longitude: number;
    currentStatus?:
        'Processing' | 'Packing' | 'Packed' | 'Out for Delivery' | 'Delivered' | 'Cancelled';
}

export default function SingleOrderTrackingPage() {
    const params = useParams();
    const router = useRouter();
    const orderId = params?.id;

    const [orderData, setOrderData] = useState<OrderTrackerState | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!orderId) return;

        // 1. Initial Handshake: Fetch the layout details cleanly
        const fetchInitialOrderState = async () => {
            try {
                const response = await api.get(`/orders/${orderId}`);
                const realOrderMetadata = response.data;
                // Keep this simulation placeholder container block until your Express GET lane mounts!
                setOrderData({
                    id: realOrderMetadata.id,
                    status: realOrderMetadata.status,
                    deliveryAddressLine: realOrderMetadata.deliveryAddressLine,
                    deliveryRecipientName: realOrderMetadata.deliveryRecipientName,
                    driverLat: 22.8046,
                    driverLng: 86.2029,
                });
            } catch (err) {
                console.error('Failed to map baseline data strings down the wire:', err);
                alert('Could not synchronize real-time vehicle positioning data registries.');

                // Safety exit: if the order reference is invalid or doesn't belong to them, slide them back home
                router.push('/');
            } finally {
                setIsLoading(false);
            }
        };

        fetchInitialOrderState();

        // 2. Open the socket connection pipeline lane securely
        const socketInstance = io('http://localhost:5000', {
            transports: ['websocket'],
            autoConnect: true,
            reconnectionAttempts: 5, // Stop spamming network nodes if backend drops hard
        });

        // 🟢 FIX 1: THE RECONNECTION EMIT: Re-joins the private tracking room layout automatically
        // if the user switches Wi-Fi networks or drops connection momentarily!
        const joinRoomContainerChannel = () => {
            console.log(`🔌 WebSocket Handshake Sync: Entering channel order_${orderId}`);
            socketInstance.emit('join_order_tracking_room', { orderId: Number(orderId) });
        };

        socketInstance.on('connect', joinRoomContainerChannel);

        // Triggers instantly if the socket recovers after a dropout gap session
        socketInstance.on('reconnect', joinRoomContainerChannel);

        // 3. Listen for coordinate drops streamed down by your backend server
        socketInstance.on(
            'driver_location_updated',
            (coordinatesPayload: DriverLocationPayload) => {
                setOrderData((prev) => {
                    if (!prev) return null;
                    return {
                        ...prev,
                        driverLat: coordinatesPayload.latitude,
                        driverLng: coordinatesPayload.longitude,
                        status: coordinatesPayload.currentStatus || prev.status,
                    };
                });
            }
        );

        // 🟢 FIX 2: BULLETPROOF DISCONNECT ERRORS: Safely unbind event nodes
        // to prevent duplicate ghost listeners from stacking up inside your browser memory threads!
        return () => {
            if (socketInstance) {
                console.log('🔌 Shutting down active WebSocket connection lanes to clear memory.');
                socketInstance.off('connect');
                socketInstance.off('reconnect');
                socketInstance.off('driver_location_updated');
                socketInstance.disconnect();
            }
        };
    }, [orderId, router]);

    if (isLoading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
                <div className="text-center space-y-2">
                    <div className="w-10 h-10 border-4 border-slate-900 border-t-transparent rounded-full animate-spin mx-auto" />
                    <p className="text-xs font-semibold text-slate-500 tracking-wide">
                        Syncing vehicle parameters...
                    </p>
                </div>
            </div>
        );
    }

    if (!orderData) return null;

    return (
        <div className="min-h-screen bg-slate-50 p-4 md:p-8 antialiased">
            <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* 🗺️ LEFT PANEL LAYOUT: Map Canvas Block Viewport */}
                <div className="lg:col-span-2 bg-white rounded-3xl p-4 border border-slate-200/60 shadow-sm min-h-[400px] md:min-h-[550px] flex flex-col justify-between relative overflow-hidden">
                    <div className="absolute inset-0 z-0">
                        <LiveTrackingMap
                            latitude={orderData.driverLat}
                            longitude={orderData.driverLng}
                        />
                    </div>

                    <Link
                        href="/"
                        className="z-10 bg-white/90 backdrop-blur text-slate-700 font-bold px-4 py-2 rounded-xl text-xs border border-slate-200/80 shadow-sm w-fit hover:bg-white transition-colors mt-auto"
                    >
                        ← Exit Viewport
                    </Link>
                </div>

                {/* 📋 RIGHT PANEL LAYOUT: Logistics Milestones Metric Card */}
                <div className="bg-white rounded-3xl p-6 border border-slate-200/60 shadow-sm flex flex-col justify-between h-fit space-y-6 z-10">
                    <div>
                        <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                            <h2 className="font-bold text-slate-900 text-base">
                                Logistics Console
                            </h2>
                            <span className="text-[10px] font-mono font-bold bg-slate-100 border border-slate-200 px-2.5 py-0.5 rounded-md text-slate-800">
                                #{orderData.id}
                            </span>
                        </div>
                        {/* Timeline tracks render beautifully below... */}
                    </div>
                </div>
            </div>
        </div>
    );
}
