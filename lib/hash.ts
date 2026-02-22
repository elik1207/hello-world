/**
 * lib/hash.ts — Privacy-safe content hashing.
 * Produces a SHA-256 digest that cannot reconstruct the original text.
 */
import * as Crypto from 'expo-crypto';

/**
 * Compute a stable SHA-256 hex digest of the input text.
 * The output is a fixed-length hex string that cannot be reversed to recover the input.
 */
export async function stableDigest(text: string): Promise<string> {
    return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, text);
}
