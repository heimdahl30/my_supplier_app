'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation'; // 🌟 Make sure it is from 'next/navigation'!
import Link from 'next/link';

type Category = 'produce' | 'dairy' | 'bakery' | 'fallback';

// 🎨 1. THE DESIGN THEME DICTIONARY LOOKUP (Write it right here outside the function!)
const CATEGORY_THEMES: Record<
    Category,
    {
        bg: string;
        textTheme: string;
        borderTheme: string;
        hoverBg: string;
        emoji: string;
        unit: string;
    }
> = {
    produce: {
        bg: 'bg-emerald-50',
        textTheme: 'text-emerald-600',
        borderTheme: 'border-emerald-100',
        hoverBg: 'hover:bg-emerald-50/50',
        emoji: '🥦',
        unit: 'kg',
    },
    dairy: {
        bg: 'bg-blue-50',
        textTheme: 'text-blue-600',
        borderTheme: 'border-blue-100',
        hoverBg: 'hover:bg-blue-50/50',
        emoji: '🥛',
        unit: 'L',
    },
    bakery: {
        bg: 'bg-amber-50',
        textTheme: 'text-amber-600',
        borderTheme: 'border-amber-100',
        hoverBg: 'hover:bg-amber-50/50',
        emoji: '🍞',
        unit: 'pc',
    },
    fallback: {
        bg: 'bg-slate-50',
        textTheme: 'text-slate-600',
        borderTheme: 'border-slate-100',
        hoverBg: 'hover:bg-slate-50/50',
        emoji: '📦',
        unit: 'item',
    },
};

const OFFERS_CAROUSEL = [
    {
        id: 'slide_1',
        title: 'Monsoon Groceries Flash Deal',
        subtitle: 'Get flat 20% instant cashback on all organic farm vegetables.',
        code: 'FRESH20',
        gradient: 'from-emerald-600 to-teal-700',
        badge: 'Flash Sale 🥦',
    },
    {
        id: 'slide_2',
        title: 'Pure Dairy Morning Subscriptions',
        subtitle: 'Subscribe to daily milk bottles and unlock free shipping for 30 days.',
        code: 'MILKFREE',
        gradient: 'from-blue-600 to-indigo-700',
        badge: 'Dairy Special 🥛',
    },
    {
        id: 'slide_3',
        title: 'Direct Orchard Harvest Week',
        subtitle: 'Fresh red apples and seasonal fruits directly imported from Himachal farms.',
        code: 'HARVEST15',
        gradient: 'from-red-600 to-rose-700',
        badge: 'Orchard Pick 🍎',
    },
    {
        id: 'slide_4',
        title: 'Direct Orchard Harvest Week',
        subtitle: 'Fresh oranges and seasonal fruits directly imported from Nasik farms.',
        code: 'HARVEST15',
        gradient: 'from-orange-600 to-amber-700',
        badge: 'Orchard Pick 🍊',
    },
];

interface Product {
    id: string;
    name: string;
    category: string;
    pricePerKg: number;
    stockKg: number;
    desc: string;
    type: string;
}

