/**
 * Network Utilities
 * Centralized network error detection
 */

/**
 * Check if an error is a network error (offline, timeout, connection refused)
 * @param {Error} error - The error to check
 * @returns {boolean} - True if it's a network error
 */
export const isNetworkError = (error) => {
    if (!error) return false;

    // No response from server
    if (!error.response) return true;

    // Specific error codes
    const networkErrorCodes = [
        'ECONNABORTED',
        'ERR_NETWORK',
        'ENOTFOUND',
        'ECONNREFUSED',
        'ETIMEDOUT',
    ];

    if (networkErrorCodes.includes(error.code)) return true;

    // Error messages that indicate network issues
    const networkErrorMessages = [
        'Network Error',
        'timeout',
        'Network request failed',
        'Failed to fetch',
    ];

    if (error.message) {
        for (const msg of networkErrorMessages) {
            if (error.message.toLowerCase().includes(msg.toLowerCase())) {
                return true;
            }
        }
    }

    return false;
};

/**
 * Format error message for display
 * @param {Error} error - The error to format
 * @returns {string} - User-friendly error message
 */
export const formatErrorMessage = (error) => {
    if (isNetworkError(error)) {
        return 'Unable to connect. Please check your internet connection.';
    }

    if (error.response?.data?.error) {
        return error.response.data.error;
    }

    if (error.message) {
        return error.message;
    }

    return 'An unexpected error occurred.';
};

export default {
    isNetworkError,
    formatErrorMessage,
};
