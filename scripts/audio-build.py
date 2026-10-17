"""Build FlowTask's licensed audio catalog from individually verified primary pages.

Requires Python 3, numpy and imageio-ffmpeg. Source downloads stay in the OS temp
directory. Run from the repository root; --verify checks shipped files offline.
"""
from __future__ import annotations

import argparse
import concurrent.futures
import hashlib
import html
import json
import math
import os
from pathlib import Path
import re
import subprocess
import tempfile
import urllib.parse
import urllib.request

import imageio_ffmpeg
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'public/media/audio'
CACHE = Path(tempfile.gettempdir()) / 'flowtask-audio-sources'
RATE = 44100
VERIFIED = '2026-10-16'
CC0 = 'https://creativecommons.org/publicdomain/zero/1.0/'
BY3 = 'https://creativecommons.org/licenses/by/3.0/'
BY4 = 'https://creativecommons.org/licenses/by/4.0/'


def bsb(id, title, slug, start=0, seconds=65):
    return dict(id='ambient-' + id, title=title, category='ambient', genre='field-recording',
                sourceUrl='https://bigsoundbank.com/' + slug + '.html',
                creator='Joseph SARDIN', license='CC0-1.0', licenseUrl=CC0,
                downloadUrl='https://bigsoundbank.com/UPLOAD/mp3/' + re.search(r's(\d+)$', slug)[1] + '.mp3',
                start=start, seconds=seconds)


def oga(id, title, genre, slug, filename, creator, license='CC0-1.0'):
    return dict(id=id, title=title, category='music', genre=genre,
                sourceUrl='https://opengameart.org/content/' + slug,
                downloadUrl='https://opengameart.org/sites/default/files/' + urllib.parse.quote(filename),
                creator=creator, license=license,
                licenseUrl=CC0 if license == 'CC0-1.0' else BY3 if license == 'CC-BY-3.0' else BY4)


