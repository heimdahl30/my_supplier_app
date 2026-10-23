// apps/frontend/src/hooks/useAuth.ts
'use client'; // 🌟 Forces Next.js to compile this strictly for browser client RAM state!

import React, { createContext, useContext, useState, useEffect } from 'react';
import type { Customer } from '@my-supply-app/types';
import { usePathname } from 'next/navigation';
import { useRouter } from 'next/navigation';
import axios from 'axios';

// Contains ONLY the core baseline identity fields shared by EVERYONE on the platform
export interface AuthUser {
    id: number;
    name: string;
    email: string;
    phone: string;
    role: 'customer' | 'admin'; // Global system access clearance checks
    subRole: 'none' | 'manager' | 'warehouse' | 'driver';
    razorpaySubAccountId?: string | null; // Operation workspace targets
}

// 1. Define the structural layout contract for our global state
interface AuthState {
    user: AuthUser | null;
    isLoading: boolean;
    isAuthenticated: boolean;
}

interface AuthContextType extends AuthState {
    handleLogin: (payload: LoginCredentials) => Promise<Omit<Customer, 'passwordHash'>>;
    setAuth: React.Dispatch<React.SetStateAction<AuthState>>;
    // 🌟 ADD THESE PERSISTENT E-COMMERCE FIELDS SO THAT BACK BUTTON PRESERVES STATE
    quantities: Record<string, number>;
    setQuantities: React.Dispatch<React.SetStateAction<Record<string, number>>>;
    incrementQuantity: (id: string) => void;
    decrementQuantity: (id: string) => void;
    showAuthGateModal: boolean;
    setShowAuthGateModal: (show: boolean) => void;
    handleLogout: () => Promise<void>;
    totalBill: number;
    setTotalBill: React.Dispatch<React.SetStateAction<number>>;
}

interface LoginCredentials {
    email: Customer['email']; // 🌟 Dynamically reads whatever type string your DB uses for email
    password: string; // 🔑 Plain text raw password string from your visual input box
}

