# Run with: python3 tests/e2e.py   (needs php and Playwright's Chromium, see tests/requirements.txt)
import json
import os
import pathlib
import random
import shutil
import subprocess
import sys
import tempfile
import time

os.environ['NO_PROXY'] = '*'
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
WORK = pathlib.Path(tempfile.mkdtemp())
PORT = 18900 + random.randint(0, 90)
BASE = f'http://127.0.0.1:{PORT}/'
results = [0, 0]


def check(name, ok, info=''):
    results[0 if ok else 1] += 1
    print(('PASS ' if ok else 'FAIL ') + name + ('' if ok else f'  {info}'), flush=True)


def write(name, data):
    path = WORK / name
    path.write_bytes(data if isinstance(data, bytes) else data.encode())
    return path


env = dict(os.environ, FAMILY_DATA_DIR=str(WORK / 'data'), FAMILY_MIN_FREE_BYTES='0')
server = subprocess.Popen(['php', '-d', 'post_max_size=40M', '-S', f'127.0.0.1:{PORT}', '-t', str(ROOT), str(ROOT / 'router.php')], env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1.2)


class Tab:
    def __init__(self, context, path):
        self.page = context.new_page()
        self.errors = []
        self.requests = []
        self.page.on('pageerror', lambda e: self.errors.append('PAGEERROR ' + str(e)))
        self.page.on('console', lambda m: self.errors.append(m.text) if m.type == 'error' and 'status of 4' not in m.text else None)
        self.page.on('request', lambda r: self.requests.append(r))
        self.page.goto(BASE + path)


def words_of(page, selector):
    return page.locator(f'{selector} .key-word').all_inner_texts()


def body_has(tab, needle):
    return any(r.method == 'POST' and r.post_data_buffer and needle in r.post_data_buffer for r in tab.requests)


try:
    with sync_playwright() as pw:
        browser = pw.chromium.launch(args=['--no-proxy-server'])
        context = browser.new_context(accept_downloads=True, viewport={'width': 1100, 'height': 900})

        stamp = Tab(context, '')
        p = stamp.page
        p.click('#make')
        p.wait_for_selector('#words li', timeout=90000)
        words = ' '.join(words_of(p, '#words'))
        check('stampkey: 12 secret words are made', len(words.split()) == 12)
        check('stampkey: the public key stays hidden until the words are saved', not p.is_visible('#public'))
        p.check('#saved')
        p.wait_for_selector('#public', state='visible')
        pub = p.inner_text('#pubkey')
        check('stampkey: a public key and a 6-word fingerprint appear', pub.startswith('stampkey-pub-') and len(words_of(p, '#fp')) == 6)
        contract = write('contract.txt', 'Pay Alex 100 euros.')
        p.fill('#sign-words', words)
        p.set_input_files('#sign-file', str(contract))
        with p.expect_download(timeout=90000) as download:
            p.click('#sign')
        stamp_path = WORK / 'contract.txt.stamp'
        download.value.save_as(stamp_path)
        check('stampkey: stamping a file saves a .stamp file', download.value.suggested_filename == 'contract.txt.stamp' and json.loads(stamp_path.read_text())['key'] == pub)
        p.set_input_files('#check-file', str(contract))
        p.set_input_files('#check-stamp', str(stamp_path))
        p.fill('#expected', pub)
        p.click('#check')
        p.wait_for_selector('#result', state='visible', timeout=30000)
        check('stampkey: the right file and stamp are genuine, from the expected key', 'Genuine' in p.inner_text('#verdict') and 'key you entered' in p.inner_text('#verdict'), p.inner_text('#verdict'))
        check('stampkey: the signer fingerprint matches the maker', words_of(p, '#signer-fp') == words_of(p, '#fp'))
        p.set_input_files('#check-file', str(write('changed.txt', 'Pay Alex 900 euros.')))
        p.click('#check')
        p.wait_for_function('document.getElementById("verdict").textContent.includes("not the one")', timeout=30000)
        check('stampkey: a changed file is caught', True)
        tampered = json.loads(stamp_path.read_text())
        tampered['time'] = '2020-01-01T00:00:00.000Z'
        p.set_input_files('#check-file', str(contract))
        p.set_input_files('#check-stamp', str(write('tampered.stamp', json.dumps(tampered))))
        p.click('#check')
        p.wait_for_function('document.getElementById("verdict").textContent.includes("isn\'t valid")', timeout=30000)
        check('stampkey: a changed stamp is caught', True)
        p.fill('#expected', 'stampkey-pub-' + pub[13:-2] + ('AA' if not pub.endswith('AA') else 'BB'))
        p.set_input_files('#check-stamp', str(stamp_path))
        p.click('#check')
        p.wait_for_function('document.getElementById("verdict").textContent.includes("different")', timeout=30000)
        check('stampkey: a different expected key is flagged', True)
        check('stampkey: nothing is sent to a server', not any('api.php' in r.url for r in stamp.requests) and not any(r.method == 'POST' for r in stamp.requests))
        check('stampkey: no console errors', not stamp.errors, stamp.errors[:3])
        browser.close()
finally:
    server.terminate()
    server.wait()
    shutil.rmtree(WORK, ignore_errors=True)

print(f'{results[0]} passed, {results[1]} failed')
sys.exit(1 if results[1] else 0)