SOURCES = [
    bsb('rain', 'Gentle rain', 'rain-on-puddle-s1290', 8, 65),
    dict(id='ambient-window-rain', title='Rain on a window', category='ambient', genre='field-recording',
         sourceUrl='https://opengameart.org/content/rain-on-window-loop',
         downloadUrl='https://opengameart.org/sites/default/files/rain_on_window_loop.wav',
         creator='alxl', license='CC0-1.0', licenseUrl=CC0, seconds=11),
    bsb('thunder', 'Distant thunder', 'thunder-s2718', 0, 23),
    bsb('forest', 'Forest air', 'forest-s0100', 3, 49),
    bsb('birds', 'Morning birds', 'wake-birds-3-s0999', 30, 85),
    bsb('stream', 'Mountain stream', 'small-stream-4-s1354', 8, 80),
    bsb('ocean', 'Ocean waves', 'sea-waves-s0266', 3, 50),
    bsb('fireplace', 'Fireplace', 'fireplace-5-s2857', 3, 39),
    bsb('cafe', 'Café murmur', 'coffee-shop-at-the-capucins-s2561', 20, 85),
    dict(id='ambient-library', title='Quiet library', category='ambient', genre='field-recording',
         sourceUrl='https://freesound.org/people/xkeril/sounds/620683/',
         downloadUrl='https://cdn.freesound.org/previews/620/620683_13504080-hq.mp3',
         creator='xkeril', license='CC0-1.0', licenseUrl=CC0, start=40, seconds=90,
         sourceNote='HQ preview of the uploader\'s CC0 university-library recording; no account-only original was accessed.'),
    bsb('train', 'Train carriage', 'metro-paris-2-s0092', 9, 39),
    bsb('fan', 'Desk fan', 'electric-fan-2-s0079', 1, 8),
    oga('lofi-hiphop', 'Lo-fi Hip Hop', 'lofi', 'lofi-hip-hop', 'lofihiphop.ogg', 'omfgdude'),
    oga('lofi-again', 'Lo-fi Again', 'lofi', 'lofi-again', 'lofiagain.ogg', 'omfgdude'),
    oga('lofi-loop', 'Lo-fi Hip Hop Loop', 'lofi', 'lofi-hip-hop-loop', 'LofiLoop_2.ogg', 'omfgdude'),
    oga('ambient-contemplation', 'Contemplation', 'ambient-drone', 'contemplation-0', 'Contemplation.mp3', 'Joth'),
    oga('ambient-heavenly', 'Heavenly', 'ambient-drone', 'heavenly-loop', 'Heavenly Loop_0.ogg', 'isaiah658'),
    oga('ambient-searching', 'Searching', 'ambient-drone', 'searching', 'Searching.ogg', 'yd'),
    oga('piano-vaporware', 'Vaporware', 'soft-piano', 'calm-piano-1-vaporware', '003_Vaporware_2.mp3', 'The Cynic Project / cynicmusic.com / pixelsphere.org'),
    oga('piano-fireplace', 'A Warm Fireplace', 'soft-piano', 'snowy-cozyness-calm-pianoguitar', 'A Warm Fireplace.ogg', 'MouthlessGames', 'CC-BY-3.0'),
    oga('piano-home', 'I Never Came Home Again', 'soft-piano', 'snowy-cozyness-calm-pianoguitar', 'I Never Came Home Again.ogg', 'MouthlessGames', 'CC-BY-3.0'),
    oga('jazz-fusion', 'Fusion Jazz', 'instrumental-jazz', 'basically-not-fusion-jazz', 'fusion jazz_0.ogg', 'Julie Damsgaard / Spring Spring'),
    oga('jazz-cafe', 'Late Night Jazz Cafe', 'instrumental-jazz', 'late-night-jazz-cafe', '06 late night club.mp3', 'Ben Davis / benjobanjo', 'CC-BY-3.0'),
    oga('jazz-one-step', 'One Step at a Time', 'instrumental-jazz', 'one-step-at-a-time', 'OneStepAtATIme.wav', 'Alex McCulloch / Pro Sensory'),
    oga('chillhop-inspired', 'Chill Lo-fi', 'chillhop', 'chill-lofi-inspired-loop-edit', 'chilllofir-loop.ogg', 'omfgdude; loop edit by Iwan Gabovitch / qubodup'),
    oga('chillhop-funky', 'Funky Lo-fi Jam', 'chillhop', 'funky-hip-hop-lofi-jam', 'CVP701Jam-Lowpass.ogg', 'omfgdude'),
    oga('chillhop-first-snow', 'First Snow', 'chillhop', 'lo-fi-and-chill-collection', '01_holiznacc0_-_first_snow.mp3.mp3', 'Holizna / HoliznaCC0'),
    oga('electronic-aether', 'Minimal Aether', 'minimal-electronic', 'minimal-aether', 'minimal_aether.ogg', 'nihilocrat', 'CC-BY-4.0'),
    oga('electronic-bells', 'Chilly Bells', 'minimal-electronic', 'chilly-bells', 'chilly_bells_2.wav', 'Alex McCulloch / Pro Sensory'),
    oga('electronic-synthwave', 'Synthwave 4k', 'minimal-electronic', 'calm-ambient-1-synthwave-4k', '001_Synthwave_4k_0.mp3', 'The Cynic Project / cynicmusic.com / pixelsphere.org'),
]


def get(url: str) -> bytes:
    if url.startswith('https://cdn.freesound.org/'):
        # Freesound's CDN can stall long transfers. Small public byte-range
        # requests preserve the exact complete file without bypassing access.
        with urllib.request.urlopen(urllib.request.Request(url, method='HEAD'), timeout=30) as response:
            size = int(response.headers['Content-Length'])
        chunk = 65536
        def part(start):
            end = min(start + chunk, size) - 1
            req = urllib.request.Request(url, headers={'Range': f'bytes={start}-{end}'})
            with urllib.request.urlopen(req, timeout=30) as response:
                assert response.status == 206
                data = response.read()
                assert len(data) == end - start + 1
                return data
        with concurrent.futures.ThreadPoolExecutor(max_workers=4) as executor:
            return b''.join(executor.map(part, range(0, size, chunk)))
    request = urllib.request.Request(url, headers={'User-Agent': 'FlowTask/2.0 asset-verification (licensed audio attribution)'})
    with urllib.request.urlopen(request, timeout=75) as response:
        return response.read()


