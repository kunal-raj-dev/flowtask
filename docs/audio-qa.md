# FlowTask 2.0 audio delivery and review

The shipped catalog contains twelve layers derived from real field recordings and eighteen distinct instrumental compositions: three each in lo-fi, ambient/drone, soft piano, instrumental jazz, chillhop, and minimal electronic. There are no generated noise tracks disguised as field recordings, provider-stream extracts, or duplicated files filling track counts.

## Runtime integration

- Read `/media/audio/catalog.json`; filter `category` rather than inferring it from an ID prefix. Music tracks named `ambient-*` belong to the ambient/drone music genre.
- MP3 `src` is the universal fallback. Ambient `opusSrc` is an additional compressed, gapless-capable source; use decoded buffers with Web Audio for accurate loop boundaries.
- `loop: true` identifies the twelve mastered ambient loops. Music entries preserve the complete compositions and use `loop: false`; sequence the next selection or gently fade when repeating a track.
- Preserve `attribution`, `creator`, `license`, `licenseUrl`, and `sourceUrl` in the visible credits interface. Three works use CC BY 3.0 and one uses CC BY 4.0; attribution is a requirement for those four works.
- Readable complete credits: `/media/audio/CREDITS.md`. The source/rights ledger is `/media/audio/provenance.json`.
- The quiet-library layer uses the creator's public HQ Freesound preview under its CC0 license. Source WAV download credentials were never accessed.

## Completed technical checks

`python scripts/audio-build.py --verify` checks catalog counts and six genre groups, unique IDs and hashes, file sizes and SHA-256 integrity, successful decoding of all thirty MP3 files and twelve Opus alternatives, decoded duration, finite samples, audible signal, and absence of decoded clipping.

Mastering removes DC offset, provides conservative level/headroom, and makes ambient seams circular using a maximum two-second linear crossfade. Peak/RMS levels and PCM seam measurements are in `technical-qa.json`. Thunder is a spacious arrangement of one real thunder recording with quiet gaps, as documented in the credits; it is not synthesized audio.

## Listening and browser release check still required

Automated decoding and waveform checks cannot establish subjective listening quality. A human reviewer must complete these checks before claiming the final listening gate has passed:

1. Listen to each ambient layer alone on headphones at a moderate level, including two complete loop seams. Check clicks, conspicuous repeats, distracting speech, abrupt events, hum, and distortion.
2. Listen to the beginning, middle, and end of every music track. Confirm instrumental content, genre/mood fit, comfortable transitions, and no unpleasant surprises.
3. Play four ambient layers plus one music track. Start low, then adjust each gain without restarting playback. Check fades on pause/resume and session completion.
4. Test gesture-unlocked playback and interruption recovery in current Chrome/Edge, Firefox, desktop Safari, iOS Safari, and Android Chrome; test both MP3 and Opus selection paths.
5. Verify offline-selected assets play while offline and that a network failure never blocks the timer or task interface.

Total shipped audio is approximately 56.45 MB including both codecs. The eighteen compositions provide approximately forty minutes of music. Downloads are lazy runtime assets; do not include the entire library in an unconditional PWA precache.
