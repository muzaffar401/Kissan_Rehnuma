/**
 * Input validation utilities for Kissan Rehnuma.
 *
 * All validators return an error string if invalid, or empty string '' if valid.
 * This makes it easy to display the error directly in the UI.
 */

/** Basic email format check */
export function validateEmail(email: string): string {
  if (!email.trim()) return 'Email is required.';
  // Standard email regex — covers 99% of real-world addresses
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!re.test(email.trim())) return 'Please enter a valid email address.';
  return '';
}

/**
 * Password rules:
 * - Minimum 8 characters
 * - At least 1 uppercase letter
 * - At least 1 lowercase letter
 * - At least 1 number
 */
export function validatePassword(password: string): string {
  if (!password) return 'Password is required.';
  if (password.length < 8) return 'Password must be at least 8 characters.';
  if (!/[A-Z]/.test(password)) return 'Password must contain at least one uppercase letter.';
  if (!/[a-z]/.test(password)) return 'Password must contain at least one lowercase letter.';
  if (!/[0-9]/.test(password)) return 'Password must contain at least one number.';
  return '';
}

/**
 * Pakistani CNIC: 13 digits, optionally formatted as XXXXX-XXXXXXX-X
 * Accepts with or without dashes.
 */
export function validateCNIC(cnic: string): string {
  if (!cnic.trim()) return 'CNIC is required.';
  // Strip dashes for uniform checking
  const digits = cnic.replace(/-/g, '');
  if (!/^\d{13}$/.test(digits)) return 'CNIC must be 13 digits (e.g. 35202-1234567-1).';
  return '';
}

/**
 * Pakistani mobile number: starts with 03, total 11 digits.
 * Accepts: 03XXXXXXXXX, 03XX-XXXXXXX, +923XXXXXXXXX
 */
export function validatePhone(phone: string): string {
  if (!phone.trim()) return 'Mobile number is required.';
  // Normalize: remove dashes, spaces, and leading +92 → 03
  let normalized = phone.replace(/[-\s]/g, '');
  if (normalized.startsWith('+92')) normalized = '0' + normalized.slice(3);
  if (!/^03\d{9}$/.test(normalized)) {
    return 'Enter a valid Pakistani mobile number (e.g. 03XX-XXXXXXX).';
  }
  return '';
}

/** OTP must be exactly 6 digits */
export function validateOTP(otp: string): string {
  if (!otp.trim()) return 'Please enter the OTP.';
  if (!/^\d{6}$/.test(otp.trim())) return 'OTP must be exactly 6 digits.';
  return '';
}

/** Non-empty check for text fields */
export function validateRequired(value: string, fieldName: string): string {
  if (!value.trim()) return `${fieldName} is required.`;
  return '';
}