def verify_page(source: dict) -> dict:
    page = get(source['sourceUrl'])
    content = page.decode('utf-8', errors='replace')
    text = re.sub(r'\s+', ' ', html.unescape(re.sub('<[^>]+>', ' ', content)))
    if 'opengameart.org' in source['sourceUrl']:
        section = text[text.index('License(s)'):text.index('License(s)') + 110]
        required = {'CC0-1.0': 'CC0', 'CC-BY-3.0': 'CC-BY 3.0', 'CC-BY-4.0': 'CC-BY 4.0'}[source['license']]
    elif 'bigsoundbank.com' in source['sourceUrl']:
        required = 'CC0 (public domain)'
        start = text.index(required)
        section = text[start:start + 85]
        assert 'Joseph' in text and 'SARDIN' in text
    else:
        required = 'Creative Commons 0'
        start = text.index(required)
        section = text[start:start + 160]
    assert required in section, f"License mismatch: {source['id']}"
    # Every download must occur on that asset's primary page; permits URL encoding.
    assert urllib.parse.unquote(source['downloadUrl']) in urllib.parse.unquote(content), f"File is not on the asset page: {source['id']}"
    suffix = Path(urllib.parse.urlparse(source['downloadUrl']).path).suffix
    raw = CACHE / (source['id'] + suffix)
    if not raw.exists():
        raw.write_bytes(get(source['downloadUrl']))
    assert raw.stat().st_size > 15000, f"Invalid download: {source['id']}"
    return dict(source, raw=str(raw), licenseEvidence=section,
                pageSha256=hashlib.sha256(page).hexdigest(),
                sourceSha256=hashlib.sha256(raw.read_bytes()).hexdigest())


def ffmpeg(args: list[str], input: bytes | None = None) -> subprocess.CompletedProcess:
    return subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(), '-hide_banner', '-loglevel', 'error', *args],
                          input=input, stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True)


