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
        console.error('[GEO REVERSE FAULT] Pipeline exception:', error.message);
        return res.status(500).json({ error: 'External geocoding lookup failed.' });
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
    } catch (error: any) {
        console.error('[GEO SEARCH COMPILER CRASH] Local runtime execution exception caught:');
        if (error.response) {
            console.error(`Status code from Nominatim: ${error.response.status}`);
            console.error('Payload:', error.response.data);
        } else {
            console.error('Message:', error.message);
        }

        // 🛡️ RECOVERY ENGINE: Pass back an empty array fallback instead of raising a 500 error code up the stack!
        return res.status(200).json([]);
    }
});

export default geoRouter;
