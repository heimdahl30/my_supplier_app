'use client';

import axios from 'axios';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import dynamic from 'next/dynamic';
import 'leaflet/dist/leaflet.css'; // 🌟 MUST IMPORT LEAFLET CSS STYLES TO PREVENT GRIDS FROM ALIGNMENT SPLITTING!

// Force Next.js to render the map component exclusively on client-side browser runtime environments
const RegistrationMapPicker = dynamic(() => import('@/components/RegistrationMapPicker'), {
    ssr: false,
    loading: () => (
        <div className="h-64 w-full bg-slate-800 rounded-2xl flex items-center justify-center text-slate-500 text-xs font-bold">
            📡 INITIALIZING DIGITAL MAP RADAR GATES...
        </div>
    ),
});

const registerSchema = z
    .object({
        name: z.string().min(2, 'Name must be at least 2 characters.'),
        phone: z.string().min(10, 'Please enter a valid phone number.'),
        email: z.email({ message: 'Please enter a valid email address.' }),
        password: z.string().min(6, 'Password must be at least 6 characters.'),
        confirmPassword: z.string(),
        address: z.string().min(5, 'Please provide a valid delivery address.'),
        latitude: z
            .number()
            .refine((val) => val !== 0, { message: 'Please select a valid location on the map.' }),
        longitude: z
            .number()
            .refine((val) => val !== 0, { message: 'Please select a valid location on the map.' }),
    })
    .refine((data) => data.password === data.confirmPassword, {
        message: 'Passwords do not match.',
        path: ['confirmPassword'], // 🌟 Automatically pins the error directly to the confirm box tracker state!
    });

// Extract TypeScript types directly out of our Zod security schema blueprint
type RegisterFormValues = z.infer<typeof registerSchema>;

