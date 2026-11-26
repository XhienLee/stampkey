import { normalizeKey, isKeyValid } from './js/key.js';
import { SECRET_WORDS } from './js/keypair.js';
import { SealError } from './js/format.js';

export const PREFIX = 'stampkey-pub-';
const SALT = new TextEncoder().encode('stampkey sign v1');
const CHUNK = 4 * 1024 * 1024;
const DEFAULT_COST = { passes: 3, memBytes: 64 * 1024 * 1024 };

export function deriveSigner(s, words, cost = DEFAULT_COST) {
    const normalized = normalizeKey(words);
    if (!isKeyValid(normalized, SECRET_WORDS)) throw new SealError('bad_secret_words');
    const seed = s.crypto_pwhash(32, normalized, SALT, cost.passes, cost.memBytes, s.crypto_pwhash_ALG_ARGON2ID13);
    try {
        return s.crypto_sign_seed_keypair(seed);
    } finally {
        s.memzero(seed);
    }
}

const check = (s, publicKey) => s.crypto_generichash(4, publicKey);

export function encodePublicKey(s, publicKey) {
    const body = new Uint8Array(36);
    body.set(publicKey, 0);
    body.set(check(s, publicKey), 32);
    return PREFIX + s.to_base64(body, s.base64_variants.URLSAFE_NO_PADDING);
}

export function parsePublicKey(s, text) {
    const clean = String(text).replace(/\s+/g, '');
    if (!clean.startsWith(PREFIX)) throw new SealError('bad_public_key');
    let body;
    try {
        body = s.from_base64(clean.slice(PREFIX.length), s.base64_variants.URLSAFE_NO_PADDING);
    } catch {
        throw new SealError('bad_public_key');
    }
    if (body.length !== 36) throw new SealError('bad_public_key');
    const publicKey = body.slice(0, 32);
    if (!s.memcmp(check(s, publicKey), body.slice(32))) throw new SealError('bad_public_key');
    return publicKey;
}

export async function hashFile(s, file) {
    const state = s.crypto_generichash_init(null, 32);
    for (let offset = 0; offset < file.size; offset += CHUNK) {
        s.crypto_generichash_update(state, new Uint8Array(await file.slice(offset, offset + CHUNK).arrayBuffer()));
    }
    return s.to_hex(s.crypto_generichash_final(state, 32));
}

const message = (stamp) => new TextEncoder().encode(JSON.stringify(['stampkey', 1, stamp.name, stamp.size, stamp.hash, stamp.time]));

export function createStamp(s, signer, { name, size, hash, time = new Date().toISOString() }) {
    const stamp = { v: 1, name, size, hash, time, key: encodePublicKey(s, signer.publicKey) };
    stamp.sig = s.to_base64(s.crypto_sign_detached(message(stamp), signer.privateKey), s.base64_variants.URLSAFE_NO_PADDING);
    return stamp;
}

export function readStamp(text) {
    let stamp;
    try {
        stamp = JSON.parse(text);
    } catch {
        return null;
    }
    const ok = stamp && stamp.v === 1 && typeof stamp.name === 'string' && Number.isSafeInteger(stamp.size)
        && /^[0-9a-f]{64}$/.test(stamp.hash) && typeof stamp.time === 'string' && typeof stamp.key === 'string' && typeof stamp.sig === 'string';
    return ok ? stamp : null;
}

export function checkStamp(s, stamp, { hash, size, expectedKey = '' }) {
    let publicKey;
    let sigOk = false;
    try {
        publicKey = parsePublicKey(s, stamp.key);
        sigOk = s.crypto_sign_verify_detached(s.from_base64(stamp.sig, s.base64_variants.URLSAFE_NO_PADDING), message(stamp), publicKey);
    } catch {
        sigOk = false;
    }
    const fileOk = sigOk && stamp.hash === hash && stamp.size === size;
    let keyOk = null;
    if (expectedKey.trim()) {
        try {
            keyOk = sigOk && s.memcmp(parsePublicKey(s, expectedKey), publicKey);
        } catch {
            keyOk = false;
        }
    }
    return { sigOk, fileOk, keyOk, publicKey, key: stamp.key, name: stamp.name, time: stamp.time };
}
