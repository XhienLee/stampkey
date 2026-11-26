# Stampkey

**Prove a file is yours and has not been changed.**

Stamp a file with your 12 secret words and you get a small `.stamp` proof. Anyone can check that proof against the file, without needing your words. If even one letter in the file changes, the check fails.

No account. No server. Everything happens in your browser, and your file never leaves your computer.

> **No ready-made website yet.** Stampkey is a plain web page with no server part, so it can go on any static host (Netlify, GitHub Pages, your own site). You can also just open it locally, see "Run it" below.

## What is it good for?

- Proving you had a document, photo or design at a certain time
- Sending a file and letting the receiver check it really came from you and was not altered
- Signing release files, contracts or reports without a certificate authority

## How to use it

**Getting your identity (once)**
1. Press **Make my stamp key**.
2. Write down your **12 secret words** and tick "I wrote down my 12 words". They let you stamp files. They cannot be reset.
3. Press **Copy public key** and share it (`stampkey-pub-…`). It is safe to give to anyone.

**Stamping a file**
1. Type your 12 words, press **Choose file**, then **Stamp this file**.
2. Download the `.stamp` file and send it along with the original.

**Checking a file**
1. Press **Choose file** and **Choose .stamp file**.
2. Paste the signer's public key (optional, but it is how you know who signed).
3. Press **Check it**. You get a clear valid or not valid answer.

## Is it safe? What can it not do?

- Your file never leaves your computer. Only a fingerprint of it is signed.
- A valid stamp means *the holder of that key signed exactly this file*. It does not tell you who that person is. Check the public key with the person by another route (a call, a message) so you know it is really theirs.
- The time in a stamp is the signer's own clock. It shows *when they said they signed*, not a trusted timestamp.
- Lose the 12 words and you cannot stamp as that identity again. Anyone who gets the words can stamp as you.
- It cannot protect you from a hacked device or a fake copy of the website.

## Questions

**Does the stamp contain my file?** No, only its name, size and fingerprint.
**Does it send anything over the internet?** No. After the page loads, all the work happens on your device.
**Do I need an account?** No. Your 12 words are your identity.

---

## For developers

### How it works

- 12 secret words go through Argon2id into an Ed25519 key. The public key is shown as `stampkey-pub-…` (with a 4-byte check).
- The file is hashed in streaming chunks with BLAKE2b-256, then the tool signs `['stampkey', 1, name, size, hash, time]`.
- The `.stamp` file is plain JSON. Anyone can check it with the public key and the file.
- It is static only: no server, no cookies, no network calls (the CSP blocks them).

## Run it

Any static host works. Try it on your computer:

```bash
python3 -m http.server 8800
```

Open <http://localhost:8800>. For Netlify just publish this folder, `_headers` sets the security policy.

## Tests

```bash
node --test tests/stampkey.test.mjs
pip install -r tests/requirements.txt && python3 -m playwright install chromium
python3 tests/e2e.py
```

They check signing and checking (including tampered files and wrong keys) and the whole flow in Chromium.

## The key family

Small private tools. One key each, no accounts, nothing to sign up for.

| Tool | What it does | Needs a server? |
|---|---|---|
| [Sealkey](https://github.com/XhienLee/sealkey) | Lock a file with a few words, open it later | No |
| [Stowkey](https://github.com/XhienLee/stowkey) | Private online file storage, one key | Yes (PHP) |
| [Sendkey](https://github.com/XhienLee/sendkey) | Send a file through a link that works once | Yes (PHP + SQLite) |
| [Dropkey](https://github.com/XhienLee/dropkey) | A link anyone can use to send *you* a file privately | Yes (PHP + SQLite) |
| [Stashkey](https://github.com/XhienLee/stashkey) | Private notes you open with 6 words | Yes (PHP + SQLite) |
| [Stampkey](https://github.com/XhienLee/stampkey) | Prove a file is yours and unchanged | No |

## Credits

The word list, file format and crypto in `js/` come from [Sealkey](https://github.com/XhienLee/sealkey). The encryption library is [libsodium](https://github.com/jedisct1/libsodium.js) in `vendor/`. MIT licensed, free to use and change.
