import librosa, numpy as np, json
y, sr = librosa.load('audio.wav', sr=22050)
yh = librosa.effects.harmonic(y, margin=3.0)
hop=512
ch = librosa.feature.chroma_cqt(y=yh, sr=sr, hop_length=hop, fmin=librosa.note_to_hz('C3'), n_octaves=3, bins_per_octave=36, norm=None)
chb = librosa.feature.chroma_cqt(y=yh, sr=sr, hop_length=hop, fmin=librosa.note_to_hz('C1'), n_octaves=2, bins_per_octave=36, norm=None)
# speech gate: spectral flatness + zcr in original; organ is sustained so low flux in harmonic
S=np.abs(librosa.stft(y,hop_length=hop))
freqs=librosa.fft_frequencies(sr=sr)
sp=S[(freqs>1000)&(freqs<4000)].sum(0); org=S[(freqs>60)&(freqs<1000)].sum(0)
ratio=sp/(org+1e-9)
names=['C','Db','D','Eb','E','F','Gb','G','Ab','A','Bb','B']
Q={'':[0,4,7],'m':[0,3,7],'7':[0,4,7,10],'maj7':[0,4,7,11],'m7':[0,3,7,10],'9':[0,4,7,10,2],'maj9':[0,4,7,11,2],'m9':[0,3,7,10,2],'m11':[0,3,7,10,5],'7#9':[0,4,7,10,3],'7b9':[0,4,7,10,1],'dim7':[0,3,6,9],'m7b5':[0,3,6,10],'sus4':[0,5,7],'7sus4':[0,5,7,10],'sus2':[0,2,7],'6':[0,4,7,9],'m6':[0,3,7,9],'aug':[0,4,8],'13':[0,4,10,9,2]}
T=[];L=[]
for r in range(12):
  for q,pcs in Q.items():
    m=np.full(12,-0.35);
    for p in pcs: m[(r+p)%12]=1.0
    m[r]+=0.3
    T.append(m/np.linalg.norm(m)); L.append((r,q))
T=np.array(T)
tempo,beats=librosa.beat.beat_track(y=y,sr=sr,hop_length=hop,start_bpm=118)
# segment per beat
bt=librosa.frames_to_time(beats,sr=sr,hop_length=hop)
segs=[]
bounds=np.concatenate([[0],beats,[ch.shape[1]]])
for i in range(len(bounds)-1):
  a,b=bounds[i],bounds[i+1]
  if b-a<2: continue
  w=1.0/(1+ratio[a:b])  # down-weight speech frames
  c=(np.log1p(20*ch[:,a:b])*w).sum(1); cb=(np.log1p(20*chb[:,a:b])*w).sum(1)
  v=c/ (np.linalg.norm(c)+1e-9); vb=cb/(np.linalg.norm(cb)+1e-9)
  v2=v+0.5*vb; v2=v2-v2.mean(); v2/=np.linalg.norm(v2)+1e-9
  sc=T@v2
  segs.append(dict(t0=float(a*hop/sr),t1=float(b*hop/sr),sc=sc,bass=int(np.argmax(vb)),bconf=float(np.sort(vb)[-1]-np.sort(vb)[-2]),speech=float(np.median(ratio[a:b]))))
S=np.array([s['sc'] for s in segs])
# viterbi
n=len(L); stay=np.log(0.6); move=np.log(0.4/(n-1))
trans=np.full((n,n),move); np.fill_diagonal(trans,stay)
emit=S*8
dp=emit[0].copy(); bp=[]
for k in range(1,len(S)):
  m=dp[:,None]+trans; arg=m.argmax(0); dp=m.max(0)+emit[k]; bp.append(arg)
path=[int(dp.argmax())]
for arg in reversed(bp): path.append(int(arg[path[-1]]))
path=path[::-1]
out=[]
for s,p in zip(segs,path):
  r,q=L[p]; srt=np.sort(s['sc'])
  conf=float(np.clip((s['sc'][p]-0.2)/0.6,0,1))
  lab=names[r]+q; bn=names[s['bass']]
  if s['bass']!=r: lab_s=lab+'/'+bn
  else: lab_s=lab
  out.append(dict(t=round(s['t0'],2),end=round(s['t1'],2),chord=lab,root=names[r],quality=q,bass=bn,slash=lab_s,score=round(float(s['sc'][p]),3),margin=round(float(srt[-1]-srt[-2]),3),speech=round(s['speech'],2)))
json.dump(dict(tempo=float(np.atleast_1d(tempo)[0]),beats=out),open('beats-librosa.json','w'),indent=0)
print('tempo',tempo)
# merge
cur=None
for o in out:
  if cur and cur['chord']==o['chord']: cur['end']=o['end']; cur['n']+=1; cur['basses'].append(o['bass']); cur['sc'].append(o['score'])
  else:
    if cur: print(f"{cur['t']:6.1f}-{cur['end']:6.1f} {cur['chord']:8s} n={cur['n']:2d} sc={np.mean(cur['sc']):.2f} bass={','.join(cur['basses'])}")
    cur=dict(t=o['t'],end=o['end'],chord=o['chord'],n=1,basses=[o['bass']],sc=[o['score']])
print(f"{cur['t']:6.1f}-{cur['end']:6.1f} {cur['chord']}")
