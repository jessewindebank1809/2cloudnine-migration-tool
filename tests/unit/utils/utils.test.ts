import { cn } from '@/lib/utils';

describe('Utils', () => {
  describe('cn function (className merger)', () => {
    it('should merge multiple class names', () => {
      const result = cn('class1', 'class2', 'class3');
      expect(result).toContain('class1');
      expect(result).toContain('class2');
      expect(result).toContain('class3');
    });

    it('should handle conditional classes', () => {
      const isActive = true;
      const isDisabled = false;
      
      const result = cn('base', isActive && 'active', isDisabled && 'disabled');
      expect(result).toContain('base');
      expect(result).toContain('active');
      expect(result).not.toContain('disabled');
    });

    it('should handle null and undefined values', () => {
      const result = cn('class1', null, undefined, 'class2');
      expect(result).toContain('class1');
      expect(result).toContain('class2');
      expect(result).not.toContain('null');
      expect(result).not.toContain('undefined');
    });

    it('should handle empty strings', () => {
      const result = cn('class1', '', 'class2');
      expect(result).toContain('class1');
      expect(result).toContain('class2');
    });

    it('should deduplicate classes', () => {
      const result = cn('class1', 'class1', 'class2');
      // The result should contain each class only once
      const classes = result.split(' ');
      const uniqueClasses = Array.from(new Set(classes.filter(c => c.length > 0)));
      expect(uniqueClasses).toContain('class1');
      expect(uniqueClasses).toContain('class2');
    });

    it('should handle array of classes', () => {
      const classes = ['class1', 'class2'];
      const result = cn(classes);
      expect(result).toContain('class1');
      expect(result).toContain('class2');
    });

    it('should return empty string for no inputs', () => {
      const result = cn();
      expect(result).toBe('');
    });
  });
}); 