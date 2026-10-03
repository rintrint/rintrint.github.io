"""Reproducible onset-led charts, separate from editions 3–5.
Use BREATH_MEDIA_TOOLS for optional numpy/scipy/soundfile installation.
Frame-centred spectral flux + low-band flux + RMS rise; no guessed global offset.
"""
import os, sys, json
from pathlib import Path
if os.environ.get('BREATH_MEDIA_TOOLS'): sys.path.insert(0, os.environ['BREATH_MEDIA_TOOLS'])
import numpy as np
import soundfile as sf
from scipy import signal, ndimage
root = Path(__file__).resolve().parents[1]
source = json.loads((root/'assets/music-charts.json').read_text(encoding='utf8'))
tracks=[]
for original in source['tracks']:
    raw,sr=sf.read(root/original['src'], dtype='float32')
    y=signal.resample_poly(raw.mean(axis=1),1,3); rate=sr/3; hop=80; size=512
    frames=np.lib.stride_tricks.sliding_window_view(y,size)[::hop]
    mag=np.abs(np.fft.rfft(frames*np.hanning(size),axis=1)); freq=np.fft.rfftfreq(size,1/rate)
    def flux(lo,hi):
        a=np.log1p(mag[:,(freq>=lo)&(freq<hi)]*8)
        f=np.maximum(0,np.diff(a,axis=0,prepend=a[:1])).mean(axis=1)
        f=np.maximum(0,f-ndimage.median_filter(f,size=101))
        return f/max(np.percentile(f,98),1e-8)
    rms=np.sqrt((frames**2).mean(axis=1))
    rise=np.maximum(0,np.diff(rms,prepend=rms[:1]));rise/=max(np.percentile(rise,98),1e-8)
    env=ndimage.gaussian_filter1d(.6*flux(80,6500)+.3*flux(40,300)+.1*rise,.65)
    times=(np.arange(len(env))*hop+size/2)/rate
    peaks,_=signal.find_peaks(env,distance=int(.14*rate/hop),prominence=.035)
    attacks=[{'time':round(float(times[i]),3),'strength':round(float(env[i]),3)} for i in peaks]
    duration=original['duration']; end=duration-6
    # Gates follow salient attacks near phrase locations, with a 3 s shore breath.
    def near(t): return max((p for p in attacks if abs(p['time']-t)<.65),key=lambda p:p['strength'],default={'time':t})['time']
    gates=[{'time':near(3),'kind':'dive'}]
    for t in np.arange(21,end-8,18):
        at=near(float(t)); gates.append({'time':at,'kind':'surface'})
        gates.append({'time':near(at+3.2),'kind':'leap' if 100<t<120 else 'dive'})
    gates += [{'time':near(end),'kind':'exit'},{'time':near(end+3),'kind':'call'}]
    gates.sort(key=lambda n:n['time'])
    # Only one mandatory leap, present in both supplied songs.
    assert sum(n['kind']=='leap' for n in gates)==1
    def underwater(t):
        last=max((g for g in gates if g['time']<t),key=lambda g:g['time'],default={'kind':'surface'})
        return last['kind'] in ['dive','leap'] and all(abs(t-g['time'])>.85 for g in gates)
    eligible=[p for p in attacks if 5<p['time']<end-1 and underwater(p['time'])]
    charts={}
    boundaries=[5,5+(end-6)/3,5+2*(end-6)/3,end-1]
    for level,count,spacing in [('beginner',73,.39),('intermediate',100,.20),('expert',146,.14)]:
        notes=[dict(g,fish=0,stage=min(2,int(g['time']/duration*3))) for g in gates]
        for stage,(a,b) in enumerate(zip(boundaries,boundaries[1:])):
            pool=[p for p in eligible if a<=p['time']<b]; chosen=[]
            # Spread the limited note budget across the phrase before filling by
            # strength; otherwise a louder chorus steals every quiet intro note.
            for bucket in np.array_split(np.arange(len(pool)),count):
                ranked=sorted((pool[int(j)] for j in bucket),key=lambda p:-p['strength'])
                candidate=next((p for p in ranked if all(abs(p['time']-q['time'])>=spacing for q in chosen)),None)
                if candidate:chosen.append(candidate)
            # Fill any spacing conflicts from remaining actual attacks.
            for p in sorted(pool,key=lambda p:-p['strength']):
                if len(chosen)==count:break
                if all(abs(p['time']-q['time'])>=spacing for q in chosen):chosen.append(p)
            if len(chosen)<count: raise ValueError((original['id'],level,stage,len(chosen)))
            chosen.sort(key=lambda p:p['time'])
            for i,p in enumerate(chosen):
                fish=(146*(i+1)//count)-(146*i//count)
                notes.append(dict(p,kind='fish',fish=fish,stage=stage,depth=12+(i%5)*6,accent=p['strength']>1))
        notes.sort(key=lambda p:p['time']);charts[level]=notes
    old=[n['time'] for n in original['charts']['intermediate']]
    errors=[min(abs(t-p['time']) for p in attacks) for t in old]
    track={k:original[k] for k in ['id','title','src','duration','bpm','beatOffset','energy','energyStep']}
    track.update(charts=charts,attacks=attacks,stageBounds=boundaries,analysis={'method':'5 ms multiband positive spectral flux + RMS rise; actual local peaks, strength-ranked spacing', 'oldNearestAttackMedianMs':round(float(np.median(errors)*1000),1),'oldNearestAttackP90Ms':round(float(np.percentile(errors,90)*1000),1),'newNearestAttackMs':0,'note':'Peak proximity measures acoustic alignment, not musical salience or device latency.'})
    tracks.append(track)
    print(track['title'],track['analysis'],{k:len(v) for k,v in charts.items()})
(root/'assets/journey-charts.json').write_text(json.dumps({'version':1,'tracks':tracks},ensure_ascii=False,separators=(',',':')),encoding='utf8')

