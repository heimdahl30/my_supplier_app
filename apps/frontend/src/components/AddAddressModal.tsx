'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod'; // 🌟 NEW: Direct schema bridging resolver link
import * as z from 'zod';
import RegistrationMapPicker from './RegistrationMapPicker'; // Reusing your high-performance map wrapper component
import api from '@/services/api';
import { useState, useEffect } from 'react';
import axios from 'axios';

// 1. 📜 THE ZOD VALIDATION CONTRACT SCHEMA DEFINITION
const addressValidationSchema = z.object({
    label: z
        .string()
        .min(1, 'Please provide a destination tag label (e.g., Office).')
        .max(30, 'Tag name must be shorter than 30 characters.'),
    fullName: z
        .string()
        .min(2, 'Recipient full name must contain at least 2 characters.')
        .max(70, 'Recipient name cannot exceed 70 characters.'),
    phone: z
        .string()
        .min(10, 'Delivery phone contact number must be at least 10 digits.')
        .max(15, 'Delivery phone contact number cannot exceed 15 digits.')
        .regex(/^[0-9+\s-]+$/, 'Please enter a valid telephone structure layout.'),
    addressLine: z
        .string()
        .min(5, 'Please select or type a fully detailed delivery address block line.'),
    latitude: z.number({ error: 'Map marker location coordinates required.' }),
    longitude: z.number({ error: 'Map marker location coordinates required.' }),
});

// Infer our TypeScript data fields directly out of our Zod schema contract blueprint automatically!
type AddressFormInputs = z.infer<typeof addressValidationSchema>;

interface AddAddressModalProps {
    isOpen: boolean;
    onClose: () => void;
    onAddressAdded: () => void; // Refresh the parent view panel list when done
    renderKey: string; // Unique key to force re-rendering of the modal when needed
}

