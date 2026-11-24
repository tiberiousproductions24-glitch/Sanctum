import librosa, numpy as np, json, collections
d=np.load('inst-chroma.npz'); ch=d['ch']; cb=d['cb']
y, sr = librosa.load('inst.wav', sr=22050); hop=512
oenv=librosa.onset.onset_strength(y=y,sr=sr,hop_length=hop)
tempo,beats=librosa.beat.beat_track(onset_envelope=oenv,sr=sr,hop_length=hop,start_bpm=136)
tempo=float(np.atleast_1d(tempo)[0])
yr,_=librosa.load('audio.wav',sr=22050)
rms_full=librosa.feature.rms(y=yr,hop_length=hop)[0]
yv,_=librosa.load('sep/htdemucs/audio44/vocals.wav',sr=22050)
rv=librosa.feature.rms(y=yv,hop_length=hop)[0]; ri=librosa.feature.rms(y=y,hop_length=hop)[0]
n=min(len(rv),len(ri),ch.shape[1]); vocratio=rv[:n]/(ri[:n]+1e-6)
names=['C','Db','D','Eb','E','F','Gb','G','Ab','A','Bb','B']
sections=[(0,90.5,6,'A (Gb)'),(90.5,140,7,'B (G, up a half step)')]
def tonic_at(t):
  for a,b,k,nm in sections:
    if a<=t<b: return k,nm
Q={'':[0,4,7],'m':[0,3,7],'7':[0,4,7,10],'maj7':[0,4,7,11],'m7':[0,3,7,10],'9':[0,4,7,10,2],'m9':[0,3,7,10,2],'7#9':[0,4,7,10,3],'7b9':[0,4,7,10,1],'dim7':[0,3,6,9],'m7b5':[0,3,6,10],'sus4':[0,5,7],'7sus4':[0,5,7,10],'sus2':[0,2,7],'6':[0,4,7,9],'aug':[0,4,8]}
T=[];L=[]
for r in range(12):
  for q,pcs in Q.items():
    m=np.full(12,-0.3)
    for p in pcs: m[(r+p)%12]=1.0
    T.append(m/np.linalg.norm(m)); L.append((r,q))
T=np.array(T)
# half-beat? use beats
bounds=np.concatenate([[0],beats,[n]]); segs=[]
for i in range(len(bounds)-1):
  a,b=int(bounds[i]),int(min(bounds[i+1],n))
  if b-a<2: continue
  v=ch[:,a:b].mean(1); vb=cb[:,a:b].mean(1)
  x=v+0.6*vb; x=x-x.mean(); x/=np.linalg.norm(x)+1e-9
  sc=T@x
  energy=float(ri[a:b].mean())
  segs.append((a*hop/sr,b*hop/sr,sc,int(np.argmax(vb)),float(np.max(vb)-np.sort(vb)[-2]),float(np.median(vocratio[a:b])),energy))
S=np.array([s[2] for s in segs]); N=len(L)
trans=np.full((N,N),np.log(0.35/(N-1))); np.fill_diagonal(trans,np.log(0.65))
# key-aware prior: favor diatonic/blues roots
emit=S*10
dp=emit[0].copy(); bp=[]
for k in range(1,len(S)):
  m=dp[:,None]+trans; arg=m.argmax(0); dp=m.max(0)+emit[k]; bp.append(arg)
path=[int(dp.argmax())]
for arg in reversed(bp): path.append(int(arg[path[-1]]))
path=path[::-1]
ROM=['I','bII','II','bIII','III','IV','#IV','V','bVI','VI','bVII','VII']
def roman(r,q,k):
  deg=(r-k)%12; base=ROM[deg]
  if q.startswith('m') and not q.startswith('maj'): base=base.lower(); q=q[1:]
  if q=='dim7': base=base.lower(); q='°7'
  if q=='7b5' : q='ø7'
  return base+q
silent=(librosa.feature.rms(y=yr,hop_length=hop)[0]<1e-5)
emax=np.percentile([s[6] for s in segs],95)
beats_out=[]
for s,p in zip(segs,path):
  r,q=L[p]; k,sec=tonic_at(s[0]); srt=np.sort(s[2])
  score=float(s[2][p]); margin=float(srt[-1]-srt[-2])
  quiet=bool(silent[int(s[0]*sr/hop):int(s[1]*sr/hop)+1].mean()>0.3)
  conf=float(np.clip((score-0.25)/0.5,0,1)*(0.5 if quiet else 1.0)*(0.7 if s[5]>1.5 else 1.0))
  beats_out.append(dict(t=round(s[0],2),end=round(s[1],2),chord=names[r]+q,roman=roman(r,q,k),bass=names[s[3]],bassDeg=ROM[(s[3]-k)%12],section=sec,tonic=names[k],score=round(score,3),conf=round(conf,2),vocalDominant=bool(s[5]>1.5),dropout=bool(quiet)))
# merge
segsm=[]
for b in beats_out:
  if segsm and segsm[-1]['chord']==b['chord'] and segsm[-1]['section']==b['section']:
    m=segsm[-1]; m['end']=b['end']; m['beats']+=1; m['_c'].append(b['conf']); m['_b'].append(b['bass']); m['_d'].append(b['dropout'])
  else: segsm.append(dict(t=b['t'],end=b['end'],chord=b['chord'],roman=b['roman'],section=b['section'],tonic=b['tonic'],beats=1,_c=[b['conf']],_b=[b['bass']],_d=[b['dropout']]))
for m in segsm:
  m['confidence']=round(float(np.mean(m.pop('_c'))),2); bs=m.pop('_b'); m['bassMotion']=' '.join(bs); m['bassMain']=collections.Counter(bs).most_common(1)[0][0]
  dd=m.pop('_d'); m['dropout']=bool(np.mean(dd)>0.5)
  m['flag']='dropout' if m['dropout'] else 'low' if m['confidence']<0.35 or m['beats']<2 else ('med' if m['confidence']<0.6 else 'high')
json.dump(dict(tempo=tempo,beats=beats_out,segments=segsm),open('timeline-librosa.json','w'),indent=1)
print('tempo',tempo,'beats',len(beats_out))
for m in segsm: print(f"{m['t']:6.1f}-{m['end']:6.1f} {m['section'][:6]:6s} {m['chord']:8s} {m['roman']:9s} b={m['beats']:2d} c={m['confidence']:.2f} {m['flag']:4s} {'DROP' if m['dropout'] else ''} bass:{m['bassMotion']}")
# roman histogram per section (weighted by beats, conf)
for sec in ['A (Gb)','B (G, up a half step)']:
  c=collections.Counter()
  for b in beats_out:
    if b['section']==sec and not b['dropout']: c[b['roman']]+=b['conf']
  print(sec, [(k,round(v,1)) for k,v in c.most_common(10)])
big=collections.Counter()
for a,b in zip(segsm,segsm[1:]):
  if a['section']==b['section'] and a['flag']!='low' and b['flag']!='low': big[(a['roman'],b['roman'])]+=1
print('bigrams',big.most_common(15))
