"""Offline, reproducible onset/tempo analysis. Runtime game needs only the JSON.
Requires numpy, scipy, soundfile; optionally set BREATH_MEDIA_TOOLS to their folder.
"""
import os, sys, json
from pathlib import Path
if os.environ.get('BREATH_MEDIA_TOOLS'):
    sys.path.insert(0, os.environ['BREATH_MEDIA_TOOLS'])
import numpy as np
import soundfile as sf
from scipy import signal, ndimage

ROOT = Path(__file__).resolve().parents[1]
tracks = []
for index, filename in enumerate(['oceanic-wash.mp3', 'oceanic-wash-2.mp3']):
    raw, sr = sf.read(ROOT / 'assets/audio' / filename, dtype='float32')
    duration = len(raw) / sr
    mono = raw.mean(axis=1)
    y = signal.resample_poly(mono, 1, 3)  # supplied files are 48 kHz
    rate, hop, nfft = sr / 3, 160, 1024
    frames = np.lib.stride_tricks.sliding_window_view(y, nfft)[::hop]
    spectra = np.abs(np.fft.rfft(frames * np.hanning(nfft), axis=1)).astype('float32')
    freq = np.fft.rfftfreq(nfft, 1 / rate)
    band = (freq > 60) & (freq < 5500)
    logmag = np.log1p(spectra[:, band] * 8)
    flux = np.maximum(0, np.diff(logmag, axis=0, prepend=logmag[:1])).mean(axis=1)
    flux = np.maximum(0, flux - ndimage.median_filter(flux, size=101))
    flux = ndimage.gaussian_filter1d(flux, .8)
    flux /= max(np.percentile(flux, 99), 1e-7)
    times = (np.arange(len(flux)) * hop + nfft / 2) / rate
    env_rate = rate / hop
    ac = signal.correlate(flux, flux, mode='full', method='fft')[len(flux)-1:]
    lags = np.arange(int(env_rate * 60 / 150), int(env_rate * 60 / 60))
    peaks, _ = signal.find_peaks(ac[lags])
    ranked = sorted(lags[peaks], key=lambda lag: ac[lag], reverse=True)[:6]
    candidates = [(round(60 * env_rate / lag, 2), round(float(ac[lag] / ac[0]), 3)) for lag in ranked]
    best = None
    # Refine tempo and phase using the complete song instead of a guessed BPM.
    for rough, _ in candidates[:3]:
        for bpm in np.arange(rough - 1.3, rough + 1.3, .025):
            beat = 60 / bpm
            for phase in np.arange(0, beat, .025):
                grid = np.arange(phase + beat * 8, duration - 3, beat)
                samples = np.interp(grid, times, flux)
                score = np.mean(np.minimum(samples, 2))
                if best is None or score > best[0]: best = (score, bpm, phase)
    score, bpm, phase = best
    beat = 60 / bpm
    notes = []
    beat_index = 0
    # A gentle phrase-based arrangement. Notes are snapped to actual local attacks.
    for nominal in np.arange(phase, duration - 4, beat):
        i = beat_index; beat_index += 1
        if nominal < 5: continue
        phrase = (i // 32) % 4
        if i % 2 and (phrase in [0, 3] or i % 8 not in [3, 7]): continue
        if i % 32 in [30, 31]: continue  # leave breathing space at phrase endings
        window = np.flatnonzero(abs(times - nominal) < min(.12, beat * .18))
        j = window[np.argmax(flux[window])]
        attack = float(times[j]) if flux[j] > .10 else float(nominal)
        if notes and attack - notes[-1]['time'] < .40: continue
        notes.append({'time': round(attack, 3), 'accent': bool(i % 8 == 0), 'phrase': i // 32,
                      'strength': round(float(min(flux[j], 2)), 3)})
    energy = np.sqrt(np.mean(frames ** 2, axis=1))
    bins = np.arange(0, duration, .25)
    energies = np.interp(bins, times, energy)
    energies /= max(np.percentile(energies, 95), .0001)
    item = {'id': f'wash{index+1}', 'title': 'Oceanic Wash' + (' 2' if index else ''),
            'src': 'assets/audio/' + filename, 'duration': round(duration, 3),
            'bpm': round(float(bpm), 2), 'beatOffset': round(float(phase), 3),
            'analysis': {'method': 'spectral-flux / global tempo-phase fit / local onset snapping',
                         'candidates': candidates, 'gridFit': round(float(score), 3)},
            'notes': notes, 'energyStep': .25, 'energy': np.round(energies.clip(0, 1), 2).tolist()}
    tracks.append(item)
    print(json.dumps({k: item[k] for k in ['title', 'duration', 'bpm', 'beatOffset', 'analysis']}))
    print('notes:', len(notes), 'first:', notes[:6])
(ROOT / 'assets/music-charts.json').write_text(json.dumps({'version': 1, 'tracks': tracks}, ensure_ascii=False, separators=(',', ':')), encoding='utf8')
