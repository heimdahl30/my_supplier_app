// apps/frontend/src/proxy.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// 🛡️ UTILITY HOOK: Strips away Express signature wrappers (s%3A...) from plain Edge text strings
function unsignExpressCookie(cookieValue: string | undefined): string | null {
    if (!cookieValue) return null;
    // Decode the URL characters (converts %3A back to ':')
    const decoded = decodeURIComponent(cookieValue);
    if (decoded.startsWith('s:')) {
        // Splice out the 's:' prefix and cut off the signature trailing after the dot '.'
        return decoded.slice(2).split('.')[0]; // Slice 2 means remove the 's:' prefix, then split at the dot and take the first part (the actual token) as split makes it an array and we want the first element which is the token itself.
    }
    return decoded;
}

export async function proxy(request: NextRequest) {
    const currentUrlPath = request.nextUrl.pathname; //nextUrl is an object which has fields like pathname, search, origin, etc. Here we are extracting the pathname from the nextUrl object of the request.

    // 🕵️‍♂️ 1. RETRIEVE THE RAW COOKIE TEXT STRINGS FROM THE EDGE EDGE BUFFER
    const rawAuthCookie = request.cookies.get('auth_token')?.value; //rawAuthCookie will be an object with fields name and value.
    const rawRefreshCookie = request.cookies.get('refresh_token')?.value;

    // ✂️ 2. EXTRUDE THE GENUINE TOKENS BY STRIPPING EXPRESS CRYPTO SIGNATURES
    const authToken = unsignExpressCookie(rawAuthCookie);
    const refreshToken = unsignExpressCookie(rawRefreshCookie);

    // 🛡️ 3. EVALUATE SECURITY MATRIX FOR SECURE WORKSPACE REGIONS
    if (currentUrlPath.startsWith('/admin')) {
        // CASE A: The short-term access token is valid! Let them pass instantly.
        if (authToken) {
            return NextResponse.next(); // Allow the request to proceed the actual Next.js frontend page like /admin/dashboard or /admin/settings, etc.
        }

        // CASE B: Both tokens are dead. Banish them straight to the login form portal screen.
        if (!authToken && !refreshToken) {
            return NextResponse.redirect(new URL('/login', request.url)); //redirect to Next.js page of /login,
        }

        // CASE C: 🔄 THE AUTOMATED HANDSHAKE RELAY GATES
        if (!authToken && refreshToken) {
            try {
                // Reach across the local network channels directly into your Express port 5000 endpoint!
                // Critical: We must manually pass the cookie in the headers since this is server-to-server!
                const refreshResponse = await fetch(
                    'http://localhost:5000/api/v1/login/refresh-token',
                    {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            // Manually pass the signed cookie to Express so req.signedCookies in Express can read it!
                            Cookie: `refresh_token=${rawRefreshCookie}`,
                        },
                    }
                );

                // refreshResponse will be an object with fields like status, headers, body, etc. headers will have fields 'set-cookie', 'content-type', etc.

                if (refreshResponse.ok) {
                    // Create your standard pass-through response layout

                    const nextResponse = NextResponse.next();

                    //nextResponse will be an object with fields like status, headers, body, cookies etc. Here we are creating a new response object that will be sent back to the client.

                    // ⚡ THE HEADER RELAY MATRIX: Grab the Set-Cookie array directly out of Express
                    // and duplicate it straight into the Next.js response heading to the user's browser!
                    const expressCookies = refreshResponse.headers.get('set-cookie');

                    /*
                    expressCookies will be Set-Cookie: auth_token=s%3AeyJhbGciOi...; Max-Age=900; HttpOnly; Path=/
                    */

                    if (expressCookies) {
                        nextResponse.headers.set('set-cookie', expressCookies);
                    }
                    //In the browser , the Set-Cookie header will be received and the browser will parse it and store the new auth_token cookie, allowing the user to continue their session without interruption.

                    return nextResponse; // Pass through with zero user screen interruption!
                }
            } catch (error) {
                console.error('Edge session renewal handshake crashed:', error);
            }
        }

        // Fallback: If the refresh token was invalid or revoked in your DB, kick them to login
        return NextResponse.redirect(new URL('/login', request.url));
    }

    return NextResponse.next();
}

export const config = {
    matcher: ['/admin/:path*'],
};

/*
In browser, the cookie will be parsed and stored like so:
Name        Value              Domain    Path Expires/Max-Age        HttpOnly Secure SameSite
auth_tokens. %3AeyJhbGciOi...  localhost.  /.   [15 minutes from now]  ✓      ✓      Lax
*/
