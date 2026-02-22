export function normalizeTag(tag: string): string {
    return tag.replace(/\s+/g, ' ').trim().toLowerCase();
}

export function validateTag(tag: string): { valid: boolean; normalized?: string; error?: string } {
    const normalized = normalizeTag(tag);
    if (!normalized) return { valid: false, error: 'Tag cannot be empty' };
    if (normalized.length > 24) return { valid: false, error: 'Tag cannot exceed 24 characters' };
    return { valid: true, normalized };
}

export function dedupeTags(tags: string[]): string[] {
    const seen = new Set<string>();
    const result: string[] = [];
    for (const tag of tags) {
        const normalized = normalizeTag(tag);
        if (normalized && !seen.has(normalized)) {
            seen.add(normalized);
            result.push(normalized);
        }
    }
    // Limit to 8 tags
    return result.slice(0, 8);
}
