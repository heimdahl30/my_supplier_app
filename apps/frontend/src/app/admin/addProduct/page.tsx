'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

// 🛡️ 1. SECURING DATA SCHEMAS CONTRACT VIA ZOD
const productFormSchema = z.object({
    name: z.string().min(2, { message: 'Product name must be at least 2 characters.' }),
    category: z.enum(['produce', 'dairy', 'bakery'], {
        message: 'Please select a valid grocery category.',
    }),
    price: z
        .number({ message: 'Price per unit is required.' })
        .positive('Price must be greater than zero.'),
    stockKg: z
        .number({ message: 'Initial stock volume is required.' })
        .nonnegative('Stock volume cannot be a negative value.'),
    description: z
        .string()
        .min(10, { message: 'Description must be at least 10 characters long.' })
        .max(160, { message: 'Description cannot exceed 160 characters.' }),
});

type ProductFormValues = z.infer<typeof productFormSchema>;

export default function AdminAddProductPage() {
    const router = useRouter();
    const { user, isAuthenticated, isLoading } = useAuth(); // 🌟 Read active session parameters
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [successMsg, setSuccessMsg] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // 🛡️ 2. PERIMETER AUTHENTICATION FIREWALL GUARD BLOCK
    useEffect(() => {
        // If the loading state cell is finished evaluating, execute a hard role check!
        if (!isLoading) {
            if (!isAuthenticated || !user || user.subRole !== 'manager') {
                // Security Exception: Non-managers are banished instantly back to the storefront corridor
                router.push('/store');
            }
        }
    }, [isLoading, isAuthenticated, user, router]);

    // 🏎️ 3. INITIALIZE CLIENT STATE STATE ENGINE
    const {
        register,
        handleSubmit,
        reset,
        formState: { errors },
    } = useForm<ProductFormValues>({
        resolver: zodResolver(productFormSchema),
        mode: 'onBlur',
    });

    // 1. Initial State: The network is actively checking cookies
    if (isLoading) {
        return (
            <div className="min-h-screen bg-slate-900 flex items-center justify-center text-slate-400 font-bold text-sm tracking-wider">
                🔐 VERIFYING MANAGER CREDENTIAL MATRIX...
            </div>
        );
    }

    // 2. Unauthenticated State: No user token exists in memory
    if (!user) {
        return (
            <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-slate-400 p-6 text-center">
                <span className="text-4xl">🛑</span>
                <h3 className="text-lg font-bold text-white mt-4">Access Denied</h3>
                <p className="text-xs text-slate-500 mt-1 max-w-xs">
                    You must be logged into an authorized account to access the administration
                    panel.
                </p>
                <button
                    onClick={() => router.push('/login')}
                    className="mt-6 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs uppercase px-6 py-2.5 rounded-xl tracking-wider transition"
                >
                    Go to Login
                </button>
            </div>
        );
    }

    // 3. Unauthorized State: Logged in, but they are a customer or driver, NOT a manager
    if (user.subRole !== 'manager') {
        return (
            <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-slate-400 p-6 text-center">
                <span className="text-4xl">⚠️</span>
                <h3 className="text-lg font-bold text-red-400 mt-4">Security Exception</h3>
                <p className="text-xs text-slate-500 mt-1 max-w-xs">
                    Your active account permissions do not grant access to the inventory management
                    suite.
                </p>
            </div>
        );
    }

    // 🌐 4. HANDLING SECURE BATCH CONVERSION DATA SUBMISSION
    const onSubmitHandler = async (data: ProductFormValues) => {
        setErrorMsg(null);
        setSuccessMsg(null);
        setIsSubmitting(true);

        // 🌟 THE ARRAY PAYLOAD WRAPPER MATCH:
        // Your backend requires an explicit array payload batch layout.
        // We wrap our validated form object single record straight inside an array bracket!
        const batchPayload = [
            {
                name: data.name,
                category: data.category,
                price: Number(data.price),
                stockKg: Number(data.stockKg),
                desc: data.description, // 🌟 FIXED: Map 'description' directly to 'desc'!
            },
        ];

        try {
            const response = await fetch('http://localhost:5000/api/v1/admin/products', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(batchPayload),
                credentials: 'include', // 🌟 CRITICAL: Passes cookies back so authenticateToken reads your session!
            });

            const responseData = await response.json();

            if (!response.ok) {
                throw new Error(responseData.error || 'Failed to submit inventory records.');
            }

            setSuccessMsg(
                `Inventory Updated Successfully! Added ${responseData.products?.length || 1} product.`
            );
            reset(); // Clear all data input fields natively
        } catch (err: unknown) {
            if (err instanceof Error) {
                setErrorMsg(err.message);
            } else {
                setErrorMsg('A severe infrastructure error took place during submission.');
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-900 p-8 flex flex-col justify-center items-center">
            <div className="w-full max-w-xl bg-slate-800 rounded-3xl border border-slate-700/60 p-8 shadow-2xl relative overflow-hidden">
                {/* Visual Admin Identity Tag */}
                <div className="absolute top-0 right-0 bg-amber-500/10 text-amber-500 text-[10px] font-black uppercase tracking-widest px-4 py-1.5 rounded-bl-2xl border-l border-b border-slate-700/50">
                    Manager Access Only
                </div>

                <h1 className="text-2xl font-black text-white tracking-tight">
                    Add New Catalog Product
                </h1>
                <p className="text-xs text-slate-400 mt-1">
                    Deploy fresh farm stock directly into the PostgreSQL storage rows.
                </p>

                {errorMsg && (
                    <p className="mt-4 p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-semibold rounded-xl text-center">
                        {errorMsg}
                    </p>
                )}
                {successMsg && (
                    <p className="mt-4 p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold rounded-xl text-center">
                        {successMsg}
                    </p>
                )}

                <form
                    onSubmit={handleSubmit(onSubmitHandler)}
                    className="mt-6 space-y-4"
                    noValidate
                >
                    {/* PRODUCT NAME INPUT */}
                    <div>
                        <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                            Product Name
                        </label>
                        <input
                            type="text"
                            {...register('name')}
                            placeholder="e.g. Fresh Cranberries"
                            className="w-full p-3 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-slate-500 transition"
                        />
                        {errors.name && (
                            <p className="text-red-400 text-xs mt-1 ml-1">{errors.name.message}</p>
                        )}
                    </div>

                    {/* CATEGORY SELECTOR GATE */}
                    <div>
                        <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                            Inventory Section Category
                        </label>
                        <select
                            {...register('category')}
                            className="w-full p-3 bg-slate-900 border border-slate-700 rounded-xl text-sm text-slate-300 focus:outline-none focus:border-slate-500 transition cursor-pointer"
                        >
                            <option value="">-- Choose Department --</option>
                            <option value="produce">Produce (Vegetables/Fruits)</option>
                            <option value="dairy">Dairy (Milk Products)</option>
                            <option value="bakery">Bakery (Bread/Grains)</option>
                        </select>
                        {errors.category && (
                            <p className="text-red-400 text-xs mt-1 ml-1">
                                {errors.category.message}
                            </p>
                        )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        {/* PRICE FIELD */}
                        <div>
                            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                                Price (₹ per Unit)
                            </label>
                            <input
                                type="number"
                                step="any"
                                {...register('price', { valueAsNumber: true })}
                                placeholder="e.g. 140"
                                className="w-full p-3 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-slate-500 transition"
                            />
                            {errors.price && (
                                <p className="text-red-400 text-xs mt-1 ml-1">
                                    {errors.price.message}
                                </p>
                            )}
                        </div>

                        {/* INITIAL STOCK VOLUME */}
                        <div>
                            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                                Initial Volume (Kg / Units)
                            </label>
                            <input
                                type="number"
                                {...register('stockKg', { valueAsNumber: true })}
                                placeholder="e.g. 250"
                                className="w-full p-3 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-slate-500 transition"
                            />
                            {errors.stockKg && (
                                <p className="text-red-400 text-xs mt-1 ml-1">
                                    {errors.stockKg.message}
                                </p>
                            )}
                        </div>
                    </div>
                    {/* PRODUCT DESCRIPTION INPUT */}
                    <div>
                        <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                            Product Description
                        </label>
                        <input
                            type="text"
                            {...register('description')}
                            placeholder="e.g. Crisp, sweet organic orchard apples imported from Himachal farms."
                            className="w-full p-3 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-slate-500 transition"
                        />
                        {errors.description && (
                            <p className="text-red-400 text-xs mt-1 ml-1">
                                {errors.description.message}
                            </p>
                        )}
                    </div>
                    {/* ACTION SUBMIT CONTROL */}
                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full mt-4 bg-amber-500 hover:bg-amber-600 disabled:bg-slate-700 disabled:text-slate-500 text-slate-950 p-3.5 rounded-xl font-black text-sm tracking-wide uppercase transition active:scale-98 shadow-md"
                    >
                        {isSubmitting
                            ? 'Pushing to Warehouse DB...'
                            : 'Commit Product to Inventory'}
                    </button>
                </form>
            </div>
        </div>
    );
}
