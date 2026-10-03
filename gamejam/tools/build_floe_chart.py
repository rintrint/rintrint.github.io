"""Edition 12: build a separate, locally tracked chart for a supplied song.

Uses measured multiband attacks and retains identical timestamps across levels.
Run with BREATH_MEDIA_TOOLS or the existing local audio-analysis dependencies.
"""
import os,sys,json,hashlib,argparse
from pathlib import Path
sys.path.insert(0,os.environ.get('BREATH_MEDIA_TOOLS',str(Path.home()/'.cache/breath-audio-tools')))
import numpy as np
import soundfile as sf
from scipy import signal,ndimage

parser=argparse.ArgumentParser();parser.add_argument('--song',type=int,choices=[2,3],default=2)
song=parser.parse_args().song
config={2:dict(id='floe-second',low=135,high=145,track_high=144,span=48,surface=34),3:dict(id='floe-third',low=128,high=136,track_high=136,span=40,surface=28)}[song]
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'assets/floe';source=OUT/f'new-music-{song}.mp3'
raw,sr=sf.read(source,dtype='float32');duration=len(raw)/sr
y=signal.resample_poly(raw.mean(axis=1),24000,sr);sr=24000;hop=48;nfft=768
frames=np.lib.stride_tricks.sliding_window_view(y,nfft)[::hop]
spec=np.abs(np.fft.rfft(frames*np.hanning(nfft),axis=1));freq=np.fft.rfftfreq(nfft,1/sr)
times=(np.arange(len(frames))*hop+nfft/2)/sr;bands=[]
for lo,hi in [(35,190),(190,2500),(4500,10000)]:
    mag=np.log1p(spec[:,(freq>=lo)&(freq<hi)]*5)
    flux=np.maximum(0,np.diff(mag,axis=0,prepend=mag[:1])).mean(axis=1)
    flux=np.maximum(0,flux-ndimage.median_filter(flux,size=101))
    flux=ndimage.gaussian_filter1d(flux,.7)
    bands.append(flux/max(np.percentile(flux,99),1e-8))
env=.25*bands[0]+.55*bands[1]+.2*bands[2]
ids,_=signal.find_peaks(env,prominence=.12,distance=35);pt,pw=times[ids],env[ids].clip(0,2)
bpms=np.arange(config['low'],config['high'],.005);sel=(pt>6)&(pt<26)
z=np.exp(2j*np.pi*np.outer(bpms/60,pt[sel]))@pw[sel];best=np.argmax(abs(z))
period=60/bpms[best];phase=(np.angle(z[best])%(2*np.pi))/(2*np.pi)*period
pred=phase+np.ceil((6-phase)/period)*period
observed=[];conf=[]
while pred<duration-3:
    near=np.where(abs(pt-pred)<.065)[0]
    j=max(near,key=lambda k:pw[k]*np.exp(-((pt[k]-pred)/.045)**2),default=None)
    strength=float(pw[j]) if j is not None else 0
    detected=float(pt[j]) if strength>.16 else pred
    observed.append(detected);conf.append(strength)
    if len(observed)>=8:
        hist=np.array(observed[-24:]);slope,intercept=np.polyfit(np.arange(len(hist)),hist,1)
        period=float(np.clip(slope,60/config['track_high'],60/config['low']));pred=float(intercept+slope*(len(hist)-1)+period)
    else:pred=detected+period
beats=signal.savgol_filter(observed,17,2)
def attack(t,tolerance=.045):
    near=np.where(abs(pt-t)<=tolerance)[0]
    if not len(near):return None
    j=max(near,key=lambda k:pw[k]*np.exp(-((pt[k]-t)/.027)**2))
    return float(pt[j]) if pw[j]>.18 else None
def at(step):
    i,half=divmod(step,2)
    return float((beats[i]+beats[i+1])/2 if half else beats[i])
def note(step,kind):
    t=attack(at(step))
    return dict(step=step,kind=kind,time=round(t,6)) if t is not None else None
def gate(index,kind):
    choices=[note(i*2,kind) for i in range(max(0,index-2),min(len(beats)-1,index+3))]
    return min((n for n in choices if n),key=lambda n:abs(n['step']/2-index))
