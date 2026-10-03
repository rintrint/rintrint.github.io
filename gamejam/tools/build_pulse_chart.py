"""Edition 9: locally tracked percussion grid, never an unrelated fixed-BPM clock.

Run with numpy/scipy/soundfile installed (or BREATH_MEDIA_TOOLS pointing to them).
Keeps measured onset evidence separate from playable notes and reports residuals.
"""
import os,sys,json,hashlib
from pathlib import Path
sys.path.insert(0,os.environ.get('BREATH_MEDIA_TOOLS',r'C:\Users\user\.cache\breath-audio-tools'))
import numpy as np
import soundfile as sf
from scipy import signal,ndimage

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'assets/pulse'
source=OUT/'new-music.mp3'
raw,sr=sf.read(source,dtype='float32')
duration=len(raw)/sr
y=signal.resample_poly(raw.mean(axis=1),24000,sr);sr=24000
hop,nfft=48,768
frames=np.lib.stride_tricks.sliding_window_view(y,nfft)[::hop]
spec=np.abs(np.fft.rfft(frames*np.hanning(nfft),axis=1))
freq=np.fft.rfftfreq(nfft,1/sr)
times=(np.arange(len(frames))*hop+nfft/2)/sr
bands={}
for label,lo,hi in [('kick',35,190),('snare',190,2500),('hat',4500,10000)]:
    logmag=np.log1p(spec[:,(freq>=lo)&(freq<hi)]*5)
    flux=np.maximum(0,np.diff(logmag,axis=0,prepend=logmag[:1])).mean(axis=1)
    flux=np.maximum(0,flux-ndimage.median_filter(flux,size=101))
    flux=ndimage.gaussian_filter1d(flux,.7)
    bands[label]=flux/max(np.percentile(flux,99),1e-8)
env=.65*bands['snare']+.30*bands['hat']+.05*bands['kick']
ids,_=signal.find_peaks(env,prominence=.15,distance=35)
pt,pw=times[ids],env[ids].clip(0,2)
# Fit the opening groove only; the subsequent tempo is measured locally.
sel=(pt>6)&(pt<18)
bpms=np.arange(188,200,.005)
z=np.exp(2j*np.pi*np.outer(bpms/60,pt[sel]))@pw[sel]
initial=float(bpms[np.argmax(abs(z))]);period=60/initial
phase=float(np.angle(z[np.argmax(abs(z))])%(2*np.pi))/(2*np.pi)*period
pred=phase+np.ceil((6-phase)/period)*period
observed,confidence,predicted=[],[],[]
while pred<184:
    near=ids[abs(times[ids]-pred)<.045]
    best=max(near,key=lambda i:env[i],default=None)
    strength=float(env[best]) if best is not None else 0
    detected=float(times[best]) if best is not None else pred
    predicted.append(pred);observed.append(detected if strength>.16 else pred);confidence.append(strength)
    if len(observed)>=8:
        history=np.array(observed[-24:]);slope,intercept=np.polyfit(np.arange(len(history)),history,1)
        period=float(np.clip(slope,.298,.320));pred=float(intercept+slope*len(history))
    else:pred=detected+period
observed=np.array(observed)
# Smooth inter-onset jitter while preserving the measured gradual tempo change.
beats=signal.savgol_filter(observed,17,2)
assert len(beats)>=576

# Independent validation: high-band energy attacks, not exported chart timestamps.
high=signal.sosfiltfilt(signal.butter(3,[2500,9500],btype='bandpass',fs=sr,output='sos'),y)
rms=np.sqrt(np.maximum(0,ndimage.uniform_filter1d(high**2,size=192)))
rise=np.maximum(0,rms[::hop]-np.roll(rms[::hop],2))
hi,_=signal.find_peaks(rise,prominence=np.percentile(rise,85)*.5,distance=40)
high_times=hi*hop/sr
validation=[]
for i,t in enumerate(beats[:573]):
    near=high_times[abs(high_times-t)<.055]
    if len(near):validation.append(float(near[np.argmin(abs(near-t))]-t))
residual=(observed[:573]-beats[:573])*1000
assert np.percentile(abs(residual),95)<12

gates=[]
for cycle in range(9):
    b=cycle*64
    gates.append({'step':b*2,'kind':'leap' if cycle==4 else 'dive'})
    gates.append({'step':(b+44)*2,'kind':'exit' if cycle==8 else 'surface'})
gates.append({'step':560*2,'kind':'call'})
def at(step):
    i,half=divmod(step,2)
    return float(beats[i] if not half else (beats[i]+beats[i+1])/2)