def build(source: dict) -> tuple[dict, dict]:
    args = ['-i', source['raw']]
    if source.get('start'):
        args += ['-ss', str(source['start'])]
    if source.get('seconds'):
        args += ['-t', str(source['seconds'])]
    decoded = ffmpeg([*args, '-ar', str(RATE), '-ac', '2', '-f', 'f32le', 'pipe:1']).stdout
    samples = np.frombuffer(decoded, dtype='<f4').reshape(-1, 2).copy()
    samples -= samples.mean(axis=0)
    if source['id'] == 'ambient-thunder':
        # A spacious arrangement of the actual thunder recording, with quiet gaps.
        # This is a processed field recording, not synthetic noise or a new recording.
        arranged = np.zeros((RATE * 96, 2), dtype=np.float32)
        for offset, gain in [(4, .7), (39, .5), (72, .62)]:
            end = min(len(arranged), offset * RATE + len(samples))
            arranged[offset * RATE:end] += samples[:end - offset * RATE] * gain
        samples = arranged
    if source['category'] == 'ambient':
        # Rotate a linear tail/head crossfade to the middle of the loop. The file
        # boundary now consists of consecutive original samples, not a fade to silence.
        fade = min(RATE * 2, len(samples) // 8)
        t = np.linspace(0, 1, fade, endpoint=False, dtype=np.float32)[:, None]
        join = samples[-fade:] * (1 - t) + samples[:fade] * t
        samples = np.concatenate((samples[fade:-fade], join), axis=0)
        shift = len(samples) // 2
        samples = np.concatenate((samples[shift:], samples[:shift]), axis=0)
    else:
        # Preserve the full composition; short edge fades prevent clicks on transitions.
        fade = min(int(RATE * .06), len(samples) // 30)
        ramp = np.linspace(0, 1, fade, dtype=np.float32)[:, None]
        samples[:fade] *= ramp
        samples[-fade:] *= ramp[::-1]
    rms = float(np.sqrt(np.mean(samples.astype(np.float64) ** 2)))
    assert rms > 0.000001 and np.isfinite(samples).all(), source['id']
    target_db = -26 if source['category'] == 'ambient' else -23
    gain = min(10 ** (target_db / 20) / rms, .78 / float(np.max(np.abs(samples))))
    samples *= gain
    folder = OUT / source['category']
    folder.mkdir(exist_ok=True)
    target = folder / (source['id'] + '.mp3')
    common = ['-f', 'f32le', '-ar', str(RATE), '-ac', '2', '-i', 'pipe:0', '-map_metadata', '-1',
              '-metadata', 'title=' + source['title'], '-metadata', 'artist=' + source['creator'],
              '-metadata', 'copyright=' + source['license'] + ' ' + source['sourceUrl']]
    ffmpeg([*common, '-c:a', 'libmp3lame', '-b:a', '128k', '-write_xing', '1', '-y', str(target)], samples.astype('<f4').tobytes())
    duration = round(len(samples) / RATE, 3)
    item = {key: source[key] for key in ['id', 'title', 'category', 'genre', 'license', 'licenseUrl', 'creator', 'sourceUrl']}
    item.update(src='/media/audio/' + source['category'] + '/' + target.name,
                durationSeconds=duration, loop=source['category'] == 'ambient', verifiedAt=VERIFIED,
                bytes=target.stat().st_size, sha256=hashlib.sha256(target.read_bytes()).hexdigest(),
                attribution=f"{source['title']} — {source['creator']} ({source['license']}). Source: {source['sourceUrl']}. Edited and encoded for FlowTask.")
    if source['category'] == 'ambient':
        opus = target.with_suffix('.ogg')
        ffmpeg([*common, '-c:a', 'libopus', '-b:a', '96k', '-y', str(opus)], samples.astype('<f4').tobytes())
        item['opusSrc'] = '/media/audio/ambient/' + opus.name
        item['opusBytes'] = opus.stat().st_size
    qa = dict(id=source['id'], durationSeconds=duration, channels=2, sampleRate=RATE,
              samplePeakDb=round(20 * math.log10(float(np.max(np.abs(samples)))), 2),
              rmsDb=round(20 * math.log10(float(np.sqrt(np.mean(samples.astype(np.float64) ** 2)))), 2),
              pcmBoundaryStep=float(np.max(np.abs(samples[-1] - samples[0]))),
              processed='DC removal; peak-limited RMS normalization; ' +
                        ('2-second maximum circular seam crossfade; MP3/Opus encoding' if item['loop'] else '60ms edge fades; full composition; MP3 encoding'))
    if source['id'] == 'ambient-thunder':
        qa['processed'] += '; spacious 96-second arrangement of one actual thunder recording'
    return item, qa


def verify_shipped():
    catalog = json.loads((OUT / 'catalog.json').read_text(encoding='utf-8'))
    assert len(catalog) == 30
    assert len({x['id'] for x in catalog}) == 30
    assert len({x['sha256'] for x in catalog}) == 30, 'Duplicate audio files'
    genres = {}
    for item in catalog:
        path = ROOT / 'public' / item['src'].lstrip('/')
        assert path.exists() and path.stat().st_size == item['bytes'], item['id']
        assert hashlib.sha256(path.read_bytes()).hexdigest() == item['sha256'], item['id']
        result = ffmpeg(['-i', str(path), '-ar', str(RATE), '-ac', '2', '-f', 'f32le', 'pipe:1'])
        assert not result.stderr, result.stderr
        decoded = np.frombuffer(result.stdout, dtype='<f4').reshape(-1, 2)
        assert np.isfinite(decoded).all() and len(decoded) > RATE * 3, item['id']
        assert abs(len(decoded) / RATE - item['durationSeconds']) < .1, item['id']
        assert float(np.max(np.abs(decoded))) < .999, f"Clipped MP3: {item['id']}"
        assert float(np.sqrt(np.mean(decoded.astype(np.float64) ** 2))) > .00001, f"Silent MP3: {item['id']}"
        if item['category'] == 'music':
            genres[item['genre']] = genres.get(item['genre'], 0) + 1
        else:
            opus = ROOT / 'public' / item['opusSrc'].lstrip('/')
            assert opus.exists()
            result = ffmpeg(['-i', str(opus), '-ar', str(RATE), '-ac', '2', '-f', 'f32le', 'pipe:1'])
            decoded = np.frombuffer(result.stdout, dtype='<f4').reshape(-1, 2)
            assert abs(len(decoded) / RATE - item['durationSeconds']) < .1, item['id']
            assert np.isfinite(decoded).all() and float(np.max(np.abs(decoded))) < .999, item['id']
    assert len(genres) == 6 and set(genres.values()) == {3}, genres
    print(f"Verified {len(catalog)} distinct playable files; 12 field-recording loops; 18 music tracks ({genres}).")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--verify', action='store_true')
    args = parser.parse_args()
    if args.verify:
        verify_shipped()
        return
    OUT.mkdir(parents=True, exist_ok=True)
    CACHE.mkdir(exist_ok=True)
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as executor:
        sources = list(executor.map(verify_page, SOURCES))
    print(f'Verified {len(sources)} source pages and downloads.', flush=True)
    catalog, qa = [], []
    for source in sources:
        item, report = build(source)
        catalog.append(item)
        qa.append(report)
        print(f"Built {item['id']}: {item['durationSeconds']}s", flush=True)
    (OUT / 'catalog.json').write_text(json.dumps(catalog, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
    evidence = [{k: v for k, v in x.items() if k != 'raw'} for x in sources]
    (OUT / 'provenance.json').write_text(json.dumps(evidence, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
    (OUT / 'technical-qa.json').write_text(json.dumps(qa, indent=2) + '\n', encoding='utf-8')
    credits = ['# FlowTask 2.0 audio credits', '',
               'Each entry was checked on the uploader or original creator\'s asset page on ' + VERIFIED + '.',
               'All shipped audio is stored locally; there are no streaming-provider embeds or extracts.', '',
               'CC0 files are public-domain dedications. CC BY files require attribution; preserve the credits below in the app and redistributions.',
               'Changes: field-recording excerpts, DC removal, quiet RMS normalization with peak headroom, circular loop-seam crossfades; music edge fades and MP3 encoding. Thunder is a spacious arrangement of an actual recording.',
               'Music remains full-length compositions and is not represented as seamless looping audio. Piano collection includes gentle guitar accompaniment.', '',
               '## Attribution and license evidence', '', '| File | Work and creator | License | Primary asset page |', '|---|---|---|---|']
    for item in catalog:
        credits.append(f"| `{item['src']}` | {item['title']} — {item['creator']} | [{item['license']}]({item['licenseUrl']}) | [Source]({item['sourceUrl']}) |")
    credits.extend(['', 'The Quiet Library layer uses Freesound\'s public HQ MP3 preview of xkeril\'s CC0 university-library recording; it does not use the account-only WAV download.',
                    'First Snow is the individual preview/download supplied by Holizna on their own CC0 Lo-Fi and Chill collection asset submission.',
                    '', '## Verification boundary', '',
                    '`provenance.json` records exact download URLs, source SHA-256 values, page hashes and observed license statements. `technical-qa.json` records duration, peak/RMS levels and PCM seam measurements.',
                    'All files are decoded in the offline verification command. Human headphone listening across loop seams and on the six music genres remains a release check; technical verification does not establish subjective listening quality.', '',
                    'Rebuild: `python scripts/audio-build.py` with numpy and imageio-ffmpeg installed. Verify without network: `python scripts/audio-build.py --verify`.', ''])
    (OUT / 'CREDITS.md').write_text('\n'.join(credits), encoding='utf-8')
    verify_shipped()


if __name__ == '__main__':
    main()
