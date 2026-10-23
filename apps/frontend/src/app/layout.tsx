// apps/frontend/src/app/layout.tsx
import Navbar from '@/components/Navbar';
import './globals.css';
import { AuthProvider } from '@/hooks/useAuth'; // 🌟 Ensure this import path is completely accurate!

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en">
            <body className="antialiased">
                {/* 🛡️ Ensure this exact open tag wraps the children completely! */}
                <AuthProvider>
                    <Navbar />
                    <div className="flex-1 w-full">{children}</div>
                </AuthProvider>
            </body>
        </html>
    );
}