export default function AddAddressModal({
    isOpen,
    onClose,
    onAddressAdded,
    renderKey,
}: AddAddressModalProps) {
    const fallbackLat = 22.8137;
    const fallbackLon = 86.169;
    const [isLoading, setIsLoading] = useState(false);
    const [modalCenter, setModalCenter] = useState<[number, number]>([fallbackLat, fallbackLon]);
    const [isSearchingForward, setIsSearchingForward] = useState(false);

    // Initialize our Zod-validated state handlers cleanly
    const {
        register,
        handleSubmit,
        setValue,
        reset,
        formState: { errors },
    } = useForm<AddressFormInputs>({
        resolver: zodResolver(addressValidationSchema), // Hooks up Zod as the master validator
        mode: 'onBlur',
    });

    useEffect(() => {
        if (!isOpen) return; // Escape quickly if the modal is currently hidden from the viewport

        if (typeof window !== 'undefined' && navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                async (geoPosition) => {
                    const { latitude, longitude } = geoPosition.coords;

                    // Update local component coordinate mapping pointers smoothly
                    setModalCenter([latitude, longitude]);
                    setValue('latitude', latitude);
                    setValue('longitude', longitude);

                    // Fetch the text address via backend proxy to automatically fill the form box on load
                    try {
                        const res = await axios.get(
                            `http://localhost:5000/api/v1/geo/reverse-geocode?lat=${latitude}&lon=${longitude}`
                        );
                        if (res.data) {
                            const addressDetails = res.data.address;

                            // 🌟 THE FILTER SHIELD: Look for ultra-local neighborhood tags inside the address object!
                            const userFriendlyLocality =
                                addressDetails.suburb || addressDetails.neighbourhood || 'Sonari';
                            const formattedDisplay = `${userFriendlyLocality}, ${addressDetails.city || 'Jamshedpur'}, ${addressDetails.state || 'Jharkhand'}`;

                            // Inject the clean, human-friendly text string right into your input form box!
                            setValue('addressLine', formattedDisplay, { shouldValidate: true });
                        }
                    } catch (err) {
                        console.error('Initial GPS address lookup failed:', err);
                    }
                },
                async (error) => {
                    console.warn(
                        'GPS location request dismissed by user. Using fallback baseline matrix.',
                        error
                    );

                    // Reset state variables to your chosen default Sonari parameters seamlessly
                    setModalCenter([fallbackLat, fallbackLon]);
                    setValue('latitude', fallbackLat);
                    setValue('longitude', fallbackLon);

                    // Fetch the text address for your default baseline configurations cleanly
                    try {
                        const res = await axios.get(
                            `http://localhost:5000/api/v1/geo/reverse-geocode?lat=${fallbackLat}&lon=${fallbackLon}`
                        );
                        if (res.data?.display_name) {
                            setValue('addressLine', res.data.display_name, {
                                shouldValidate: true,
                            });
                        }
                    } catch (err) {
                        console.error('Initial fallback address lookup failed:', err);
                    }
                },
                {
                    enableHighAccuracy: true, // 🌟 CRUCIAL: Forces the device to trigger native hardware sensors rather than fuzzy IP targets!
                    timeout: 8000, // Wait up to 8 seconds for hardware confirmation response bounds
                    maximumAge: 0, // Force a fresh device coordinate poll every single time
                }
            );
        }
    }, [setValue, isOpen]); // Re-run this effect whenever the modal opens or closes

    if (!isOpen) return null; // Keep the modal completely invisible in RAM until triggered

    const onSubmit = async (data: AddressFormInputs) => {
        setIsLoading(true);
        try {
            // Fires network call down to your brand new backend route: POST /api/v1/customers/addresses
            await api.post('/customers/addresses', data);
            alert('📍 New delivery destination pinned successfully!');
            reset(); // Flush fields cleanly
            onAddressAdded(); // Tell the checkout/profile page to reload the listing cards array
            onClose(); // Shut the modal overlay window
        } catch (error) {
            if (axios.isAxiosError(error)) {
                alert(
                    error.response?.data?.error || 'Failed to register the new address location.'
                );
            } else {
                // 2. Fallback channel for normal non-network programming code errors (like syntax glitches)
                const structuralError =
                    error instanceof Error
                        ? error.message
                        : 'An unexpected execution error occurred.';
                alert(`❌ System Error: ${structuralError}`);
            }
        } finally {
            setIsLoading(false);
        }
    };

    const handleAddressBlur = async (e: React.FocusEvent<HTMLInputElement>) => {
        const textQuery = e.target.value;
        if (!textQuery || textQuery.length < 5) return;

        setIsSearchingForward(true);

        try {
            const response = await axios.get(
                `http://localhost:5000/api/v1/geo/search-address?q=${encodeURIComponent(textQuery)}`
            );
            if (response.data && response.data.length > 0) {
                const firstResult = response.data[0];
                const newLat = parseFloat(firstResult.lat);
                const newLon = parseFloat(firstResult.lon);

                // 🚀 SNAP THE MAP VIEWPORT VIEW!
                setModalCenter([newLat, newLon]);
                setValue('latitude', newLat);
                setValue('longitude', newLon);
            }
        } catch (err) {
            console.error('Failed to sync map view from typed address layout:', err);
        } finally {
            setIsSearchingForward(false);
        }
    };

    return (
        <div
            key={renderKey}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in"
        >
            <div className="bg-white w-full max-w-xl rounded-3xl p-6 shadow-xl max-h-[100vh] overflow-y-auto space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <h3 className="text-lg font-black text-slate-900">Add Delivery Destination</h3>
                    <button
                        onClick={onClose}
                        className="text-slate-400 hover:text-slate-600 font-bold text-sm"
                    >
                        Cancel
                    </button>
                </div>

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                    {/* 🗺️ INTERACTIVE MAP PINPOINT PORTAL */}

                    <RegistrationMapPicker
                        key="checkout-delivery-destination-map"
                        forcedCenter={modalCenter}
                        onLocationSelected={(lat, lng, calculatedAddress) => {
                            setModalCenter([lat, lng]);
                            setValue('latitude', lat);
                            setValue('longitude', lng);
                            setValue('addressLine', calculatedAddress, {
                                shouldValidate: true,
                            });
                        }}
                    />

                    {/* LABEL SELECTION TRACK (Home, Office, etc) */}
                    <div className="w-full">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">
                            Destination Label
                        </label>
                        <input
                            type="text"
                            placeholder="e.g., Office, In-Laws House, Gym"
                            {...register('label', { required: 'Label indicator is required' })}
                            className={`w-full p-3 border rounded-xl focus:outline-none text-sm font-semibold ${
                                errors.label ? 'border-red-500 bg-red-50/10' : 'border-slate-200'
                            }`}
                        />
                        {errors.label && (
                            <p className="text-red-500 text-xs mt-1">{errors.label.message}</p>
                        )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        {/* FULL NAME FIELD */}
                        <div>
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">
                                Recipient Name
                            </label>
                            <input
                                type="text"
                                placeholder="Contact Name"
                                {...register('fullName', { required: 'Name record is required' })}
                                className={`w-full p-3 border rounded-xl focus:outline-none text-sm font-semibold transition ${
                                    errors.fullName
                                        ? 'border-red-500 bg-red-50/10'
                                        : 'border-slate-200'
                                }`}
                            />
                            {/* 🌟 ADDED: Dynamic Error Message Alert Display Block */}
                            {errors.fullName && (
                                <p className="text-red-500 text-xs mt-1 font-medium">
                                    {errors.fullName.message}
                                </p>
                            )}
                        </div>

                        {/* PHONE FIELD FOR DELIVERY DRIVER */}
                        <div>
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">
                                Delivery Phone
                            </label>
                            <input
                                type="text"
                                placeholder="Phone Number"
                                {...register('phone', {
                                    required: 'Phone string contact is required',
                                })}
                                className={`w-full p-3 border rounded-xl focus:outline-none text-sm font-semibold transition ${
                                    errors.phone
                                        ? 'border-red-500 bg-red-50/10'
                                        : 'border-slate-200'
                                }`}
                            />
                            {/* 🌟 ADDED: Dynamic Error Message Alert Display Block */}
                            {errors.phone && (
                                <p className="text-red-500 text-xs mt-1 font-medium">
                                    {errors.phone.message}
                                </p>
                            )}
                        </div>
                    </div>

                    {/* TEXT ADDRESS PREVIEW FIELD */}
                    <div>
                        <div className="flex justify-between items-center mb-1">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">
                                Address Details
                            </label>
                            {isSearchingForward && (
                                <span className="text-[10px] text-indigo-400 font-bold animate-pulse">
                                    🔍 Locating address on map...
                                </span>
                            )}
                        </div>
                        <input
                            type="text"
                            placeholder="Pin location on the map above to auto-populate"
                            {...register('addressLine', {
                                required: 'Address text description is required',
                                onBlur: (e) => handleAddressBlur(e),
                            })}
                            className={`w-full p-3 border rounded-xl focus:outline-none transition ${
                                errors.addressLine
                                    ? 'border-red-500 bg-red-50/10'
                                    : 'border-slate-200'
                            }`}
                        />
                        {errors.addressLine && (
                            <p className="text-red-500 text-xs mt-1 font-medium">
                                {errors.addressLine.message}
                            </p>
                        )}
                    </div>

                    {/* ACTION CONTROLLERS */}
                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white p-3.5 rounded-2xl font-black text-sm tracking-wide transition active:scale-98 disabled:bg-slate-100 disabled:text-slate-400 shadow-md"
                    >
                        {isLoading ? 'Pinning Location...' : 'Save & Secure Address'}
                    </button>
                </form>
            </div>
        </div>
    );
}
