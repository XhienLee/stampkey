import { sodium, saveFile, copyText, messageFor } from './family/lib.js';
import { makeSecretWords, fingerprint } from './js/keypair.js';
import { $, fileButton, notice, renderWords, busy } from './family/ui.js';
import { deriveSigner, encodePublicKey, hashFile, createStamp, readStamp, checkStamp } from './stamp.js';

fileButton('sign-pick', 'sign-file', 'sign-name');
fileButton('check-pick', 'check-file', 'check-name');
fileButton('stamp-pick', 'check-stamp', 'stamp-name', 'No stamp chosen');

let publicText = '';

$('make').addEventListener('click', () => busy($('make'), 'Making your key…', async () => {
    notice('make-alert', '');
    try {
        const s = await sodium();
        const words = makeSecretWords();
        const signer = deriveSigner(s, words.join(' '));
        renderWords($('words'), words);
        publicText = encodePublicKey(s, signer.publicKey);
        $('pubkey').textContent = publicText;
        renderWords($('fp'), fingerprint(s, signer.publicKey));
        $('saved').checked = false;
        $('public').hidden = true;
        $('made').hidden = false;
    } catch (error) {
        notice('make-alert', messageFor(error));
    }
}));

$('saved').addEventListener('change', () => {
    $('public').hidden = !$('saved').checked;
    if (!$('saved').checked) return;
    $('words').replaceChildren();
    $('made').querySelector('.warn').textContent = 'Your words are hidden now. Keep them safe: Stampkey does not save them.';
});

$('copy-pub').addEventListener('click', (event) => copyText(publicText, event.currentTarget));

$('sign').addEventListener('click', () => busy($('sign'), 'Stamping…', async () => {
    notice('stamp-alert', '');
    notice('stamp-done', '');
    const file = $('sign-file').files[0];
    if (!file) return notice('stamp-alert', 'Choose the file to stamp.');
    try {
        const s = await sodium();
        const signer = deriveSigner(s, $('sign-words').value);
        const stamp = createStamp(s, signer, { name: file.name, size: file.size, hash: await hashFile(s, file) });
        saveFile(`${file.name}.stamp`, JSON.stringify(stamp, null, 2) + '\n');
        notice('stamp-done', `Stamped. Keep ${file.name}.stamp next to your file and send both. Your public key starts ${stamp.key.slice(0, 22)}…`, 'ok');
    } catch (error) {
        notice('stamp-alert', messageFor(error));
    }
}));

$('check').addEventListener('click', () => busy($('check'), 'Checking…', async () => {
    notice('check-alert', '');
    $('result').hidden = true;
    const file = $('check-file').files[0];
    const stampFile = $('check-stamp').files[0];
    if (!file || !stampFile) return notice('check-alert', 'Choose both the file and its stamp.');
    const stamp = readStamp(await stampFile.text());
    if (!stamp) return notice('check-alert', "That isn't a stamp file.");
    try {
        const s = await sodium();
        const r = checkStamp(s, stamp, { hash: await hashFile(s, file), size: file.size, expectedKey: $('expected').value });
        const verdict = $('verdict');
        if (!r.sigOk) {
            verdict.className = 'alert';
            verdict.textContent = "This stamp isn't valid. It was changed or it isn't a real stamp.";
        } else if (!r.fileOk) {
            verdict.className = 'alert';
            verdict.textContent = 'The stamp is genuine, but this file is not the one that was stamped. It was changed.';
        } else if (r.keyOk === false) {
            verdict.className = 'alert alert-info';
            verdict.textContent = "The file matches its stamp, but the stamp was made by a different key than the one you entered.";
        } else {
            verdict.className = 'alert alert-ok';
            verdict.textContent = r.keyOk ? 'Genuine. The file is unchanged and was stamped by the key you entered.' : 'Genuine. The file is unchanged since it was stamped.';
        }
        const facts = $('facts');
        facts.replaceChildren();
        for (const [label, value] of [['Stamped file', r.name], ['Stamped on', new Date(r.time).toLocaleString()]]) {
            const row = document.createElement('p');
            const b = document.createElement('b');
            b.textContent = `${label}: `;
            row.append(b, value);
            facts.append(row);
        }
        renderWords($('signer-fp'), r.publicKey ? fingerprint(s, r.publicKey) : []);
        $('result').hidden = false;
    } catch (error) {
        notice('check-alert', messageFor(error));
    }
}));
