import { normalizeTag, validateTag, dedupeTags } from './tags';

describe('Tags Normalization & Validation', () => {
    it('normalizes spaces and lowercases', () => {
        expect(normalizeTag('  HELLO   World  ')).toBe('hello world');
    });

    it('validates constraints correctly', () => {
        expect(validateTag('  ').valid).toBe(false);
        expect(validateTag('a'.repeat(25)).valid).toBe(false);
        expect(validateTag('Valid Tag').valid).toBe(true);
        expect(validateTag('Valid Tag').normalized).toBe('valid tag');
    });

    it('dedupes and limits to 8 correctly', () => {
        const input = ['A', 'a', 'B', ' b ', 'C', 'd', 'E', 'f', 'G', 'h', 'I', 'J'];
        const result = dedupeTags(input);
        expect(result).toEqual(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']);
        expect(result.length).toBe(8);
    });
});
