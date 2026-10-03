"""Prepare edition 11 assets without changing earlier editions or source artwork."""
import sys, json, hashlib, shutil
from pathlib import Path
sys.path.insert(0, str(Path.home()/'.cache/breath-audio-tools'))
import numpy as np
import soundfile as sf
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT/'assets/drift'
OUT.mkdir(exist_ok=True)
sources = {'swim':'遊泳素材圖.webp', 'fisher':'釣魚.webp', 'friend':'吃棒棒糖.webp', 'splash':'水花.webp', 'angel':'變天使.webp'}
manifest = {}
for key, name in sources.items():
    source = Path.home()/'Desktop'/name
    target = OUT/(key+'.webp')
    shutil.copyfile(source, target)
    with Image.open(source) as im:
        left, top, right, bottom = im.getbbox()
        manifest[key] = {'src':'assets/drift/'+target.name, 'rect':[left,top,right-left,bottom-top], 'source':name, 'sha256':hashlib.sha256(source.read_bytes()).hexdigest()}
(OUT/'art.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')

source = ROOT/'assets/pulse/new-music.mp3'
pcm, sr = sf.read(source, dtype='float32')
# The natural decay reaches silence at 190.25 s. A second intro starts at
# approximately 190.75 s. Cut within that silent gap; keep all original notes.
cut = 190.5
end = round(cut*sr)
assert np.max(np.abs(pcm[int(190.3*sr):end])) < .0001
assert np.sqrt(np.mean(pcm[int(191*sr):int(193*sr)]**2)) > .001
sf.write(OUT/'new-music-trimmed.mp3', pcm[:end], sr, format='MP3', subtype='MPEG_LAYER_III', bitrate_mode='CONSTANT', compression_level=.1)
decoded, rate = sf.read(OUT/'new-music-trimmed.mp3', dtype='float32')
assert rate == sr and len(decoded) == end
# Check sample alignment after MP3 encoding; no new timing offset is introduced.
from scipy.signal import correlate, correlation_lags
a = pcm[int(12*sr):int(13*sr)].mean(axis=1)
b = decoded[int(12*sr):int(13*sr)].mean(axis=1)
c = correlate(b,a,method='fft')
lag = int(correlation_lags(len(b),len(a))[np.argmax(c)])
assert lag == 0
report = {'originalDuration':len(pcm)/sr, 'trimmedDuration':len(decoded)/sr, 'removedSeconds':(len(pcm)-end)/sr, 'cutReason':'Silent gap after the natural decay and before the repeated intro near 190.75 s.', 'sampleRate':sr, 'decodedAlignmentSamples':lag, 'originalSha256':hashlib.sha256(source.read_bytes()).hexdigest(), 'trimmedSha256':hashlib.sha256((OUT/'new-music-trimmed.mp3').read_bytes()).hexdigest()}
(OUT/'audio-edit.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
chart = json.loads((ROOT/'assets/pulse/chart.json').read_text(encoding='utf-8'))
track = chart['tracks'][0]
track.update(id='drift-tide', src='assets/drift/new-music-trimmed.mp3', duration=cut)
track['stageBounds'][-1] = cut
track['energy'] = track['energy'][:int(cut/track['energyStep'])]
for notes in track['charts'].values():
    assert notes[0]['kind'] == 'dive'
    track['introEnd'] = notes[0]['time']
    del notes[0]
    assert max(n['time'] for n in notes) < cut
(OUT/'chart.json').write_text(json.dumps(chart,ensure_ascii=False,separators=(',',':'))+'\n',encoding='utf-8')
print(json.dumps(report))