const RegistrationPage = () => {
    const router = useRouter();
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    const [mapCenter, setMapCenter] = useState<[number, number]>([22.8137, 86.169]);

    const [addressLabel, setAddressLabel] = useState<'Home' | 'Office' | 'Other'>('Home');
    const [customLabelText, setCustomLabelText] = useState('');

    // 🏎️ 2. INITIALIZE THE REACT HOOK FORM STATE ENGINE
    const {
        register,
        handleSubmit,
        setValue,
        formState: { errors },
    } = useForm<RegisterFormValues>({
        defaultValues: {
            name: '',
            phone: '',
            email: '',
            password: '',
            // 🌟 THE SYNC LAYER: Set your baseline default address values directly here!
            address: 'Sonari, Jamshedpur, Jharkhand, India',
            latitude: 22.8137,
            longitude: 86.169,
        },
        resolver: zodResolver(registerSchema),
        mode: 'onBlur', // 🔍 Re-evaluates validation errors the exact millisecond user leaves a field input!
    });

    // 🍏 2. THE MOVED LIFECYCLE EFFECT: Executes safely right here in the parent!
    useEffect(() => {
        if ('geolocation' in navigator) {
            navigator.geolocation.getCurrentPosition(
                async (geoPosition) => {
                    const { latitude, longitude } = geoPosition.coords;

                    // Update master parent location coordinates
                    setMapCenter([latitude, longitude]);
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
                            // This checks if fields like 'suburb', 'neighbourhood', or 'road' exist, and falls back to display_name if they don't.
                            const userFriendlyLocality =
                                addressDetails.suburb || addressDetails.neighbourhood || 'Sonari';
                            const formattedDisplay = `${userFriendlyLocality}, ${addressDetails.city || 'Jamshedpur'}, ${addressDetails.state || 'Jharkhand'}`;

                            // Inject the clean, human-friendly text string right into your input form box!
                            setValue('address', formattedDisplay, { shouldValidate: true });
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

                    const fallbackLat = 22.8137;
                    const fallbackLon = 86.169;

                    // Update parent state cleanly to your chosen Sonari defaults!
                    setMapCenter([fallbackLat, fallbackLon]);
                    setValue('latitude', fallbackLat);
                    setValue('longitude', fallbackLon);

                    // Fetch the text address for Sonari fallback values cleanly
                    try {
                        const res = await axios.get(
                            `http://localhost:5000/api/v1/geo/reverse-geocode?lat=${fallbackLat}&lon=${fallbackLon}`
                        );
                        if (res.data?.display_name) {
                            setValue('address', res.data.display_name, { shouldValidate: true });
                        }
                    } catch (err) {
                        console.error('Initial fallback address lookup failed:', err);
                    }
                }
            );
        }
    }, [setValue]); // Stable hook form reference handles compilation without warnings!

    const onSubmitHandler = async (data: RegisterFormValues) => {
        setErrorMsg(null);
        setIsLoading(true);

        try {
            const finalLabel =
                addressLabel === 'Other'
                    ? customLabelText.trim() || 'Other Location'
                    : addressLabel;

            // 🌟 2. STITCH THE PAYLOAD: Mix the form data and the dynamic label together!
            const finalPayload = {
                ...data,
                addressLabel: finalLabel, // Attaches your clean text nickname (e.g., "Sonu's Flat")
            };

            const response = await fetch('http://localhost:5000/api/v1/customers/signup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(finalPayload),
            });

            const user = await response.json();

            if (!response.ok) {
                throw new Error(user.error || 'Registration failed.');
            }

            // Redirect to login page after successful registration
            router.push('/login');
        } catch (error: unknown) {
            if (error instanceof Error) {
                setErrorMsg(error.message);
            } else {
                setErrorMsg('An unexpected error occurred during registration.');
            }
        } finally {
            setIsLoading(false);
        }
    };

    const handleAddressBlur = async (e: React.FocusEvent<HTMLInputElement>) => {
        const textQuery = e.target.value;
        if (!textQuery || textQuery.length < 5) return;

        try {
            const response = await axios.get(
                `http://localhost:5000/api/v1/geo/search-address?q=${encodeURIComponent(textQuery)}`
            );
            if (response.data && response.data.length > 0) {
                const firstResult = response.data[0];
                const newLat = parseFloat(firstResult.lat);
                const newLon = parseFloat(firstResult.lon);

                // 🚀 SNAP THE MAP VIEWPORT VIEW!
                setMapCenter([newLat, newLon]);
                setValue('latitude', newLat);
                setValue('longitude', newLon);
            }
        } catch (err) {
            console.error('Failed to sync map view from typed address layout:', err);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
            <form
                className="w-full max-w-md rounded-2xl shadow-xl bg-white p-10"
                onSubmit={handleSubmit(onSubmitHandler)}
                noValidate
            >
                <h1 className="text-2xl text-center font-bold mb-6">Register</h1>
                {errorMsg && <p className="text-red-500 mb-4 text-sm text-center">{errorMsg}</p>}
                <div className="w-full mb-4">
                    <input
                        type="text"
                        placeholder="Name"
                        {...register('name')}
                        className={`w-full p-2 border rounded-md focus:outline-none transition ${
                            errors.name ? 'border-red-500 bg-red-50/10' : 'border-slate-200'
                        }`}
                    />
                    {errors.name && (
                        <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>
                    )}
                </div>

                {/* PHONE FIELD */}
                <div className="w-full mb-4">
                    <input
                        type="text"
                        placeholder="Phone"
                        {...register('phone')}
                        className={`w-full p-2 border rounded-md focus:outline-none transition ${
                            errors.phone ? 'border-red-500 bg-red-50/10' : 'border-slate-200'
                        }`}
                    />
                    {errors.phone && (
                        <p className="text-red-500 text-xs mt-1">{errors.phone.message}</p>
                    )}
                </div>

                {/* EMAIL FIELD */}
                <div className="w-full mb-4">
                    <input
                        type="email"
                        placeholder="Email"
                        {...register('email')}
                        className={`w-full p-2 border rounded-md focus:outline-none transition ${
                            errors.email ? 'border-red-500 bg-red-50/10' : 'border-slate-200'
                        }`}
                    />
                    {errors.email && (
                        <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>
                    )}
                </div>

                {/* PASSWORD FIELD WITH FLOATING TOGGLE ICON */}
                <div className="w-full mb-4">
                    <div className="relative">
                        <input
                            type={showPassword ? 'text' : 'password'}
                            placeholder="Password"
                            {...register('password')}
                            className={`w-full p-3 pr-10 text-sm border rounded-md bg-slate-50/50 focus:outline-none transition ${
                                errors.password ? 'border-red-500' : 'border-slate-200'
                            }`}
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition"
                        >
                            {showPassword ? '🙈' : '👁️'}
                        </button>
                    </div>
                    {errors.password && (
                        <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>
                    )}
                </div>

                {/* CONFIRM PASSWORD FIELD INTEGRATED INTO SCHEMA COMPARISON */}
                <div className="w-full mb-4">
                    <div className="relative">
                        <input
                            type={showConfirmPassword ? 'text' : 'password'}
                            placeholder="Confirm Password"
                            {...register('confirmPassword')}
                            className={`w-full p-3 pr-10 text-sm border rounded-md bg-slate-50/50 transition focus:outline-none ${
                                errors.confirmPassword
                                    ? 'border-red-500 focus:ring-1 focus:ring-red-500 bg-red-50/10'
                                    : 'border-slate-200'
                            }`}
                        />
                        <button
                            type="button"
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition"
                        >
                            {showConfirmPassword ? '🙈' : '👁️'}
                        </button>
                    </div>
                    {errors.confirmPassword && (
                        <p className="text-[13px] font-semibold text-red-600 mt-1 ml-1 animate-pulse">
                            ⚠️ {errors.confirmPassword.message}
                        </p>
                    )}
                </div>

                {/* 🗺️ INTERACTIVE MAP POSITIONING PORTAL */}
                <RegistrationMapPicker
                    forcedCenter={mapCenter}
                    onLocationSelected={(lat, lng, calculatedAddress) => {
                        // Automatically inject the values straight into your Zod-validated state handlers!
                        setMapCenter([lat, lng]);
                        setValue('latitude', lat);
                        setValue('longitude', lng);
                        setValue('address', calculatedAddress, { shouldValidate: true });
                    }}
                />

                {/* ADDRESS FIELD */}
                <div className="w-full mb-4">
                    <input
                        type="text"
                        placeholder="Address"
                        {...register('address')}
                        onBlur={handleAddressBlur} // 🌟 TRIGGER THE SYNC: Fires when the user clicks out or finishes typing!
                        className={`w-full p-2 border rounded-md focus:outline-none transition ${
                            errors.address ? 'border-red-500 bg-red-50/10' : 'border-slate-200'
                        }`}
                    />
                    {errors.address && (
                        <p className="text-red-500 text-xs mt-1">{errors.address.message}</p>
                    )}
                </div>
                <div className="w-full mb-4">
                    <label className="block text-sm font-semibold text-slate-600 mb-2">
                        Label this delivery address as:
                    </label>

                    {/* Clean Button Row */}
                    <div className="flex gap-2 mb-3">
                        {(['Home', 'Office', 'Other'] as const).map((lbl) => (
                            <button
                                key={lbl}
                                type="button"
                                onClick={() => setAddressLabel(lbl)}
                                className={`px-4 py-2 rounded-xl text-sm font-bold border transition active:scale-95 ${
                                    addressLabel === lbl
                                        ? 'bg-blue-50 border-blue-500 text-blue-600'
                                        : 'bg-white border-slate-200 text-slate-600'
                                }`}
                            >
                                {lbl === 'Home' && '🏠 Home'}
                                {lbl === 'Office' && '🏢 Office'}
                                {lbl === 'Other' && '📍 Other'}
                            </button>
                        ))}
                    </div>

                    {/* 🌟 THE DYNAMIC NICKNAME INPUT: Only slides open if "Other" is actively selected! */}
                    {addressLabel === 'Other' && (
                        <div className="animate-fadeIn">
                            <input
                                type="text"
                                placeholder="Give this location a nickname (e.g., Sonu's Flat, Factory Gate 2, Gym)..."
                                value={customLabelText}
                                onChange={(e) => setCustomLabelText(e.target.value)}
                                className="w-full p-2.5 text-sm border border-slate-200 rounded-xl focus:border-blue-500 focus:outline-none bg-slate-50/50"
                                maxLength={25} // Keeps the text block crisp so it doesn't break UI layout boxes later
                            />
                        </div>
                    )}
                </div>

                {/* SUBMIT ACTION CONTROLLER */}
                <button
                    type="submit"
                    disabled={isLoading}
                    className={`w-full mt-2 p-3 rounded-xl font-bold text-md tracking-wide transition ${isLoading ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 text-white active:scale-95'}`}
                >
                    {isLoading ? 'Registering...' : 'Register'}
                </button>
            </form>
        </div>
    );
};

export default RegistrationPage;
