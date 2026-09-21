"""Generate original 16-second test loops using only Python's standard library."""
import math, random, wave, array
from pathlib import Path
SR=22050
DURATION=16
ROOT=Path(__file__).resolve().parent
rng=random.Random(71)
def render(name,bpm,roots,bright=False,bass=False):
    samples=[0.0]*(SR*DURATION)
    def tone(start,duration,hz,amp,kind='soft'):
        n=int(duration*SR); offset=int(start*SR)
        phase=0
        for j in range(min(n,len(samples)-offset)):
            t=j/SR
            env=min(1,t/.015)*min(1,(duration-t)/.08)*math.exp(-t/(duration*.5))
            phase=2*math.pi*hz*t
            value=math.sin(phase)
            if kind=='bright': value+=.32*math.sin(phase*2)+.15*math.sin(phase*4)
            samples[offset+j]+=amp*env*value
    def drum(start,hat=False):
        duration=.075 if hat else .23
        for j in range(min(int(duration*SR),len(samples)-int(start*SR))):
            t=j/SR
            v=(rng.uniform(-1,1)*math.sin(2*math.pi*7000*t)*.12 if hat else math.sin(2*math.pi*(45*t+55*.035*(1-math.exp(-t/.035))))*.5)
            samples[int(start*SR)+j]+=v*math.exp(-t/(.016 if hat else .06))
    beat=60/bpm
    for step in range(int(DURATION/beat)):
        t=step*beat; root=roots[(step//4)%len(roots)]
        if not bright and not bass:
            if step%4==0:
                for ratio in [1,1.25,1.5]:tone(t,beat*3.9,root*ratio,.09)
            tone(t,beat*.85,root*[2,2.5,3,2.5][step%4],.045)
        elif bright:
            tone(t,beat*.7,root*[2,2.5,3,4,3,2.5,2,3][step%8],.13,'bright')
            if step%2==0:
                for ratio in [1,1.25,1.5]:tone(t,beat*1.8,root*ratio,.07,'bright')
            drum(t,True);drum(t+beat/2,True)
        else:
            tone(t,beat*.8,root,.24)
            drum(t)
            if step%2:drum(t+beat/2,True)
            if step%4==0:
                for ratio in [2,2.4,3]:tone(t,beat*3.5,root*ratio,.035)
    peak=max(abs(v) for v in samples) or 1
    gain=.82/peak
    out=array.array('h')
    for i,v in enumerate(samples):
        fade=min(1,i/(SR*.08),(len(samples)-1-i)/(SR*.6))
        out.append(round(max(-1,min(1,v*gain*fade))*32767))
    import sys
    if sys.byteorder!='little':out.byteswap()
    path=ROOT/name
    with wave.open(str(path),'wb') as w:
        w.setnchannels(1);w.setsampwidth(2);w.setframerate(SR);w.writeframes(out.tobytes())
    print(name, path.stat().st_size, 'bytes')
render('01-soft-evening.wav',80,[130.81,110,87.31,98])
render('02-citrus-spark.wav',120,[261.63,220,174.61,196],bright=True)
render('03-deep-groove.wav',110,[55,65.41,49,58.27],bass=True)
