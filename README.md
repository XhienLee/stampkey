# Stampkey

Prove a file is yours and hasn't changed. Stamp a file with your stamp key, and anyone can check the stamp later in their browser. Nothing is uploaded, and there is no server.

Part of the key family, small private tools with one key each and no accounts, next to [Sealkey](https://github.com/XhienLee/sealkey) and [Stowkey](https://github.com/XhienLee/stowkey).

## How it works

1. **Your key:** 12 random words from Sealkey's word list (about 155 bits). Stampkey shows them once and never saves them.
2. **Your signing key:** the words go through Argon2id (3 passes, 64 MiB) into a 32-byte seed, which makes an Ed25519 key pair. The same words always make the same key.
3. **Stamping:** your browser hashes the file with BLAKE2b-256, in 4 MiB pieces so large files are fine. It signs the file's name, size, hash and the time. The result is a small `.stamp` file of plain JSON that holds a `stampkey-pub-…` public key and the signature.
4. **Checking:** the checker's browser hashes the file again and verifies the signature. It reports three separate things: the stamp is genuine, the file matches it, and, if a public key was entered, the signer is the one expected.
5. **Fingerprint:** every public key also has a 6-word fingerprint to compare by call or in person.

## What it cannot do

- A stamp proves that whoever holds the key made it, not who that is. Compare the 6-word fingerprint with the signer in person or by call.
- The time inside a stamp is what the signer's computer said. It is not a trusted timestamp.
- Stamps cannot be revoked. If your 12 words leak, anyone can stamp as you, so make a new key and tell people.
- If you lose the words you can't stamp any more, but old stamps still check out.
- It can't protect you from a hacked device or a changed copy of this website.

## Run it

It is static files. Serve the folder with anything. To try it on your computer with the same Content-Security-Policy as `_headers` gives on Netlify:

```bash
php -S 127.0.0.1:8800 router.php
```

Then open <http://127.0.0.1:8800>.

## Tests

```bash
node --test tests/stampkey.test.mjs
pip install -r tests/requirements.txt && python3 -m playwright install chromium
python3 tests/e2e.py
```

The first checks stamping, tampering, wrong signers, public-key typos and big files. The second drives the page in Chromium (it needs `php` for the test server) and checks that nothing is sent anywhere.

## Credits

The word list, Argon2 setup and key handling in `js/` come from [Sealkey](https://github.com/XhienLee/sealkey), and the encryption library is [libsodium](https://github.com/jedisct1/libsodium.js) in `vendor/`. MIT licensed.
