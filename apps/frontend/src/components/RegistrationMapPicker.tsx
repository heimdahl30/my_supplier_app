'use client';

import { useState, useCallback, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import type { DragEndEvent } from 'leaflet';

import 'leaflet/dist/leaflet.css';

// 🍏 1. THE ICON FIX: Added the absolute, precise file path endpoints for real image assets
const DefaultIcon = L.icon({
    iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

interface MapPickerProps {
    onLocationSelected: (lat: number, lng: number, calculatedAddress: string) => void;
    forcedCenter?: [number, number]; // 🌟 Add this parameter line
}

// 🧭 CLICK LISTENER INTERNAL COMPONENT
function MapClickHandler({
    triggerReverseGeocode,
}: {
    triggerReverseGeocode: (lat: number, lon: number) => Promise<void>;
}) {
    useMapEvents({
        click: async (e) => {
            const { lat, lng } = e.latlng;
            // ✅ Good: Simply triggers the proxy lookup, which updates the parent page automatically!
            await triggerReverseGeocode(lat, lng);
        },
    });
    return null;
}

function LeafletModalFixer() {
    const map = useMap();

    useEffect(() => {
        // Fire an immediate recalculation when the map mounts
        map.invalidateSize();

        // 🚀 Set an automated interval loop that forces size recalculations over the next second.
        // This completely counters any sliding transitions or delayed animations safely!
        const interval = setInterval(() => {
            map.invalidateSize();
        }, 100);

        // Clear the layout timer loop after 1.2 seconds to conserve browser performance
        const timeout = setTimeout(() => {
            clearInterval(interval);
            map.invalidateSize();
            console.log('🗺️ Leaflet canvas size permanently stabilized inside modal container.');
        }, 1200);

        return () => {
            clearInterval(interval);
            clearTimeout(timeout);
        };
    }, [map]);

    return null;
}

// 🎯 THE FLY-TO TELESCOPE CONTROLLER
function ChangeMapView({ center }: { center: [number, number] }) {
    const map = useMap();
    // Tells the map engine to immediately pan and zoom smoothly to the new coordinates
    map.setView(center, 15);
    return null;
}

export default function RegistrationMapPicker({
    onLocationSelected,
    forcedCenter,
}: MapPickerProps) {
    // Default fallback baseline coordinate matrix centered roughly on Jamshedpur, India if GPS fails
    const [isSearchingAddress, setIsSearchingAddress] = useState(false);

    // 🌟 THE HEALING SHIELD: Delay map engine initialization until modal animations settle completely
    const [isContainerReady, setIsContainerReady] = useState(false);

    useEffect(() => {
        // Wait exactly 250ms for 'animate-fade-in' transitions to finish rendering final bounds
        const timer = setTimeout(() => {
            setIsContainerReady(true);
        }, 250);

        return () => clearTimeout(timer);
    }, []);

    const activeCenter: [number, number] = forcedCenter ?? [22.8137, 86.169];

    // 🍏 2. THE LOOP FIX: Wrapped in useCallback so it stays locked in memory, killing infinite render crashes!
    // Inside src/components/RegistrationMapPicker.tsx
    // Ensure your component parameters destructuring line at the top looks like this:
    // export default function RegistrationMapPicker({ onLocationSelected }: RegistrationMapPickerProps) {

    const triggerReverseGeocode = useCallback(
        async (lat: number, lon: number) => {
            const url = `http://localhost:5000/api/v1/geo/reverse-geocode?lat=${lat}&lon=${lon}`;

            // 🌟 1. FIX UNUSED 'setIsSearchingAddress': Turn spinner loading state ON
            setIsSearchingAddress(true);

            try {
                const response = await fetch(url, {
                    method: 'GET',
                    headers: { 'Accept-Language': 'en' },
                });

                if (response.ok) {
                    // 🌟 2. FIX UNUSED 'data': We read the JSON payload response here
                    const data = await response.json();

                    // Extract the descriptive address text from the backend proxy payload
                    const calculatedAddress = data.display_name || 'Unknown Location';

                    // 🌟 3. FIX UNUSED 'onLocationSelected': Pass the data back up to the registration form!
                    onLocationSelected(lat, lon, calculatedAddress);
                } else {
                    console.error('Local proxy route rejected status:', response.status);
                }
            } catch (error) {
                console.error('Geocoding stream network failure:', error);
            } finally {
                // 🌟 TURN SPINNER OFF: Always runs whether the fetch succeeds or crashes
                setIsSearchingAddress(false);
            }
        },
        [onLocationSelected]
    ); // 🌟 Added to dependency array to satisfy strict TypeScript rules

    const handleMarkerDragEnd = async (event: DragEndEvent) => {
        const marker = event.target;
        const position = marker.getLatLng();

        // ✅ Good: Network fetching happens in response to a user event, not during render phases!
        await triggerReverseGeocode(position.lat, position.lng);
    };

    return (
        <div className="w-full space-y-3">
            <div className="flex items-center justify-between px-4">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    Pin Your Exact Delivery Target
                </label>
                {isSearchingAddress && (
                    <span className="text-[10px] text-amber-500 font-bold animate-pulse">
                        ⏳ Reading address coordinates...
                    </span>
                )}
            </div>

            <div className="h-64 w-full rounded-2xl overflow-hidden border border-slate-700/60 shadow-inner bg-slate-900 relative z-10">
                {isContainerReady ? (
                    <MapContainer
                        center={activeCenter}
                        zoom={15}
                        style={{ height: '100%', width: '100%' }}
                    >
                        <ChangeMapView center={activeCenter} />
                        <TileLayer
                            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png?key=cb1_3ofo_1_1719289301e0cb395842447b"
                            subdomains="abcd"
                            maxZoom={20}
                        />
                        <MapClickHandler triggerReverseGeocode={triggerReverseGeocode} />
                        {/* 🌟 CONNECT THE DRAG EVENTS HERE! */}
                        <Marker
                            position={activeCenter}
                            draggable={true} // 🟢 1. Tells Leaflet the user is allowed to physically drag this pin around
                            eventHandlers={{
                                dragend: handleMarkerDragEnd, // 🟢 2. ACTIVE LINK: Triggers your function the exact millisecond the pin is dropped!
                            }}
                        />

                        <LeafletModalFixer />
                    </MapContainer>
                ) : (
                    /* Soft off-white shroud layout filling your exact wrapper container frames natively */
                    <div className="w-full h-full flex flex-col items-center justify-center space-y-2 bg-slate-900/40 backdrop-blur-sm font-sans antialiased">
                        <span className="text-xl animate-spin text-slate-600">⏳</span>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 select-none">
                            Initializing Canvas...
                        </p>
                    </div>
                )}
            </div>

            <p className="text-[10px] text-slate-500 italic leading-relaxed">
                💡 Tip: Tap or drag anywhere on the map grid layout layout view to adjust your
                marker pin directly onto your doorstep structure lines.
            </p>
        </div>
    );
}
