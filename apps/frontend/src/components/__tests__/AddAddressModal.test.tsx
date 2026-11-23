import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeAll, afterEach, afterAll } from 'vitest';
import { setupServer } from 'msw/node';
import { http, HttpResponse, type DefaultBodyType } from 'msw';
import AddAddressModal from '../AddAddressModal';
import axios from 'axios';
import api from '@/services/api';

// Force Axios to use Node's http adapter instead of jsdom's CORS-blocked XMLHttpRequest
axios.defaults.adapter = 'http';
api.defaults.adapter = 'http';

// 1. MOCK REACT-LEAFLET: Capture the click handler from MapClickHandler
let savedMapClick: ((e: { latlng: { lat: number; lng: number } }) => void) | undefined;

vi.mock('react-leaflet', () => ({
    MapContainer: ({ children }: { children: React.ReactNode }) => (
        <div data-testid="mock-map-container">
            {children}
            <button
                type="button"
                data-testid="simulate-map-click"
                onClick={() => savedMapClick?.({ latlng: { lat: 22.8046, lng: 86.2029 } })}
            >
                Click Map
            </button>
        </div>
    ),
    TileLayer: () => <div data-testid="mock-tile-layer" />,
    Marker: () => <div data-testid="mock-marker" />,
    useMapEvents: (handlers: { click?: (e: { latlng: { lat: number; lng: number } }) => void }) => {
        savedMapClick = handlers.click;
        return null;
    },
    useMap: () => ({
        setView: vi.fn(),
        invalidateSize: vi.fn(),
    }),
}));

// 2. MOCK BROWSER GPS HARDWARE (watchPosition + clearWatch)
const mockGeolocation = {
    getCurrentPosition: vi.fn(),
    watchPosition: vi.fn((success) => {
        success({
            coords: {
                latitude: 22.81,
                longitude: 86.21,
            },
        });
        return 1;
    }),
    clearWatch: vi.fn(),
};

Object.defineProperty(global.navigator, 'geolocation', {
    value: mockGeolocation,
    writable: true,
});

// 3. MOCK BACKEND APIs (Reverse Geocoding + Save Address POST)
let submittedPayload: DefaultBodyType = null;

const server = setupServer(
    http.get('http://localhost:5000/api/v1/geo/reverse-geocode', ({ request }) => {
        const url = new URL(request.url);
        const lat = url.searchParams.get('lat');

        // When map is clicked at 22.8046
        if (lat === '22.8046') {
            return HttpResponse.json({
                display_name: 'Bistupur, Jamshedpur, Jharkhand',
                address: {
                    suburb: 'Bistupur',
                    city: 'Jamshedpur',
                    state: 'Jharkhand',
                },
            });
        }

        // Default initial GPS load (lat 22.81)
        return HttpResponse.json({
            display_name: 'Sonari, Jamshedpur, Jharkhand',
            address: {
                suburb: 'Sonari',
                city: 'Jamshedpur',
                state: 'Jharkhand',
            },
        });
    }),

    // Intercept the final form submission
    http.post('*/api/v1/customers/addresses', async ({ request }) => {
        submittedPayload = await request.json();
        return HttpResponse.json({ message: 'Address saved' }, { status: 201 });
    })
);

beforeAll(() => {
    server.listen();
    vi.spyOn(window, 'alert').mockImplementation(() => {}); // Silence browser alert() popups
});

afterEach(() => {
    server.resetHandlers();
    vi.clearAllMocks();
    submittedPayload = null;
});

afterAll(() => {
    server.close();
    vi.restoreAllMocks();
});

// 4. INTEGRATION TESTS
describe('AddAddressModal Integration Suite', () => {
    it('auto-fills the address input on load using browser geolocation', async () => {
        render(
            <AddAddressModal
                isOpen={true}
                onClose={vi.fn()}
                onAddressAdded={vi.fn()}
                renderKey="modal-1"
            />
        );

        // Wait for initial GPS watchPosition -> reverse-geocode -> setValue('addressLine')
        await waitFor(() => {
            const addressInput = screen.getByPlaceholderText(
                'Pin location on the map above to auto-populate'
            ) as HTMLInputElement;
            expect(addressInput.value).toBe('Sonari, Jamshedpur, Jharkhand');
        });
    });

    it('updates address text on map click and submits the validated form payload', async () => {
        const onAddressAddedMock = vi.fn();
        const onCloseMock = vi.fn();

        render(
            <AddAddressModal
                isOpen={true}
                onClose={onCloseMock}
                onAddressAdded={onAddressAddedMock}
                renderKey="modal-2"
            />
        );

        // 1. Wait for initial load to finish first
        const addressInput = screen.getByPlaceholderText(
            'Pin location on the map above to auto-populate'
        ) as HTMLInputElement;
        await waitFor(() => expect(addressInput.value).toBe('Sonari, Jamshedpur, Jharkhand'));

        // 2. Click the simulated map button to pick Bistupur (22.8046, 86.2029)
        const mapClickBtn = await screen.findByTestId('simulate-map-click');
        fireEvent.click(mapClickBtn);

        // 3. Verify addressLine updated to Bistupur
        await waitFor(() => {
            expect(addressInput.value).toContain('Bistupur');
        });

        // 4. Fill out the remaining required form fields
        fireEvent.change(screen.getByPlaceholderText('e.g., Office, In-Laws House, Gym'), {
            target: { value: 'Home' },
        });
        fireEvent.change(screen.getByPlaceholderText('Contact Name'), {
            target: { value: 'Abhinav Singh' },
        });
        fireEvent.change(screen.getByPlaceholderText('Phone Number'), {
            target: { value: '9876543210' },
        });

        // 5. Submit the form
        fireEvent.click(screen.getByRole('button', { name: /Save & Secure Address/i }));

        // 6. Verify backend API received the exact coordinates & callbacks fired
        await waitFor(() => {
            expect(submittedPayload).toMatchObject({
                label: 'Home',
                fullName: 'Abhinav Singh',
                phone: '9876543210',
                latitude: 22.8046,
                longitude: 86.2029,
            });
            expect(onAddressAddedMock).toHaveBeenCalledTimes(1);
            expect(onCloseMock).toHaveBeenCalledTimes(1);
        });
    });
});
