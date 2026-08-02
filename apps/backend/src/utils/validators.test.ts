import { describe, it, expect } from 'vitest';
import { validateEmail, validatePassword } from './validators.js';

describe('validators', () => {
  describe('validateEmail', () => {
    it('should return true for valid emails', () => {
      expect(validateEmail('jane@example.com')).toBe(true);
      expect(validateEmail('dev.to@platform.org')).toBe(true);
      expect(validateEmail('first.last+label@domain.co.uk')).toBe(true);
    });

    it('should return false for invalid emails', () => {
      expect(validateEmail('jane')).toBe(false);
      expect(validateEmail('jane@')).toBe(false);
      expect(validateEmail('jane@example')).toBe(false);
      expect(validateEmail('@example.com')).toBe(false);
      expect(validateEmail('')).toBe(false);
      expect(validateEmail(null as any)).toBe(false);
    });
  });

  describe('validatePassword', () => {
    it('should return true for strong passwords of 12+ characters with mix of uppercase, lowercase, numbers, and special characters', () => {
      expect(validatePassword('StrongP@ss1234')).toBe(true);
      expect(validatePassword('TechT@lk2026!')).toBe(true);
      expect(validatePassword('V3ry$ecureP@ssword')).toBe(true);
    });

    it('should return false for passwords that are too short', () => {
      expect(validatePassword('Short1!')).toBe(false); // less than 12
    });

    it('should return false for passwords missing uppercase letters', () => {
      expect(validatePassword('weakp@ssword123')).toBe(false);
    });

    it('should return false for passwords missing lowercase letters', () => {
      expect(validatePassword('WEAKP@SSWORD123')).toBe(false);
    });

    it('should return false for passwords missing numbers', () => {
      expect(validatePassword('WeakPassword!@')).toBe(false);
    });

    it('should return false for passwords missing special characters', () => {
      expect(validatePassword('WeakPassword123')).toBe(false);
    });

    it('should return false for passwords that are too long', () => {
      expect(validatePassword('A'.repeat(101) + '1a!')).toBe(false);
    });
  });
});