export default function GroceryStorefront() {
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [isCartOpen, setIsCartOpen] = useState(false);
    const [activeSlide, setActiveSlide] = useState(0);
    const [promoInput, setPromoInput] = useState('');
    const [appliedDiscount, setAppliedDiscount] = useState(0); // Holds percentage (e.g., 20)
    const [promoError, setPromoError] = useState<string | null>(null);
    const [promoSuccess, setPromoSuccess] = useState<string | null>(null);
    const [products, setProducts] = useState<Product[]>([]);

    // 🌟 THE ENTERPRISE STATE MAP SINGLETON
    const {
        user,
        handleLogout,
        isAuthenticated,
        quantities,
        incrementQuantity,
        decrementQuantity,
        showAuthGateModal,
        setShowAuthGateModal,
        setTotalBill,
    } = useAuth(); // 🍏 Directly intercepts our persistent layout memory vault tracks!

    const router = useRouter();

    // To get product catalogue
    useEffect(() => {
        // 🍏 A clean, standard single-pass data fetch loop on page mount
        async function fetchInitialCatalogSnapshot() {
            try {
                const response = await fetch('http://localhost:5000/api/v1/products', {
                    method: 'GET',
                    headers: { 'Content-Type': 'application/json' },
                });
                if (response.ok) {
                    const data = await response.json();
                    setProducts(data.products); // Save the database array directly to state
                }
            } catch (error) {
                console.error('Failed loading product rows:', error);
            }
        }

        fetchInitialCatalogSnapshot();
    }, []); // 🌟 Empty bracket dependency means it runs ONCE and steps out of the way!

    const subtotal = products.reduce(
        (acc, curr) => acc + (quantities[curr.id] || 0) * curr.pricePerKg,
        0
    );

    // 2. Compute absolute reduction cost value based on percentage state
    const discountAmount = (subtotal * appliedDiscount) / 100;

    // 3. Subtract reduction value from subtotal target safely
    const finalTotal = subtotal - discountAmount;

    useEffect(() => {
        setTotalBill(finalTotal);
    }, [finalTotal, setTotalBill]);

    const handleApplyPromo = () => {
        setPromoError(null);
        setPromoSuccess(null);

        // Find if the typed code matches any valid code in our offers carousel array
        const matchedOffer = OFFERS_CAROUSEL.find(
            (offer) => offer.code.toUpperCase() === promoInput.trim().toUpperCase()
        );

        if (!matchedOffer) {
            setPromoError('Invalid coupon code. Please try again.');
            setAppliedDiscount(0);
            return;
        }

        // Apply specific discount percentages based on the matched coupon code rules
        if (matchedOffer.code === 'FRESH20') setAppliedDiscount(20);
        else if (matchedOffer.code === 'MILKFREE')
            setAppliedDiscount(10); // e.g., 10% off value instead of shipping
        else if (matchedOffer.code === 'HARVEST15') setAppliedDiscount(15);

        setPromoSuccess(`Success! ${matchedOffer.badge} applied.`);
    };

    // Calculate dynamic basket totals for our top floating badge
    const totalBasketItems = Object.values(quantities).reduce((acc, curr) => acc + curr, 0);

    const filteredProducts = products
        .filter((p) => selectedCategory === 'all' || p.category === selectedCategory)
        .filter((p) => p.name.toLowerCase().includes(searchQuery.toLowerCase()));

    return (
        <div className="min-h-screen bg-slate-50/50 p-8">
            {/* ─────────────── 🛡️ THE STICKY CONTROL PERIMETER PANEL ─────────────── */}
            <div className="sticky top-0 z-40 bg-white">
                {/* 🏪 TOP BANNER LINE HEADER ROW */}
                <div className="flex items-center justify-between w-full">
                    <div className="flex items-center space-x-3">
                        <span className="text-3xl">🥬</span>
                        <div>
                            <h1 className="text-3xl font-black tracking-tight text-slate-900">
                                Fresh Marketplace
                            </h1>
                            <p className="text-sm text-slate-500 mt-1">
                                Premium farm-to-table grocery supply pipeline.
                            </p>
                        </div>
                    </div>

                    {/* 🛍️ RIGHT-SIDE HEADER CONTROLLER: NAVIGATION & BASKET BADGE */}
                    <div className="flex flex-col items-end space-y-3">
                        {/* 🔑 ENTRY PASSWAY PORTAL LINKS Bar */}
                        <div className="flex items-center space-x-4 text-xs font-bold text-slate-400 font-sans antialiased">
                            {user && user.role ? (
                                <div className="flex items-center space-x-4">
                                    {/* 🛒 CUSTOMER VIEW LINKS */}
                                    {user.role === 'customer' && !user.subRole && (
                                        <>
                                            <Link
                                                href="/profile"
                                                className="text-slate-500 hover:text-emerald-600 transition normal-case"
                                            >
                                                My Profile
                                            </Link>
                                            <span className="text-slate-200">|</span>
                                            <Link
                                                href="/orderHistory"
                                                className="text-slate-500 hover:text-emerald-600 transition normal-case"
                                            >
                                                Order History
                                            </Link>
                                        </>
                                    )}

                                    {/* 👑 STAFF CROSS-OVER BUTTON: If a manager/driver is browsing the store, give them a shortcut right back to work! */}
                                    {user.role === 'admin' && (
                                        <button
                                            onClick={() => {
                                                if (user.subRole === 'manager')
                                                    router.push('/admin/ledger');
                                                else if (user.subRole === 'warehouse')
                                                    router.push('/admin/ordersReceived');
                                                else if (user.subRole === 'driver')
                                                    router.push('/admin/packedOrders');
                                            }}
                                            className="bg-purple-50 text-purple-700 border border-purple-200 px-2.5 py-1 rounded-lg text-[11px] font-black uppercase tracking-wide hover:bg-purple-100 transition"
                                        >
                                            ⚙️ Return to Admin Panel
                                        </button>
                                    )}

                                    <span className="text-slate-200">|</span>

                                    <button
                                        onClick={handleLogout}
                                        className="hover:text-red-600 text-slate-500 transition tracking-wider uppercase active:scale-95"
                                    >
                                        Sign Out
                                    </button>
                                </div>
                            ) : (
                                // GUEST LINKS (If not logged in)
                                <>
                                    <button
                                        onClick={() => router.push('/login')}
                                        className="hover:text-slate-900 transition tracking-wider uppercase active:scale-95"
                                    >
                                        Sign In
                                    </button>
                                    <span className="text-slate-200">|</span>
                                    <button
                                        onClick={() => router.push('/register')}
                                        className="hover:text-slate-900 transition tracking-wider uppercase active:scale-95"
                                    >
                                        Join Market
                                    </button>
                                </>
                            )}
                        </div>
                        {/* FLOATING SHOPPING CART SUMMARY BANNER BADGE */}
                        <button
                            onClick={() => setIsCartOpen(true)}
                            className="flex items-center space-x-2 bg-slate-900 text-white rounded-2xl px-4 py-2.5 shadow-md hover:bg-slate-800 transition active:scale-95 group"
                        >
                            <span className="text-sm font-bold tracking-wide">My Basket</span>
                            <span className="bg-emerald-500 text-white text-[11px] font-black h-5 w-5 rounded-full flex items-center justify-center transition group-hover:scale-110">
                                {totalBasketItems}
                            </span>
                        </button>
                    </div>
                </div>

                {/* 🏷️ FEATURED DISCOUNT CAROUSEL BANNER SECTION */}
                <div className="mt-6 w-full relative overflow-hidden rounded-3xl shadow-md">
                    {/* Master Slide Track wrapper */}
                    <div
                        className={`w-full p-6 sm:p-8 bg-gradient-to-r ${OFFERS_CAROUSEL[activeSlide].gradient} text-white flex flex-col sm:flex-row sm:items-center sm:justify-between transition-all duration-500 ease-in-out`}
                    >
                        {/* Left side: Text Details Metadata Content */}
                        <div className="max-w-xl">
                            <span className="text-[10px] font-black uppercase tracking-widest bg-white/20 text-white px-2.5 py-1 rounded-full">
                                {OFFERS_CAROUSEL[activeSlide].badge}
                            </span>
                            <h2 className="text-xl sm:text-2xl font-black mt-3 tracking-tight leading-tight">
                                {OFFERS_CAROUSEL[activeSlide].title}
                            </h2>
                            <p className="text-xs sm:text-sm text-white/80 mt-1 font-medium">
                                {OFFERS_CAROUSEL[activeSlide].subtitle}
                            </p>
                        </div>

                        {/* Right side: Promo Coupon Code Tag Badge */}
                        <div className="mt-4 sm:mt-0 flex flex-col items-start sm:items-end justify-center">
                            <span className="text-[10px] font-bold text-white/60 tracking-wider uppercase">
                                Use Promocode At Checkout
                            </span>
                            <div className="mt-1 bg-white/10 border border-white/20 px-4 py-2 rounded-2xl font-black text-sm tracking-widest backdrop-blur-md select-all cursor-pointer shadow-inner">
                                🎟️ {OFFERS_CAROUSEL[activeSlide].code}
                            </div>
                        </div>
                    </div>

                    {/* 🎛️ NAVIGATION DOTS SLIDE TUNNEL GATES */}
                    <div className="absolute bottom-4 left-6 flex items-center space-x-2">
                        {OFFERS_CAROUSEL.map((slide, index) => (
                            <button
                                key={slide.id}
                                onClick={() => setActiveSlide(index)} // 🍏 Flips active slide index inside state memory cell natively!
                                className={`h-2 transition-all duration-300 rounded-full ${
                                    activeSlide === index
                                        ? 'w-6 bg-white shadow-sm'
                                        : 'w-2 bg-white/40 hover:bg-white/60'
                                }`}
                            />
                        ))}
                    </div>
                </div>

                {/* 🔍 HIGH-CONTRAST SEARCH INPUT BOX ROW CONTAINER */}
                <div className="mt-6 max-w-md w-full relative">
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search fresh groceries, dairy, vegetables..."
                        className="w-full p-3.5 pl-11 text-sm border border-slate-200 rounded-2xl bg-white shadow-sm placeholder-slate-400 focus:outline-none focus:border-slate-400 transition"
                    />
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-base">
                        🔍
                    </span>
                </div>

                {/* 🏷️ THE INTERACTIVE CATEGORY FILTER PERIMETER GATES */}
                <div className="flex items-center space-x-2 mt-8 overflow-x-auto pb-2 border-b border-slate-200">
                    {['all', 'produce', 'dairy', 'bakery'].map((cat) => (
                        <button
                            key={cat}
                            onClick={() => setSelectedCategory(cat)}
                            className={`rounded-xl px-4 py-2 text-xs font-bold transition tracking-wider uppercase whitespace-nowrap active:scale-95 ${
                                selectedCategory === cat
                                    ? 'bg-slate-900 text-white shadow-sm'
                                    : 'border border-slate-200 bg-white text-slate-400 hover:text-slate-600'
                            }`}
                        >
                            {cat === 'all' ? 'All Items' : cat}
                        </button>
                    ))}
                </div>
            </div>

            {/* 📦 AUTOMATED DATABASE REPETITION GRID */}
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-3 mt-8">
                {/* 1. Store your filtered items inside a temporary variable array list first */}
                {filteredProducts.length === 0 ? (
                    <div className="col-span-full flex flex-col items-center justify-center p-12 bg-white rounded-2xl border border-dashed border-slate-200 mt-4">
                        <span className="text-4xl">🔍</span>
                        <h3 className="text-sm font-bold text-slate-800 mt-4">
                            No groceries found
                        </h3>
                        <p className="text-xs text-slate-400 mt-1">
                            Try adjusting your active category tags or check your typing.
                        </p>
                    </div>
                ) : (
                    filteredProducts.map((product) => {
                        const activeQty = quantities[product.id] || 0;
                        const theme =
                            CATEGORY_THEMES[product.category as keyof typeof CATEGORY_THEMES] ||
                            CATEGORY_THEMES.fallback;
                        return (
                            <div
                                key={product.id}
                                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm overflow-hidden transition hover:shadow-md flex flex-col justify-between"
                            >
                                <div>
                                    {/* Visual Stage */}
                                    <div
                                        className={`h-40 w-full rounded-xl ${theme.bg} flex items-center justify-center text-4xl`}
                                    >
                                        {theme.emoji}
                                    </div>
                                    {/* Metadata */}
                                    <div className="mt-4">
                                        <span
                                            className={`text-[10px] font-extrabold uppercase tracking-widest ${theme.textTheme} ${theme.bg} px-2 py-0.5 rounded-full`}
                                        >
                                            {product.category}
                                        </span>
                                        <h3 className="text-lg font-bold text-slate-900 mt-2">
                                            {product.name}
                                        </h3>
                                        <p className="text-xs text-slate-400 mt-1">
                                            {product.desc}
                                        </p>
                                    </div>
                                </div>

                                {/* 🌟 THE ROW CONTROLLER */}
                                <div className="flex items-center justify-between mt-5 pt-3 border-t border-slate-100">
                                    <span className="text-base font-black text-slate-900">
                                        ₹{product.pricePerKg}.00 / {theme.unit}
                                    </span>

                                    <div className="h-9 min-w-[90px] flex items-center justify-center">
                                        {activeQty === 0 ? (
                                            // STATE A: Render the clean flat ADD button if qty is 0
                                            <button
                                                type="button"
                                                onClick={() => incrementQuantity(product.id)}
                                                className={`w-full h-full rounded-xl border border-slate-200 bg-white text-xs font-black ${theme.textTheme} shadow-sm ${theme.borderTheme} ${theme.hoverBg} transition active:scale-95 tracking-wider uppercase px-4 py-2`}
                                            >
                                                Add
                                            </button>
                                        ) : (
                                            // STATE B: Stepper activates natively for current ID
                                            <div
                                                className={`flex items-center border ${theme.borderTheme} rounded-xl bg-slate-50/50 p-1 w-full h-full shadow-sm`}
                                            >
                                                <button
                                                    type="button"
                                                    onClick={() => decrementQuantity(product.id)}
                                                    className={`h-7 w-7 rounded-lg flex items-center justify-center text-xs font-black ${theme.textTheme} hover:bg-white transition active:scale-90`}
                                                >
                                                    -
                                                </button>
                                                <span className="w-8 text-center text-xs font-black text-slate-900">
                                                    {activeQty}
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={() => incrementQuantity(product.id)}
                                                    className={`h-7 w-7 rounded-lg flex items-center justify-center text-xs font-black ${theme.textTheme} hover:bg-white transition active:scale-90`}
                                                >
                                                    +
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
            {/* ─────────────── 🛒 THE SLIDE-OUT DRAWER SYSTEM OVERLAY ─────────────── */}
            {isCartOpen && (
                <div className="fixed inset-0 z-50 overflow-hidden">
                    {/* 🌑 Backdrop Curtain Shade Layer */}
                    <div
                        onClick={() => setIsCartOpen(false)} // 🍏 Clicking the dark shadow curtain closes the cart panel!
                        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity"
                    />

                    {/* 🧳 Moving Sidebar Panel Container Sheet */}
                    <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
                        <div className="w-screen max-w-md bg-white shadow-2xl flex flex-col justify-between p-6">
                            {/* DRAWER LAYER HEADER PANEL LINE */}
                            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                                <div className="flex items-center space-x-2">
                                    <span className="text-xl">🧺</span>
                                    <h2 className="text-lg font-black tracking-tight text-slate-900">
                                        Your Grocery Tote
                                    </h2>
                                </div>
                                <button
                                    onClick={() => setIsCartOpen(false)}
                                    className="h-8 w-8 rounded-xl flex items-center justify-center border border-slate-100 text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition active:scale-90 text-xs font-bold"
                                >
                                    ✕
                                </button>
                            </div>

                            {/* DRAWER LAYER MIDDLE BODY: ITEM TRACK LIST VIEWPORT */}
                            <div className="flex-1 py-6 overflow-y-auto space-y-4 pr-1">
                                {totalBasketItems === 0 ? (
                                    <div className="flex flex-col items-center justify-center h-full text-center">
                                        <span className="text-3xl grayscale">🛒</span>
                                        <p className="text-sm font-bold text-slate-400 mt-3">
                                            Your basket is completely empty
                                        </p>
                                        <p className="text-xs text-slate-300 mt-1">
                                            Add fresh items from the market catalog to checkout.
                                        </p>
                                    </div>
                                ) : (
                                    // 📦 AUTOMATED CART ITEM ROW MATRIX LIST LOOP
                                    products
                                        .filter((product) => quantities[product.id] > 0)
                                        .map((product) => {
                                            const qty = quantities[product.id];
                                            const lineItemTotal = product.pricePerKg * qty;
                                            const theme =
                                                CATEGORY_THEMES[
                                                    product.category as keyof typeof CATEGORY_THEMES
                                                ] || CATEGORY_THEMES.fallback;

                                            return (
                                                <div
                                                    key={`cart_${product.id}`}
                                                    className="flex items-center justify-between p-3 border border-slate-100 rounded-2xl bg-slate-50/50 transition hover:border-slate-200"
                                                >
                                                    {/* Left: Emoji Asset & Text Details Block */}
                                                    <div className="flex items-center space-x-3">
                                                        <div
                                                            className={`h-12 w-12 rounded-xl ${theme.bg} flex items-center justify-center text-xl`}
                                                        >
                                                            {theme.emoji}
                                                        </div>
                                                        <div>
                                                            <h4 className="text-sm font-bold text-slate-900">
                                                                {product.name}
                                                            </h4>
                                                            <p className="text-[11px] text-slate-400 mt-0.5">
                                                                ₹{product.pricePerKg} × {qty}
                                                            </p>
                                                        </div>
                                                    </div>

                                                    {/* Right: Inline Cart Micro-Stepper Tools */}
                                                    <div className="flex items-center space-x-3">
                                                        <span className="text-sm font-black text-slate-900 min-w-[60px] text-right">
                                                            ₹{lineItemTotal}
                                                        </span>

                                                        <div className="flex items-center border border-slate-200 rounded-lg bg-white p-0.5 shadow-sm">
                                                            <button
                                                                type="button"
                                                                onClick={() =>
                                                                    decrementQuantity(product.id)
                                                                }
                                                                className={`h-6 w-6 rounded-md flex items-center justify-center text-xs font-black ${theme.textTheme} hover:bg-slate-50 transition`}
                                                            >
                                                                -
                                                            </button>
                                                            <span className="w-5 text-center text-xs font-black text-slate-900">
                                                                {qty}
                                                            </span>
                                                            <button
                                                                type="button"
                                                                onClick={() =>
                                                                    incrementQuantity(product.id)
                                                                }
                                                                className={`h-6 w-6 rounded-md flex items-center justify-center text-xs font-black ${theme.textTheme} hover:bg-slate-50 transition`}
                                                            >
                                                                +
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })
                                )}
                            </div>

                            {/* DRAWER LAYER FOOTER PANEL LINE: FISCAL CHECKOUT CALCULATOR */}
                            <div className="border-t border-slate-100 pt-4 space-y-4">
                                {/* 🎟️ INTERACTIVE PROMOCODE INPUT ACTION LINE */}
                                {totalBasketItems > 0 && (
                                    <div className="space-y-1.5">
                                        <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                                            Have a Promocode?
                                        </label>
                                        <div className="flex space-x-2">
                                            <input
                                                type="text"
                                                value={promoInput}
                                                onChange={(e) => setPromoInput(e.target.value)}
                                                placeholder="e.g. FRESH20"
                                                className="flex-1 px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-slate-400 uppercase tracking-widest font-black"
                                            />
                                            <button
                                                type="button"
                                                onClick={handleApplyPromo}
                                                className="bg-slate-900 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-slate-800 transition"
                                            >
                                                Apply
                                            </button>
                                        </div>
                                        {promoError && (
                                            <p className="text-red-500 text-[11px] font-semibold mt-1">
                                                {promoError}
                                            </p>
                                        )}
                                        {promoSuccess && (
                                            <p className="text-emerald-600 text-[11px] font-semibold mt-1">
                                                🎉 {promoSuccess}
                                            </p>
                                        )}
                                    </div>
                                )}

                                {/* 🧮 THE DISCOUNT MATH ENGINE */}
                                {totalBasketItems > 0 && (
                                    <div className="space-y-2 border-t border-slate-50 pt-3">
                                        <div className="flex items-center justify-between text-xs text-slate-500">
                                            <span>Subtotal</span>
                                            <span className="font-medium">₹{subtotal}.00</span>
                                        </div>

                                        {appliedDiscount > 0 && (
                                            <div className="flex items-center justify-between text-xs text-emerald-600 font-medium">
                                                <span>Discount ({appliedDiscount}%)</span>
                                                <span>-₹{discountAmount}.00</span>
                                            </div>
                                        )}

                                        <div className="flex items-center justify-between border-t border-slate-100 pt-2">
                                            <span className="text-sm font-bold text-slate-900">
                                                Estimated Total
                                            </span>
                                            <span className="text-xl font-black text-slate-900">
                                                ₹{finalTotal.toFixed(2)}
                                            </span>
                                        </div>
                                    </div>
                                )}

                                <button
                                    disabled={totalBasketItems === 0}
                                    onClick={() => {
                                        if (isAuthenticated) {
                                            // 🟢 Path A: User is logged in! Transition smoothly to your dedicated checkout page layout
                                            router.push('/checkout');
                                        } else {
                                            // 🔴 Path B: Stranger detected! Block checkout and sound the auth prompt gate
                                            setIsCartOpen(false); // Close the drawer safely
                                            setShowAuthGateModal(true); // Open the account wall
                                        }
                                    }}
                                    className="w-full bg-slate-900 hover:bg-slate-800 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed text-white p-3.5 rounded-2xl font-black text-sm tracking-wide transition active:scale-98 shadow-md"
                                >
                                    Proceed to Delivery Details
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ─────────────── 🛡️ THE SECURITY AUTHENTICATION GATE PANEL MODAL ─────────────── */}
            {showAuthGateModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    {/* Backdrop Curtain Shade Layer */}
                    <div
                        onClick={() => setShowAuthGateModal(false)}
                        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
                    />

                    {/* Authentication Prompt Alert Box */}
                    <div className="bg-white rounded-3xl p-8 max-w-md w-full relative z-10 shadow-2xl border border-slate-100 text-center animate-in fade-in zoom-in-95 duration-200">
                        <span className="text-4xl">🔐</span>
                        <h2 className="text-xl font-black tracking-tight text-slate-900 mt-4">
                            Account Required to Order
                        </h2>
                        <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                            Join Fresh Marketplace to unlock secure home delivery coordinates, track
                            your delivery fleet, and manage orders.
                        </p>

                        {/* Interactive Navigation Action Buttons */}
                        <div className="mt-6 flex flex-col space-y-2">
                            <button
                                onClick={() => router.push('/login')}
                                className="w-full bg-slate-900 hover:bg-slate-800 text-white p-3 rounded-xl font-bold text-sm transition active:scale-95"
                            >
                                Sign In to Existing Account
                            </button>
                            <button
                                onClick={() => router.push('/register')}
                                className="w-full border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 p-3 rounded-xl font-bold text-sm transition active:scale-95"
                            >
                                Create a New Account
                            </button>
                        </div>

                        {/* Dismiss link */}
                        <button
                            onClick={() => setShowAuthGateModal(false)}
                            className="mt-4 text-xs font-semibold text-slate-400 hover:text-slate-600 transition"
                        >
                            Continue Browsing Catalog
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
