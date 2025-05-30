import { encrypt, decrypt } from '@/lib/utils/encryption';

// Mock environment variable
const originalEnv = process.env.ENCRYPTION_KEY;

describe('Encryption Utils', () => {
  beforeAll(() => {
    process.env.ENCRYPTION_KEY = 'test-encryption-key-32-characters-';
  });

  afterAll(() => {
    process.env.ENCRYPTION_KEY = originalEnv;
  });

  describe('encrypt', () => {
    it('should encrypt a string', () => {
      const plaintext = 'test-secret-value';
      const encrypted = encrypt(plaintext);
      
      expect(encrypted).toBeDefined();
      expect(encrypted).not.toBe(plaintext);
      expect(typeof encrypted).toBe('string');
    });

    it('should produce different encrypted values for the same input (due to IV)', () => {
      const plaintext = 'test-secret-value';
      const encrypted1 = encrypt(plaintext);
      const encrypted2 = encrypt(plaintext);
      
      expect(encrypted1).not.toBe(encrypted2);
    });

    it('should handle empty strings', () => {
      const plaintext = '';
      const encrypted = encrypt(plaintext);
      
      expect(encrypted).toBeDefined();
      expect(typeof encrypted).toBe('string');
    });
  });

  describe('decrypt', () => {
    it('should decrypt an encrypted string back to original', () => {
      const plaintext = 'test-secret-value';
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);
      
      expect(decrypted).toBe(plaintext);
    });

    it('should handle empty encrypted strings', () => {
      const encrypted = encrypt('');
      const decrypted = decrypt(encrypted);
      
      expect(decrypted).toBe('');
    });

    it('should handle special characters', () => {
      const plaintext = 'test@123!#$%^&*()_+{}|:<>?[]\\;\'",./';
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);
      
      expect(decrypted).toBe(plaintext);
    });

    it('should handle unicode characters', () => {
      const plaintext = '测试数据 🔐 encryption';
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);
      
      expect(decrypted).toBe(plaintext);
    });
  });

  describe('round-trip encryption', () => {
    const testCases = [
      'simple-string',
      'access_token_12345',
      'refresh_token_abcdef',
      'org-id-with-dashes',
      'user@example.com',
      'https://test.salesforce.com',
      JSON.stringify({ key: 'value', number: 123 }),
    ];

    testCases.forEach((plaintext) => {
      it(`should encrypt and decrypt: "${plaintext}"`, () => {
        const encrypted = encrypt(plaintext);
        const decrypted = decrypt(encrypted);
        
        expect(decrypted).toBe(plaintext);
      });
    });
  });
}); 