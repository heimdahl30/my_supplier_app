import axios from 'axios';

const api = axios.create({
    baseURL: 'http://localhost:5000/api/v1',
    withCredentials: true, // Crucial: Ensures cookies are sent with every request
});

// Response Interceptor: Catches errors globally before they reach your components
api.interceptors.response.use(
    (response) => response, // If the request succeeds, just return the response
    async (error) => {
        const originalRequest = error.config;
        /*
        Blueprint of the request that failed
        Contains the following:
        url: '/orders/orderplacing'
        method: 'post'
        data: {"totalPrice": 340, "items": [...]}
        headers: {"Content-Type": "application/json"}
        */

        // Check if the error is a 401 (Expired Access Token) AND we haven't tried refreshing yet
        if (error.response?.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true; // Mark request so we don't loop infinitely if refresh fails

            try {
                // 1. Silently request a new access token via cookies
                await axios.post(
                    'http://localhost:5000/api/v1/login/refresh-token',
                    {},
                    { withCredentials: true }
                );

                // 2. Retry the original request that failed (e.g., placing the order)
                return api(originalRequest);
            } catch (refreshError) {
                // Both tokens are dead (or revoked). Redirect them to login page.
                if (typeof window !== 'undefined') {
                    window.dispatchEvent(new Event('auth-session-expired'));
                }
                throw refreshError;
            }
        }

        throw error;
    }
);

export default api;
