import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sodium } from './helpers.mjs';
import { makeSecretWords } from '../js/keypair.js';
import { deriveSigner, encodePublicKey, parsePublicKey, hashFile, createStamp, readStamp, checkStamp } from '../stamp.js';

const FAST = { passes: 1, memBytes: 8192 };
const file = (text, name = 'note.txt') => new File([text], name);
const words12 = () => makeSecretWords().join(' ');

test('stampkey: a stamp checks out for the same file and the right signer', async () => {
    const s = await sodium();
    const signer = deriveSigner(s, words12(), FAST);
    const f = file('contract v1', 'contract.txt');
    const stamp = createStamp(s, signer, { name: f.name, size: f.size, hash: await hashFile(s, f) });
    assert.ok(readStamp(JSON.stringify(stamp)));
    const result = checkStamp(s, stamp, { hash: await hashFile(s, f), size: f.size, expectedKey: stamp.key });
    assert.deepEqual([result.sigOk, result.fileOk, result.keyOk], [true, true, true]);
});

test('stampkey: a changed file, a changed stamp and a different signer are all caught', async () => {
    const s = await sodium();
    const signer = deriveSigner(s, words12(), FAST);
    const other = deriveSigner(s, words12(), FAST);
    const f = file('contract v1');
    const stamp = createStamp(s, signer, { name: f.name, size: f.size, hash: await hashFile(s, f) });
    const changed = file('contract v2');
    const bad = checkStamp(s, stamp, { hash: await hashFile(s, changed), size: changed.size });
    assert.deepEqual([bad.sigOk, bad.fileOk], [true, false]);
    const forged = { ...stamp, time: '2020-01-01T00:00:00.000Z' };
    assert.equal(checkStamp(s, forged, { hash: stamp.hash, size: stamp.size }).sigOk, false);
    const swapped = { ...stamp, key: encodePublicKey(s, other.publicKey) };
    assert.equal(checkStamp(s, swapped, { hash: stamp.hash, size: stamp.size }).sigOk, false);
    const wrongKey = checkStamp(s, stamp, { hash: stamp.hash, size: stamp.size, expectedKey: encodePublicKey(s, other.publicKey) });
    assert.deepEqual([wrongKey.sigOk, wrongKey.keyOk], [true, false]);
    assert.equal(readStamp('not json'), null);
    assert.equal(readStamp(JSON.stringify({ ...stamp, hash: 'xyz' })), null);
});

test('stampkey: the same words give the same signer; public keys catch typos; bad words are refused', async () => {
    const s = await sodium();
    const words = words12();
    const a = deriveSigner(s, words, FAST);
    assert.deepEqual(a.publicKey, deriveSigner(s, words.toUpperCase().replace(/ /g, '-'), FAST).publicKey);
    const text = encodePublicKey(s, a.publicKey);
    assert.deepEqual(parsePublicKey(s, ` ${text.slice(0, 20)}\n${text.slice(20)} `), a.publicKey);
    assert.throws(() => parsePublicKey(s, text.slice(0, -1) + (text.at(-1) === 'A' ? 'B' : 'A')), { code: 'bad_public_key' });
    assert.throws(() => deriveSigner(s, 'tiger mango', FAST), { code: 'bad_secret_words' });
});

test('stampkey: a big file hashes the same as the whole file at once', async () => {
    const s = await sodium();
    const big = new Uint8Array(9 * 1024 * 1024 + 5).map((_, i) => i % 251);
    assert.equal(await hashFile(s, new File([big], 'big.bin')), s.to_hex(s.crypto_generichash(32, big)));
});
