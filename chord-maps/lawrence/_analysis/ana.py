import librosa, numpy as np, json
y, sr = librosa.load('audio.wav', sr=22050)
yh, yp = librosa.effects.hpss(y, margin=2.0)
tempo, beats = librosa.beat.beat_track(y=yp, sr=sr, start_bpm=130, units='frames', hop_length=512)
print('tempo', tempo, 'nbeats', len(beats))
oenv = librosa.onset.onset_strength(y=y, sr=sr)
print('tempogram top', librosa.feature.tempo(onset_envelope=oenv, sr=sr, aggregate=None)[:1], librosa.feature.tempo(onset_envelope=oenv, sr=sr))
C = np.abs(librosa.cqt(yh, sr=sr, hop_length=512, fmin=librosa.note_to_hz('C1'), n_bins=84, bins_per_octave=12))
bassC = C[12:36]  # C2..B3  (~65-247Hz)
low = C[:24]      # C1..B2
mid = C[24:60]    # C3..B5
def fold(M):
    out=np.zeros((12,M.shape[1]))
    for i in range(M.shape[0]): out[i%12]+=M[i]
    return out
chM = fold(mid); chB = fold(low)
# speech gate: spectral flatness / energy in 300-3k vs organ? use rms
rms = librosa.feature.rms(y=yh, hop_length=512)[0]
np.savez('feat.npz', chM=chM, chB=chB, beats=beats, rms=rms, tempo=tempo)
# global key Krumhansl
maj=np.array([6.35,2.23,3.48,2.33,4.38,4.09,2.52,5.19,2.39,3.66,2.29,2.88]);mn=np.array([6.33,2.68,3.52,5.38,2.60,3.53,2.54,4.75,3.98,2.69,3.34,3.17])
names=['C','Db','D','Eb','E','F','Gb','G','Ab','A','Bb','B']
def key(ch):
    v=ch.sum(1); res=[]
    for r in range(12):
        res.append((np.corrcoef(v,np.roll(maj,r))[0,1],names[r]+' maj'));res.append((np.corrcoef(v,np.roll(mn,r))[0,1],names[r]+' min'))
    return sorted(res,reverse=True)[:4]
t=librosa.frames_to_time(np.arange(chM.shape[1]),sr=sr,hop_length=512)
for a,b in [(0,139),(0,45),(45,90),(90,139)]:
    m=(t>=a)&(t<b); print(a,b,[(round(x,2),n) for x,n in key(chM[:,m]+chB[:,m])])
for a in range(0,139,10):
    m=(t>=a)&(t<a+10); v=(chM[:,m]).sum(1); v/=v.max(); bv=chB[:,m].sum(1); bv/=bv.max()
    print(a, 'mid', ' '.join(f'{names[i]}:{v[i]:.2f}' for i in np.argsort(-v)[:5]), '| bass', ' '.join(f'{names[i]}:{bv[i]:.2f}' for i in np.argsort(-bv)[:3]))
