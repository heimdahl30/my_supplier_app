'use client';

import { useState } from 'react';
import axios from 'axios';
import { useRouter } from 'next/navigation';

export default function DriverPayoutSetupPage() {
    const router = useRouter();
    const [formData, setFormData] = useState({
        accountHolderName: '',
        accountNumber: '',
        ifscCode: '',
        email: '',
        phone: '',
    });
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');

    const handleSubmit = async (e: React.SubmitEvent) => {
        e.preventDefault();
        setLoading(true);
        setMessage('');

        try {
            // 🌐 Fires straight down to your Express backend router endpoint
            await axios.patch('http://localhost:5000/api/v1/payout/payout-setup', formData, {
                withCredentials: true,
            });

            setMessage('✅ Banking wallet configuration activated successfully! Redirecting...');

            // ⏰ Let them read the success text for 2 seconds, then slide them to their active jobs tracking cards
            setTimeout(() => {
                router.push('/admin/packedOrders');
                router.refresh(); // Refresh clears out the navigation alert banner state instantly!
            }, 2000);
        } catch (err) {
            if (axios.isAxiosError(err)) {
                console.error(err);
                setMessage(
                    `❌ Error: ${err.response?.data?.error || 'Setup failed. Please check your banking IFSC codes.'}`
                );
            } else {
                console.error(err);
                setMessage('❌ An unexpected error occurred. Please try again later.');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-md mx-auto mt-12 p-6 bg-white border rounded-xl shadow-sm">
            <div className="mb-6">
                <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                    🚚 Delivery Partner Wallet Link
                </h1>
                <p className="text-gray-500 text-xs mt-1">
                    Configure your physical bank routing tokens through Razorpay Route to authorize
                    automated, instant payouts the exact millisecond you finalize order drop-offs.
                </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">
                        Account Holder Name
                    </label>
                    <input
                        type="text"
                        required
                        placeholder="As it appears in your bank passbook"
                        className="w-full border p-2 rounded text-sm focus:outline-none focus:border-emerald-500"
                        onChange={(e) =>
                            setFormData({ ...formData, accountHolderName: e.target.value })
                        }
                    />
                </div>
                <div>
                    <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">
                        Bank Account Number
                    </label>
                    <input
                        type="password"
                        required
                        placeholder="••••••••••••"
                        className="w-full border p-2 rounded text-sm focus:outline-none focus:border-emerald-500"
                        onChange={(e) =>
                            setFormData({ ...formData, accountNumber: e.target.value })
                        }
                    />
                </div>
                <div>
                    <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">
                        IFSC Code
                    </label>
                    <input
                        type="text"
                        required
                        placeholder="e.g., SBIN0001234"
                        maxLength={11}
                        className="w-full border p-2 rounded text-sm uppercase placeholder:normal-case focus:outline-none focus:border-emerald-500"
                        onChange={(e) =>
                            setFormData({ ...formData, ifscCode: e.target.value.toUpperCase() })
                        }
                    />
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">
                            Payout Notifications Email
                        </label>
                        <input
                            type="email"
                            required
                            placeholder="driver@email.com"
                            className="w-full border p-2 rounded text-xs focus:outline-none focus:border-emerald-500"
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">
                            Mobile Phone
                        </label>
                        <input
                            type="text"
                            required
                            placeholder="91XXXXXXXX"
                            className="w-full border p-2 rounded text-xs focus:outline-none focus:border-emerald-500"
                            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        />
                    </div>
                </div>

                <button
                    type="submit"
                    disabled={loading}
                    className="w-full mt-2 bg-emerald-600 text-white p-2.5 rounded-lg font-medium text-sm hover:bg-emerald-700 transition disabled:opacity-50 shadow-sm"
                >
                    {loading ? 'Validating Payout Routing Rails...' : 'Activate Banking Connection'}
                </button>
            </form>

            {message && (
                <div
                    className={`mt-4 p-3 rounded-lg text-xs font-medium text-center ${message.includes('❌') ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-700'}`}
                >
                    {message}
                </div>
            )}
        </div>
    );
}