// 2. Initialize the raw React Context channel blueprint
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// 3. THE PROVIDER COMPONENT: This acts as the single master memory container
export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [auth, setAuth] = useState<AuthState>({
        user: null,
        isLoading: true,
        isAuthenticated: false,
    });

    const [totalBill, setTotalBill] = useState(0);

    const router = useRouter();

    const pathname = usePathname();

    // Lifecycle check: Auto-verify active browser cookies on initial app load
    useEffect(() => {
        async function checkActiveSession() {
            try {
                const response = await fetch('http://localhost:5000/api/v1/customers/account', {
                    method: 'GET',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include', // 🌟 THE MAGIC LINK! Forces fetch to pass your cookies!
                });

                if (response.ok) {
                    const userData = await response.json();
                    setAuth({ user: userData, isLoading: false, isAuthenticated: true });
                } else {
                    setAuth({ user: null, isLoading: false, isAuthenticated: false });
                }
            } catch (error) {
                console.error('Error checking active session:', error);
                setAuth({ user: null, isLoading: false, isAuthenticated: false });
            }
        }
        checkActiveSession();
    }, [pathname]);

    const handleLogin = async (payload: LoginCredentials) => {
        try {
            const response = await fetch('http://localhost:5000/api/v1/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                credentials: 'include',
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Authentication handshake rejected.');
            }

            const responseData = await response.json();
            const activeUserProfile = responseData.customer;
            setAuth({ user: activeUserProfile, isLoading: false, isAuthenticated: true });
            // 🚀 2. THE FIX: Fetch their long-term database-saved cart lines instantly upon login!
            try {
                const cartResponse = await axios.get('http://localhost:5000/api/v1/cart/fetch', {
                    withCredentials: true, // Crucial: Passes user identity cookies securely!
                });

                if (cartResponse.data) {
                    // Instantly update your global React state with your real database rows!
                    setQuantities(cartResponse.data);
                    console.log(
                        '🎉 Saved database basket data successfully restored to UI memory.'
                    );
                }
            } catch (cartErr) {
                console.error('Failed to restore persistent database cart rows:', cartErr);
            }
            return activeUserProfile;
        } catch (error) {
            setAuth({ user: null, isLoading: false, isAuthenticated: false });
            throw error;
        }
    };

    const handleLogout = async () => {
        try {
            // 1. Fire an empty POST request directly to your logout router path over the network
            // credentials: 'include' (or withCredentials: true) ensures the signed cookies travel safely!
            await axios.post('http://localhost:5000/api/v1/logout', {}, { withCredentials: true });

            setQuantities({});
            setTotalBill(0);
            setAuth({ user: null, isLoading: false, isAuthenticated: false });

            // 2. Smoothly cascade the browser context back to the login gateway view
            router.push('/login');
        } catch (error) {
            console.error('Frontend logout call failed to execute:', error);
            setAuth({ user: null, isLoading: false, isAuthenticated: false });
        }
    };

    // 🌟 GLOBAL LIFECYCLE MEMORY CELLS
    const [quantities, setQuantities] = useState<Record<string, number>>({});
    const [showAuthGateModal, setShowAuthGateModal] = useState(false);

    const incrementQuantity = (id: string) => {
        setQuantities((prev) => ({ ...prev, [id]: (prev[id] || 0) + 1 }));
    };

    const decrementQuantity = (id: string) => {
        setQuantities((prev) => {
            const currentQty = prev[id] || 0;
            if (currentQty <= 1) {
                const copy = { ...prev };
                delete copy[id];
                return copy;
            }
            return { ...prev, [id]: currentQty - 1 };
        });
    };

    useEffect(() => {
        // 🟢 FIXED: Check auth.user properties directly since user data is nested in the auth state!
        if (!auth.user || Object.keys(quantities).length === 0) return;

        // 🚀 THE DEBOUNCE GUARDRAIL: Awaits 800ms of click silence before hitting the wire
        const syncTimeout = setTimeout(async () => {
            try {
                const filteredItemsDict = Object.entries(quantities)
                    .filter(([, qty]) => Number(qty) > 0)
                    .reduce(
                        (acc, [productId, qty]) => {
                            acc[productId] = Number(qty);
                            return acc;
                        },
                        {} as Record<string, number>
                    );

                // Dispatch snapshot directly to your database profile endpoint mapping lanes!
                // Using standard axios block since 'api' instance isn't imported here
                await axios.post(
                    'http://localhost:5000/api/v1/cart/sync',
                    { itemsDict: filteredItemsDict },
                    { withCredentials: true } // Ensures user identity cookies pass safely
                );
                console.log('🔄 Cart state mirrored smoothly to your database profile.');
            } catch (err) {
                console.error('Failed to auto-sync backend basket rows:', err);
            }
        }, 800);

        return () => clearTimeout(syncTimeout); // Clean up timeout trackers when state shifts
    }, [quantities, auth.user]);

    // Scroll to the absolute bottom of AuthProvider and append these inside your .Provider value object:
    return (
        <AuthContext.Provider
            value={{
                ...auth,
                handleLogin,
                setAuth,
                // 🌟 BROADCAST EXPORTS:
                quantities,
                setQuantities,
                incrementQuantity,
                decrementQuantity,
                showAuthGateModal,
                setShowAuthGateModal,
                handleLogout,
                totalBill,
                setTotalBill,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}

// 4. THE CONSUMER HOOK: Simple, clean interface for your components to read the memory bubble
export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be executed within an active <AuthProvider> wrapper tree.');
    }
    return context;
}

/*
A context has three parts:
1) createContext
2) Provider
3) Consume context using useContext(name of the created context)
You put all kinds of variables, functions and even state setters inside a component which will return Provider and then you wrap all the files you want to use the context in inside this Provider component which in this case is AuthProvider.

Webhok, websocket, third party integration of maps and payment gateway from razorpay
*/
