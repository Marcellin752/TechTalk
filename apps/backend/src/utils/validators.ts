/**
 * Validate email format and length
 * @param email - The email address to check
 * @returns True if valid, false otherwise
 */

export function validateEmail(email: string): boolean {
    if (!email || typeof email !== 'string') {
        return false;
    }
    if (email.length > 255) {
        return false;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

/**
 * Validate password format and length
 * @param password - The password to check
 * @returns True if valid, false otherwise
 */

export function validatePassword(password: string): boolean {
    if (!password || typeof password !== 'string') {
        return false;
    }
    if (password.length < 12 || password.length > 100) {
        return false;
    }
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{12,100}$/;
    return passwordRegex.test(password);
}