def stage(step):return min(2,int(step//384))
base=[]
for cycle in range(9):
    start=cycle*64
    # Fixed quarter pulses, plus an audible pair of eighths at phrase endings.
    for b in range(start+2,start+43):
        base.append({'step':b*2,'kind':'fish'})
        if b%16 in [10,11]:
            t=at(b*2+1);near=ids[abs(times[ids]-t)<.025]
            if len(near) and max(env[near])>.20:base.append({'step':b*2+1,'kind':'fish'})
charts={}
for level,stride in [('beginner',8),('intermediate',4),('expert',1)]:
    notes=[dict(g) for g in gates]
    for section in range(3):
        fish=sorted([n for n in base if stage(n['step'])==section and n['step']%stride==0],key=lambda n:n['step'])
        assert 0<len(fish)<=146,(level,section,len(fish))
        for j,n in enumerate(fish):
            notes.append(dict(n,fish=146*(j+1)//len(fish)-146*j//len(fish)))
    for n in notes:
        n.update(time=round(at(n['step']),6),stage=stage(n['step']),fish=n.get('fish',0),depth=18+(n['step']//16%4)*5,accent=n['step']%8==0)
    charts[level]=sorted(notes,key=lambda n:n['time'])

note_validation={}
for level,notes in charts.items():
    flux_errors=np.array([min(abs(pt-n['time']))*1000 for n in notes])
    high_errors=np.array([min(abs(high_times-n['time']))*1000 for n in notes])
    note_validation[level]={
        'notes':len(notes),
        'spectralMedianMs':round(float(np.median(flux_errors)),3),
        'spectralP95Ms':round(float(np.percentile(flux_errors,95)),3),
        'spectralMaxMs':round(float(max(flux_errors)),3),
        'independentP95Ms':round(float(np.percentile(high_errors,95)),3),
        'independentMaxMs':round(float(max(high_errors)),3),
        'withoutHighBandAttackWithin55ms':int(sum(high_errors>55))
    }
    assert max(flux_errors)<25,(level,'A playable note lacks a nearby measured onset')

report={
    'method':'2ms multi-band spectral flux; local 24-pulse tempo tracking; 17-pulse quadratic smoothing',
    'sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest(),
    'initialBpm':round(60/float(np.median(np.diff(beats[:32]))),3),
    'finalBpm':round(60/float(np.median(np.diff(beats[512:544]))),3),
    'measuredOnsetResidualMedianMs':round(float(np.median(abs(residual))),3),
    'measuredOnsetResidualP95Ms':round(float(np.percentile(abs(residual),95)),3),
    'independentHighBandMatched':len(validation),
    'independentHighBandMedianMs':round(float(np.median(np.abs(validation)))*1000,3),
    'independentHighBandP95Ms':round(float(np.percentile(np.abs(validation),95))*1000,3),
    'chartCounts':{k:len(v) for k,v in charts.items()},
    'playableNoteValidation':note_validation,
    'difficultyRule':'Expert: each pulse + paired eighths near phrase ends; intermediate every 2 pulses; beginner every 4 pulses. Identical retained timestamps.',
    'limitations':'Acoustic residuals validate the detected groove, not a human professional playtest. Half/double-time notation is ambiguous. Device calibration remains user-specific.',
    'sections':[{'time':round(float(beats[i]),3),'bpm':round(60/float(np.median(np.diff(beats[i:i+32]))),3)} for i in range(0,544,64)]
}
energy=np.sqrt(np.mean(frames**2,axis=1));energy/=max(np.percentile(energy,95),1e-8)
track={'id':'new-tide','title':'新音樂','src':'assets/pulse/new-music.mp3','duration':round(duration,6),'bpm':round(60/float(np.median(np.diff(beats[:573]))),2),'beatOffset':round(float(beats[0]),6),'beats':[round(float(t),6) for t in beats[:573]],'stageBounds':[0,float(beats[192]),float(beats[384]),duration],'charts':charts,'energyStep':.25,'energy':np.round(np.interp(np.arange(0,duration,.25),times,energy).clip(0,1),3).tolist(),'attacks':[{'time':round(float(t),4),'strength':round(float(w),3)} for t,w in zip(pt,pw)],'analysis':report}
(OUT/'chart.json').write_text(json.dumps({'version':9,'tracks':[track]},ensure_ascii=False,separators=(',',':')),encoding='utf8')
(OUT/'timing-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf8')
# Evidence for the in-browser, seekable chart/audio alignment inspector.
(OUT/'evidence.json').write_text(json.dumps({'step':.008,'start':float(times[0]),'onset':np.round(env[::4].clip(0,2),3).tolist(),'independentAttacks':[round(float(t),4) for t in high_times],'beats':track['beats']},separators=(',',':')),encoding='utf8')
print(json.dumps(report,ensure_ascii=False,indent=2))
