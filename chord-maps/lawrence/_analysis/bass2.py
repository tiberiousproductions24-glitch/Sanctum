import librosa, numpy as np
y, sr = librosa.load('sep/htdemucs/audio44/bass.wav', sr=22050)
yh = librosa.effects.harmonic(y, margin=3.0)
f0,vf,vp=librosa.pyin(yh,fmin=35,fmax=200,sr=sr,hop_length=512,frame_length=4096)
t=librosa.times_like(f0,sr=sr,hop_length=512)
names=['C','Db','D','Eb','E','F','Gb','G','Ab','A','Bb','B']
midi=librosa.hz_to_midi(f0)
np.save('bassf0-stem.npy',np.vstack([t,midi,vp]))
# per 0.5s
line=[]
for a in np.arange(0,139,0.5):
  m=(t>=a)&(t<a+0.5)&vf
  if m.sum()<3: line.append('.'); continue
  n=int(np.round(np.median(midi[m]))); line.append(names[n%12]+str(n//12-1))
for i in range(0,len(line),20): print(f'{i*0.5:6.1f}',' '.join(f'{x:4s}' for x in line[i:i+20]))
