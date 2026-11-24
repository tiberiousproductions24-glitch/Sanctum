import fs from 'node:fs';
import { analyseBuffer } from '/workspace/projects/sanctum/src/chords/offline.ts';
const buf = fs.readFileSync('/workspace/lawrence-work/audio.raw');
const s = new Float32Array(buf.buffer, buf.byteOffset, buf.length/4);
const chart = analyseBuffer(s, 22050);
fs.writeFileSync('/workspace/lawrence-work/sanctum-chart.json', JSON.stringify(chart,null,1));
console.log('key', JSON.stringify(chart.key), 'bpm', chart.bpm, 'n', chart.chords.length);
for (const c of chart.chords) console.log((c.start??c.time??0).toFixed?.(1), JSON.stringify(c));
