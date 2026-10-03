"""Build the seventh edition from reviewed VIDEO events, never audio peak guesses.

The timing ledger records the first readable combo frame in the supplied 30 fps
recording. Lane ranges and special events were reviewed on contact sheets.
This reconstructs a performance; it is not an export of the original game chart.
Run: python tools/build_video_chart.py
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
source = json.loads((ROOT / 'assets/dash/video-timing.json').read_text())
# Inclusive air-lane ranges; remaining ordinary notes are on the ground.
AIR = '''5-8 13-16 21-24 29-34 39-44 49-54
63-65 70-74 78-81 85-87 93-94 100-102 106-110 116-118
123-126 130 133-134 139-141 147-150 156-159 166-168 170-173 175 180
183-184 187-188 191 195-197 201-206 211-212 214-215 223-224 231-234 237
241-243 245 249 252 255-257 261-262 265-266 273-274 276 278 281-282 284 286
293 295 298 300-301 303 306 310-312 315-316 319-320 325 329-331 335-340 345-346 349-350 357-358
365-368 371 375-377 379 383 386 389-391 394-395 398-399 409-412 415-416 418 420
422-424 426-427 431 434 436-437 440 443-444 447-448 458-461 466-469 474-477
483-489 495-502 507-513'''
air = set()
for token in AIR.split():
    bounds = list(map(int, token.split('-')))
    air.update(range(bounds[0], bounds[-1] + 1))
# Heads/tails each contribute one combo; opposite-lane taps remain independent.
holds = [(169,174),(175,180),(240,244),(245,249),(250,251),
         (287,288),(299,302),(303,306),(374,378),(379,383),
         (384,385),(421,425),(427,431),(433,435),(437,440)]
events = []
for row in source:
    n = row['combo']
    events.append(dict(id=n, time=round(row['frame']/30-1/30, 4),
                       lane='air' if n in air else 'ground', kind='tap',
                       sourceFrame=row['frame'], evidence=row['evidence']))
by_id = {e['id']:e for e in events}
for head,tail in holds:
    a,b=by_id[head],by_id[tail]
    a.update(kind='hold', end=b['time'], tailId=tail)
    b.update(kind='tail', headId=head, lane=a['lane'])
for n,start,minimum in [(55,19.1,12),(514,133.5,16)]:
    e=by_id[n]
    e.update(kind='mash',start=start,required=minimum,lane='both')
chart = dict(title='草蛇驚一', artist='影片音源 · MUSE DASH 遊玩錄影',
    sourceUrl='https://www.bilibili.com/video/BV1yvaz6eEKS/',
    sourceTitle='【MUSE DASH】草蛇惊一 大触 Lv.9 FC', sourceFps=30,
    sourceCombo=514, duration=139.85, audio='assets/audio/caoshe-jingyi-video.mp3',
    timingMethod='Readable combo frames minus one display frame; manual lane/type review. Recorded judgements are not original chart timestamps.',
    events=events,
    # Eight saw crossings, checked against the sprite near x=150–170 in source frames.
    hazards=[dict(time=t,lane='ground') for t in [75.9333,76.8667,77.8333,78.7667,79.7,80.6333,81.5667,82.5]],
    pickups=[dict(time=t,lane=l) for t,l in [(11.55,'air'),(12.02,'ground'),(12.49,'air'),(12.96,'ground'),(76.2,'air'),(76.9,'ground'),(77.13,'ground'),(78.08,'air'),(126.2,'air'),(126.66,'ground'),(127.13,'air'),(127.6,'ground')]])
assert len(events)==514 and all(a['time']<=b['time'] for a,b in zip(events,events[1:]))
(ROOT/'assets/dash/chart.json').write_text(json.dumps(chart,ensure_ascii=False,indent=2),encoding='utf-8')
print('514 judgements,',len(holds),'holds, 2 mash sections,',len(chart['hazards']),'hazards')
