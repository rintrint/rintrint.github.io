"""Build three distinct arrangements per song; never alters MP3 playback rate.
Requires numpy/scipy/soundfile. Run after analyze_tracks.py when replacing music.
"""
import os, sys, json
from pathlib import Path
if os.environ.get('BREATH_MEDIA_TOOLS'):
    sys.path.insert(0, os.environ['BREATH_MEDIA_TOOLS'])
import numpy as np
import soundfile as sf
from scipy import signal, ndimage

root = Path(__file__).resolve().parents[1]
path = root / 'assets/music-charts.json'
data = json.loads(path.read_text(encoding='utf8'))
for track in data['tracks']:
    raw, sr = sf.read(root / track['src'], dtype='float32')
    y = signal.resample_poly(raw.mean(axis=1), 1, 3)
    rate, hop, size = sr / 3, 160, 1024
    frames = np.lib.stride_tricks.sliding_window_view(y, size)[::hop]
    spectrum = np.abs(np.fft.rfft(frames * np.hanning(size), axis=1))
    freq = np.fft.rfftfreq(size, 1 / rate)
    logmag = np.log1p(spectrum[:, (freq > 60) & (freq < 5500)] * 8)
    flux = np.maximum(0, np.diff(logmag, axis=0, prepend=logmag[:1])).mean(axis=1)
    flux = ndimage.gaussian_filter1d(np.maximum(0, flux-ndimage.median_filter(flux,size=101)), .8)
    times = (np.arange(len(flux))*hop+size/2)/rate
    pulse = 60 / (track['bpm']/2 if track['bpm'] > 110 else track['bpm'])
    track['pulseBpm'] = round(60/pulse, 3)
    track['charts'] = {}
    for level in ['beginner','intermediate','expert']:
        notes=[]
        # One phrase = 16 pulses. Sparse downbeats, then singles/offbeats,
        # then eighth-note runs and short sixteenth-note bursts, with phrase rests.
        for step in range(int(track['duration']/pulse)*4):
            beat, sub = divmod(step,4)
            bar = beat % 16
            phrase = beat // 16
            if level=='beginner': keep = sub==0 and beat%2==0 and bar!=14
            elif level=='intermediate': keep = (sub==0 and bar!=15) or (sub==2 and phrase%3==1 and bar in [3,7,11])
            else: keep = (sub in [0,2] and bar!=15) or (sub in [1,3] and phrase%2==1 and bar in [6,7,14])
            nominal=track['beatOffset']+step*pulse/4
            if not keep or nominal<5 or nominal>track['duration']-4: continue
            window=np.flatnonzero(abs(times-nominal)<.035)
            j=window[np.argmax(flux[window])]
            attack=float(times[j]) if flux[j]>.01 else nominal
            notes.append({'time':round(attack,3),'accent':bool(sub==0 and beat%4==0),'phrase':phrase,'subdivision':sub})
        track['charts'][level]=notes
    # The legacy field remains the intermediate chart for older consumers.
    track['notes']=track['charts']['intermediate']
    print(track['title'], {k:len(v) for k,v in track['charts'].items()})
data['version']=2
data['arrangement']='Three phrase-based grids snapped to local audio attacks; original audio speed.'
path.write_text(json.dumps(data,ensure_ascii=False,separators=(',',':')),encoding='utf8')
