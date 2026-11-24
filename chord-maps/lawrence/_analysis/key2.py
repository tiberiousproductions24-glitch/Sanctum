import librosa, numpy as np
y, sr = librosa.load('inst.wav', sr=22050)
yb, _ = librosa.load('sep/htdemucs/audio44/bass.wav', sr=22050)
ch = librosa.feature.chroma_cqt(y=y, sr=sr, hop_length=512, fmin=librosa.note_to_hz('C2'), n_octaves=5, bins_per_octave=36)
cb = librosa.feature.chroma_cqt(y=yb, sr=sr, hop_length=512, fmin=librosa.note_to_hz('C1'), n_octaves=3, bins_per_octave=36)
np.savez('inst-chroma.npz',ch=ch,cb=cb)
t=librosa.times_like(ch[0],sr=sr,hop_length=512)
names=['C','Db','D','Eb','E','F','Gb','G','Ab','A','Bb','B']
maj=np.array([6.35,2.23,3.48,2.33,4.38,4.09,2.52,5.19,2.39,3.66,2.29,2.88]);mn=np.array([6.33,2.68,3.52,5.38,2.60,3.53,2.54,4.75,3.98,2.69,3.34,3.17])
def key(v):
    res=[]
    for r in range(12):
        res.append((np.corrcoef(v,np.roll(maj,r))[0,1],names[r]));res.append((np.corrcoef(v,np.roll(mn,r))[0,1],names[r]+'m'))
    return sorted(res,reverse=True)[:3]
for a,b in [(0,90.5),(90.5,139),(0,139)]+[(x,x+10) for x in range(0,139,10)]:
  m=(t>=a)&(t<b); v=ch[:,m].mean(1); vb=cb[:,m].mean(1)
  print(f'{a:5.1f}-{b:5.1f}', ' '.join(f'{n}:{c:.2f}' for c,n in key(v+0.5*vb)), '| top pcs', ' '.join(names[i] for i in np.argsort(-v)[:5]), '| bass', ' '.join(names[i] for i in np.argsort(-vb)[:3]))
