// apps/frontend/src/app/login/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

const loginSchema = z.object({
    email: z.email({ message: 'Please enter a valid email address.' }),
    password: z.string().min(6, 'Password must be at least 6 characters.'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
    const router = useRouter();
    const { handleLogin, isLoading, user, isAuthenticated } = useAuth();
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    // 🛡️ THE ARCHITECTURAL COMPONENT GUARD FIREWALL
    // This hook automatically routes authenticated traffic away based on their database role
    useEffect(() => {
        if (isAuthenticated && user) {
            console.log('💎 AUTH STATE GUARDRAIL HIT:', {
                role: user.role,
                subRole: user.subRole,
                rawUserObject: user,
            });
            if (user.role === 'admin' && user.subRole === 'manager') {
                router.push('/admin/ledger');
            } else if (user.role === 'admin' && user.subRole === 'warehouse') {
                router.push('/admin/ordersReceived');
            } else if (user.role === 'admin' && user.subRole === 'driver') {
                router.push('/admin/packedOrders');
            } else {
                router.push('/store'); // Everyday grocery buyers land straight in the storefront catalog!
            }
        }
    }, [isAuthenticated, user, router]);

    const {
        register,
        handleSubmit,
        formState: { errors },
    } = useForm<LoginFormValues>({
        resolver: zodResolver(loginSchema),
        mode: 'onBlur', // Validate on blur for better UX
    });

    const onSubmitHandler = async (data: LoginFormValues) => {
        setErrorMsg(null);

        try {
            const loggedInUser = await handleLogin({ email: data.email, password: data.password });
            // Role-based routing
            if (loggedInUser.subRole === 'manager') router.push('/admin/ledger');
            else if (loggedInUser.subRole === 'warehouse') router.push('/admin/ordersReceived');
            else if (loggedInUser.subRole === 'driver') router.push('/admin/packedOrders');
            else router.push('/store');
        } catch (err: unknown) {
            // 🛡️ TYPE GUARD: Safely verify if 'err' is an official instance of the Error class
            if (err instanceof Error) {
                setErrorMsg(err.message);
            } else {
                // Fallback for edge cases where a raw string or unmapped object was thrown
                setErrorMsg('An unexpected authentication error took place.');
            }
        }
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-slate-50">
            <form
                onSubmit={handleSubmit(onSubmitHandler)}
                className="p-8 bg-white rounded-2xl shadow-xl w-full max-w-md"
            >
                <h1 className="text-2xl font-bold text-center mb-4">Logistics Portal Sign-In</h1>
                {errorMsg && <p className="text-red-600 text-sm">{errorMsg}</p>}
                <div className="mb-4">
                    <input
                        type="email"
                        {...register('email')}
                        placeholder="Email"
                        className={`w-full p-2 border rounded-md focus:outline-none transition ${
                            errors.email ? 'border-red-500 bg-red-50/10' : 'border-slate-200'
                        }`}
                    />
                    {errors.email && <p className="text-red-600 text-sm">{errors.email.message}</p>}
                </div>
                <div>
                    <input
                        type="password"
                        {...register('password')}
                        placeholder="Password"
                        className={`w-full p-2 border rounded-md focus:outline-none transition ${
                            errors.password ? 'border-red-500 bg-red-50/10' : 'border-slate-200'
                        }`}
                    />
                    {errors.password && (
                        <p className="text-red-600 text-sm">{errors.password.message}</p>
                    )}
                </div>
                <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full mt-6 bg-blue-600 text-white p-3 rounded-xl font-bold text-md tracking-wide transition"
                >
                    {isLoading ? 'Signing In...' : 'Sign In'}
                </button>
            </form>
        </div>
    );
}