# Nine breaths, with song-specific phrase lengths and enough surface recovery.
# A complete stage always contains exactly 146 obtainable fish in every level.
gates=[];base=[];cycles=9;span=config['span']
for cycle in range(cycles):
    b=cycle*span
    if cycle:gates.append(gate(b,'leap' if cycle==4 else 'dive'))
    surface=gate(b+config['surface'],'exit' if cycle==cycles-1 else 'surface');gates.append(surface)
    for i in range(b+3,int(surface['step']/2)-1):
        n=note(i*2,'fish')
        if n:base.append(dict(n,stage=cycle//3))
        if i%16 in [10,11]:
            n=note(i*2+1,'fish')
            if n and abs(n['time']-at(i*2+1))<.022:base.append(dict(n,stage=cycle//3))
call=gate((cycles-1)*span+span-4,'call');gates.append(call)
for n in gates:n['stage']=min(2,int(n['step']//(span*3*2)))
charts={}
for level,stride in [('beginner',8),('intermediate',4),('expert',1)]:
    notes=[dict(n,fish=0) for n in gates]
    for stage in range(3):
        fish=sorted([n for n in base if n['stage']==stage and n['step']%stride==0],key=lambda n:n['time'])
        assert 0<len(fish)<=146,(level,stage,len(fish))
        for i,n in enumerate(fish):notes.append(dict(n,fish=146*(i+1)//len(fish)-146*i//len(fish)))
    for n in notes:n.update(depth=18+(n['step']//16%4)*5,accent=n['step']%8==0)
    charts[level]=sorted(notes,key=lambda n:n['time'])
high=signal.sosfiltfilt(signal.butter(3,[2500,9500],btype='bandpass',fs=sr,output='sos'),y)
rms=np.sqrt(np.maximum(0,ndimage.uniform_filter1d(high**2,size=192)))
rise=np.maximum(0,rms[::hop]-np.roll(rms[::hop],2))
hi,_=signal.find_peaks(rise,prominence=np.percentile(rise,85)*.5,distance=35);ht=hi*hop/sr
report={'method':'2 ms multiband spectral flux; weighted local percussion tracking; only audible attacks become playable notes',
 'sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest(),
 'initialBpm':round(60/float(np.median(np.diff(beats[:32]))),2),
 'finalBpm':round(60/float(np.median(np.diff(beats[-32:]))),2),
 'duration':duration,'chartCounts':{k:len(v) for k,v in charts.items()},
 'difficultyRule':'Beginner retains every 4th pulse; intermediate every 2nd pulse; expert includes supported pulse and eighth-note attacks. All retained timestamps are identical.',
 'limitations':'Automated acoustic verification is not a professional human playtest; device calibration still applies.',
 'playableNoteValidation':{}}
for level,notes in charts.items():
    errors=[min(abs(ht-n['time']))*1000 for n in notes]
    report['playableNoteValidation'][level]={'notes':len(notes),'independentMedianMs':round(float(np.median(errors)),2),'independentP95Ms':round(float(np.percentile(errors,95)),2),'independentMaxMs':round(float(max(errors)),2),'withoutHighBandAttackWithin55ms':int(sum(e>55 for e in errors))}
energy=np.sqrt(np.mean(frames**2,axis=1));energy/=max(np.percentile(energy,95),1e-8)
track={'id':config['id'],'title':f'新音樂 {song}','src':f'assets/floe/new-music-{song}.mp3','duration':duration,'bpm':round(60/float(np.median(np.diff(beats))),2),
 'introEnd':float(beats[0]),'beatOffset':float(beats[0]),'beats':np.round(beats,6).tolist(),
 'stageBounds':[0,float(beats[span*3]),float(beats[span*6]),duration],'charts':charts,'energyStep':.25,
 'energy':np.round(np.interp(np.arange(0,duration,.25),times,energy).clip(0,1),3).tolist(),
 'attacks':[{'time':round(float(t),4),'strength':round(float(w),3)} for t,w in zip(pt,pw)],'analysis':report}
old=json.loads((ROOT/'assets/drift/chart.json').read_text(encoding='utf8'))['tracks'][0]
existing=json.loads((OUT/'chart.json').read_text(encoding='utf8'))['tracks'] if (OUT/'chart.json').exists() else [old]
by_id={t['id']:t for t in existing};by_id[track['id']]=track
ordered=[by_id[key] for key in ['floe-second','floe-third','drift-tide'] if key in by_id]
(OUT/'chart.json').write_text(json.dumps({'version':12,'tracks':ordered},ensure_ascii=False,separators=(',',':'))+'\n',encoding='utf8')
(OUT/('timing-report.json' if song==2 else 'timing-report-3.json')).write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
print(json.dumps(report,ensure_ascii=False,indent=2))
