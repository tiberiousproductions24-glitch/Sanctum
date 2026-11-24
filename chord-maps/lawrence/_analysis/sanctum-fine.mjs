import fs from 'node:fs';
import { analyseChords } from '/workspace/projects/sanctum/src/chords/detect.ts';
const buf = fs.readFileSync('/workspace/lawrence-work/audio.raw');
const s = new Float32Array(buf.buffer, buf.byteOffset, buf.length/4);
const out={};
for (const stay of [0.75,0.4]) { const c = analyseChords(s,{sampleRate:22050,fftSize:4096,hop:2048,stay}); out[stay]=c; console.log(stay,c.chords.length,c.bpm,JSON.stringify(c.key)); }
fs.writeFileSync('/workspace/lawrence-work/sanctum-fine.json',JSON.stringify(out));
