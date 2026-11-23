import { Router } from 'express';
import axios from 'axios';

const geoRouter = Router();

// 📍 1. THE REVERSE GEOCODE PORTAL (Coordinates -> Text)
geoRouter.get('/reverse-geocode', async (req, res) => {
    try {
        const { lat, lon } = req.query;

        if (!lat || !lon || lat === 'undefined' || lon === 'undefined' || Number(lat) === 0) {
            return res.status(200).json({ display_name: 'Select location on map', address: {} });
        }

        const response = await axios.get('https://nominatim.openstreetmap.org/reverse', {
            params: {
                format: 'jsonv2',
                lat: String(lat),
                lon: String(lon),
                zoom: 18,
                addressdetails: 1,
            },
            headers: {
                Accept: 'application/json',
                'Accept-Language': 'en',
                'User-Agent':
                    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) FreshGrocerApp/2.0 (contact: abhinav0951@gmail.com)',
            },
        });

        return res.status(200).json(response.data);
    } catch (error: any) {
        // 🛡️ Using 'unknown' is the modern TypeScript standard for catch blocks
        console.error('[GEO REVERSE FAULT] Pipeline exception triggered:');

        if (axios.isAxiosError(error)) {
            // 🌐 This is an Axios Network Error
            if (error.response) {
                // Nominatim active denial (e.g., 400 Bad Request for out-of-bound lat/lon, 429 Rate Limited)
                console.error(`[Nominatim HTTP Error Status]: ${error.response.status}`);
                console.error('Payload details:', error.response.data);

                // You could choose to pass back a specific 422 or 400 down to frontend
                return res.status(error.response.status).json({
                    error: 'Location search rejected by upstream mapping server.',
                });
            } else if (error.request) {
                // Nominatim servers are down, or your internet disconnected mid-request
                console.error('[Network Timeout / Offline]: No response received from Nominatim.');
                return res.status(503).json({
                    error: 'Mapping services are currently unreachable. Please check your network.',
                });
            } else {
                // Error configuration setup failure
                console.error('[Axios Setup Issue]:', error.message);
            }
        } else {
            // 💻 This is a Native JavaScript Code Crash (e.g. typos, memory leak, range error)
            const nativeError = error as Error;
            console.error('[Local Runtime Syntax/Logic Crash]:', nativeError.message);
        }

        // Standard 500 fallback for everything else
        return res.status(500).json({ error: 'Internal system fault encountered.' });
    }
});

// 📍 2. THE FORWARD SEARCH PORTAL (Text -> Coordinates)
geoRouter.get('/search-address', async (req, res) => {
    try {
        const { q } = req.query;

        // 🛡️ TYPE SAFEGUARD GATE: Cast parameters explicitly to standard string types
        const searchString = q ? String(q).trim() : '';

        if (!searchString || searchString === 'undefined' || searchString.length < 3) {
            return res.status(200).json([]);
        }

        console.log(
            `[GEO SEARCH ACTIVE] Processing structural map sync for query text: "${searchString}"`
        );

        const response = await axios.get('https://nominatim.openstreetmap.org/search', {
            params: {
                q: searchString, // Safely mapped out as a guaranteed primitive string cell
                format: 'json',
                limit: 1,
                addressdetails: 1,
                countrycodes: 'in', // Pins lookups strictly inside India to prevent network timeouts
            },
            headers: {
                Accept: 'application/json',
                'Accept-Language': 'en',
                'User-Agent':
                    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) FreshGrocerApp/2.0 (contact: abhinav0951@gmail.com)',
            },
        });

        return res.status(200).json(response.data);
    } catch (error: unknown) {
        // Using 'unknown' is safer than 'any'
        console.error('[GEO SEARCH COMPILER CRASH] Exception caught:');

        if (axios.isAxiosError(error)) {
            // TypeScript now knows this is definitely an Axios network error
            if (error.response) {
                // The server responded with a status code outside the 2xx range
                console.error(`Status code from Nominatim: ${error.response.status}`);
                console.error('Payload:', error.response.data);
            } else if (error.request) {
                // The request was made but no response was received (e.g., timeout/offline)
                console.error('No response received from Nominatim. Network might be down.');
            } else {
                // Something happened in setting up the request that triggered an Error
                console.error('Axios Setup Error:', error.message);
            }
        } else {
            // This handles non-Axios errors (like a native JS code crash or typo)
            const nativeError = error as Error;
            console.error('Native JavaScript Error:', nativeError.message);
        }

        return res.status(200).json([]);
    }
});

export default geoRouter;
