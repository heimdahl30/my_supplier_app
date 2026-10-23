'use client';

import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';

// 🚀 THE UNBREAKABLE SHIELD: Explicitly import core Leaflet layout styles right here!
import 'leaflet/dist/leaflet.css';

// 🧭 AUTOMATED TELESCOPE CONTROLLER: Smoothly pans the map camera to track the driver in real-time
function MoveMapCamera({ center }: { center: [number, number] }) {
    const map = useMap();
    useEffect(() => {
        if (center && center[0] !== 0) {
            // Smoothly glide the viewport camera straight to the new coordinates coordinates footprint
            map.setView(center, 15);
        }
    }, [center, map]);
    return null;
}

// THE ICON CONTROLLER: Point to verified image links to stop markers from turning invisible
const DriverIcon = L.icon({
    iconUrl: '/delivery-bike.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
});

interface LiveTrackingMapProps {
    latitude: number;
    longitude: number;
}

export default function LiveTrackingMap({ latitude, longitude }: LiveTrackingMapProps) {
    const positionCoordinates: [number, number] = [latitude, longitude];

    return (
        <MapContainer
            center={positionCoordinates}
            zoom={15}
            style={{ height: '100%', width: '100%', borderRadius: '1.5rem' }}
            zoomControl={true}
        >
            {/* Smooth camera transitions hook */}
            <MoveMapCamera center={positionCoordinates} />

            {/* Standard baseline OpenStreetMap tile grid map layer paths */}
            <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png?key=cb1_3ofo_1_1719289301e0cb395842447b"
                subdomains="abcd"
                maxZoom={20}
            />

            {/* 🚴 THE VECHILE MARKER PIN: Tied straight to your streaming WebSocket coordinates! */}
            <Marker position={positionCoordinates} icon={DriverIcon} />
        </MapContainer>
    );
}
