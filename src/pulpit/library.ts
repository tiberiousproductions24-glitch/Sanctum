// Sanctum Pulpit content library, stored as data. All original: progressions are generic gospel harmony
// (not copyrightable), and the song cue words are PUBLIC-DOMAIN hymn texts or generic call-and-response.
// Chords are key-relative (Roman numerals or Nashville numbers; see theory.ts) and transpose to any key.
// No imports, so node tests can load this file directly.

export type Mode = 'major' | 'minor';
export type FeelId = 'whoop' | 'tuneup' | 'ballad' | 'worship' | 'praise' | 'shout' | 'fastshout';
export interface Feel { id: FeelId; name: string; bpm: number; beatsPerBar: number; swing: number; hint: string }
export interface Step { c: string; hit?: boolean; cue?: string; beats?: number; run?: boolean }
export interface Progression { id: string; name: string; mode: Mode; feel: FeelId; key: string; steps: Step[]; desc: string; tags: string[] }
export interface SongSection { name: string; steps: Step[] }
export interface Song { id: string; title: string; credit: string; key: string; mode: Mode; feel: FeelId; sections: SongSection[] }
export interface ShoutSet { id: string; name: string; mode: Mode; key: string; bpm: number; vamp: string[]; beatsPerChord: number; ending: string[]; endingBeats: number[]; calls: string[] }
export type ItemKind = 'progression' | 'song' | 'shout';
export interface PlaylistItem { kind: ItemKind; id: string; key?: string; label?: string; band?: 'full' | 'duo' }
export interface Playlist { id: string; name: string; items: PlaylistItem[] }
export interface Collection { id: string; name: string; kind: ItemKind; ids: string[] }

export const FEELS: Record<FeelId, Feel> = {
  whoop:     { id: 'whoop',     name: 'Whoop (12/8 hold)',  bpm: 66,  beatsPerBar: 4, swing: 0.66, hint: 'Each tap holds a chord under the preacher. Tap again on the next phrase.' },
  tuneup:    { id: 'tuneup',    name: 'Tuning up',          bpm: 60,  beatsPerBar: 4, swing: 0.5,  hint: 'Soft organ and cymbal swells while the preacher builds.' },
  ballad:    { id: 'ballad',    name: 'Ballad / hymn',      bpm: 64,  beatsPerBar: 3, swing: 0.5,  hint: 'Slow 3/4 hymn feel for singer backup.' },
  worship:   { id: 'worship',   name: 'Worship / altar',    bpm: 72,  beatsPerBar: 4, swing: 0.5,  hint: 'Pads and keys, light kit.' },
  praise:    { id: 'praise',    name: 'Praise (medium)',    bpm: 104, beatsPerBar: 4, swing: 0.56, hint: 'Medium congregational praise.' },
  shout:     { id: 'shout',     name: 'Shout',              bpm: 132, beatsPerBar: 4, swing: 0.5,  hint: 'Up-tempo shout groove.' },
  fastshout: { id: 'fastshout', name: 'Fast shout',         bpm: 150, beatsPerBar: 4, swing: 0.5,  hint: 'Full-speed praise break.' },
};

const st = (s: string): Step[] => s.trim().split(/\s+/).map((tok) => {
  const hit = tok.endsWith('!'); const run = tok.startsWith('~');
  return { c: tok.replace(/!$/, '').replace(/^~/, ''), hit: hit || undefined, run: run || undefined };
});

export const PROGRESSIONS: Progression[] = [
  { id: 'whoop-14', name: 'Whoop 1–4', mode: 'major', feel: 'whoop', key: 'Ab', steps: st('I9 IV9 I9 IV9'), desc: 'The basic preacher back-and-forth. Tap on every phrase.', tags: ['preaching'] },
  { id: 'whoop-145', name: 'Whoop 1–4–1–5', mode: 'major', feel: 'whoop', key: 'Ab', steps: st('I IV9 I V7sus V7'), desc: 'Home, lift, home, and set up the turnaround.', tags: ['preaching'] },
  { id: 'two-five-one', name: '2–5–1 resolve', mode: 'major', feel: 'whoop', key: 'Eb', steps: st('ii9 V13 Imaj9 I7'), desc: 'The jazz-gospel resolve. The I7 leads back to IV.', tags: ['preaching', 'turnaround'] },
  { id: 'one-six-two-five', name: '1–6–2–5 turnaround', mode: 'major', feel: 'whoop', key: 'Bb', steps: st('1(9) 6(7#9) 2m9 5(13)'), desc: 'The classic turnaround. Loops back to 1.', tags: ['preaching', 'turnaround'] },
  { id: 'passing-walk', name: 'Passing walk 1–4–#4°–1/5', mode: 'major', feel: 'whoop', key: 'G', steps: st('I9 IV13 #ivdim7 I/5 VI7#9 ii9 V13'), desc: 'The church walk-up from 1 to 4 and back home through 6–2–5. Same changes as the Shout Guitar/Bass passing loops.', tags: ['preaching', 'walk'] },
  { id: 'minor-whoop', name: 'Minor whoop i–iv', mode: 'minor', feel: 'whoop', key: 'Fm', steps: st('i9 iv9 i9 V7#9'), desc: 'Dark, heavy whoop for the minor preacher.', tags: ['preaching', 'minor'] },
  { id: 'minor-walk', name: 'Minor 1–6–5', mode: 'minor', feel: 'whoop', key: 'Cm', steps: st('i9 bVImaj7 V7#9 i9'), desc: 'Minor whoop with a bVI lift.', tags: ['preaching', 'minor'] },
  { id: 'band-hits', name: 'Band hits (stabs)', mode: 'major', feel: 'praise', key: 'Ab', steps: st('I! IV! I! V7!'), desc: 'Short, punched band hits that answer the preacher.', tags: ['hits'] },
  { id: 'tune-up', name: 'Tuning up', mode: 'major', feel: 'tuneup', key: 'Eb', steps: st('I IV/1 I V7sus ~V7'), desc: 'Pre-whoop organ "tune up" with a run into the 5.', tags: ['preaching', 'intro'] },
  { id: 'altar-call', name: 'Altar call', mode: 'major', feel: 'worship', key: 'Db', steps: st('Imaj9 iii7 vi9 ii9 IVmaj7/5 V7sus'), desc: 'Soft worship changes for prayer and altar call.', tags: ['worship'] },
];

export const SONGS: Song[] = [
  { id: 'amazing-grace', title: 'Amazing Grace', credit: 'Words: John Newton (1779), public domain. Arrangement: Sanctum original.', key: 'G', mode: 'major', feel: 'ballad', sections: [
    { name: 'Verse 1', steps: [
      { c: 'I', cue: 'A-MAZING GRACE' }, { c: 'IV', cue: 'how sweet' }, { c: 'I', cue: 'the sound' },
      { c: 'I', cue: 'that saved a wretch' }, { c: 'V7', cue: 'like me' },
      { c: 'I', cue: 'I once was lost' }, { c: 'I7', cue: 'but now' }, { c: 'IV', cue: 'am found' },
      { c: 'I/5', cue: 'was blind' }, { c: 'V7', cue: 'but now' }, { c: 'I', cue: 'I SEE' } ] },
    { name: 'Verse 2', steps: [
      { c: 'I', cue: '\'TWAS GRACE' }, { c: 'IV', cue: 'that taught' }, { c: 'I', cue: 'my heart to fear' },
      { c: 'I', cue: 'and grace' }, { c: 'V7', cue: 'my fears relieved' },
      { c: 'I', cue: 'how precious' }, { c: 'I7', cue: 'did that' }, { c: 'IV', cue: 'grace appear' },
      { c: 'I/5', cue: 'the hour' }, { c: 'V7', cue: 'I first' }, { c: 'I', cue: 'BELIEVED' } ] },
  ] },
  { id: 'blessed-assurance', title: 'Blessed Assurance', credit: 'Words: Fanny Crosby (1873), public domain. Arrangement: Sanctum original.', key: 'D', mode: 'major', feel: 'ballad', sections: [
    { name: 'Verse', steps: [
      { c: 'I', cue: 'BLESSED ASSURANCE' }, { c: 'IV', cue: 'Jesus is' }, { c: 'I', cue: 'mine' },
      { c: 'I', cue: 'O what a foretaste' }, { c: 'V7', cue: 'of glory divine' },
      { c: 'I', cue: 'Heir of salvation' }, { c: 'IV', cue: 'purchase' }, { c: 'I', cue: 'of God' },
      { c: 'I/5', cue: 'born of His Spirit' }, { c: 'V7', cue: 'washed in His' }, { c: 'I', cue: 'BLOOD' } ] },
    { name: 'Refrain', steps: [
      { c: 'V7', cue: 'THIS IS MY STORY' }, { c: 'I', cue: 'this is my song' },
      { c: 'IV', cue: 'praising my Savior' }, { c: 'I', cue: 'all the day long' },
      { c: 'V7', cue: 'THIS IS MY STORY' }, { c: 'I', cue: 'this is my song' },
      { c: 'IV', cue: 'praising my Savior' }, { c: 'V7', cue: 'all the day' }, { c: 'I', cue: 'LONG' } ] },
  ] },
  { id: 'little-light', title: 'This Little Light of Mine', credit: 'Traditional spiritual, public domain. Arrangement: Sanctum original.', key: 'F', mode: 'major', feel: 'praise', sections: [
    { name: 'Chorus', steps: [
      { c: 'I', cue: 'THIS LITTLE LIGHT OF MINE' }, { c: 'I', cue: 'I\'m gonna let it shine' },
      { c: 'IV', cue: 'THIS LITTLE LIGHT OF MINE' }, { c: 'I', cue: 'I\'m gonna let it shine' },
      { c: 'I', cue: 'THIS LITTLE LIGHT OF MINE' }, { c: 'VI7', cue: 'I\'m gonna let it shine' },
      { c: 'ii7', cue: 'let it shine' }, { c: 'V7', cue: 'let it shine' }, { c: 'I', cue: 'LET IT SHINE' } ] },
    { name: 'Verse (everywhere I go)', steps: [
      { c: 'I', cue: 'EVERYWHERE I GO' }, { c: 'I', cue: 'I\'m gonna let it shine' },
      { c: 'IV', cue: 'EVERYWHERE I GO' }, { c: 'I', cue: 'I\'m gonna let it shine' },
      { c: 'I', cue: 'EVERYWHERE I GO' }, { c: 'VI7', cue: 'I\'m gonna let it shine' },
      { c: 'ii7', cue: 'let it shine' }, { c: 'V7', cue: 'let it shine' }, { c: 'I', cue: 'LET IT SHINE' } ] },
  ] },
  { id: 'call-response', title: 'Praise Call & Response', credit: 'Generic call-and-response (Sanctum original).', key: 'Ab', mode: 'major', feel: 'praise', sections: [
    { name: 'Call', steps: [
      { c: 'I', cue: 'SOMEBODY SAY YES' }, { c: 'IV9', cue: '(yes!)' }, { c: 'I', cue: 'LIFT YOUR HANDS' }, { c: 'IV9', cue: '(hallelujah)' },
      { c: 'I', cue: 'HE\'S BEEN GOOD' }, { c: 'VI7#9', cue: '(all the time)' }, { c: 'ii9', cue: 'GIVE HIM' }, { c: 'V13', cue: 'PRAISE!' } ] },
  ] },
];

export const SHOUT_SETS: ShoutSet[] = [
  { id: 'shout-14', name: 'Shout 1–4 vamp', mode: 'major', key: 'Ab', bpm: 132, vamp: ['I7', 'IV9'], beatsPerChord: 4,
    ending: ['IV9', '#ivdim7', 'I/5', 'V7#9', 'I9'], endingBeats: [2, 2, 2, 2, 8], calls: ['SHOUT!', 'GIVE HIM PRAISE', 'HALLELUJAH', 'COME ON!'] },
  { id: 'shout-1415', name: 'Shout 1–4–1–5', mode: 'major', key: 'C', bpm: 120, vamp: ['I7', 'IV9', 'I7', 'V7#9'], beatsPerChord: 4,
    ending: ['IV9', 'V7#9', 'I9'], endingBeats: [4, 4, 8], calls: ['PRAISE HIM', 'YES LORD', 'THANK YOU JESUS'] },
  { id: 'shout-minor', name: 'Minor shout i–iv', mode: 'minor', key: 'Fm', bpm: 140, vamp: ['i7', 'iv9'], beatsPerChord: 4,
    ending: ['bVI7', 'V7#9', 'i9'], endingBeats: [4, 4, 8], calls: ['SHOUT!', 'GLORY!', 'HALLELUJAH'] },
  { id: 'shout-fast-1625', name: 'Fast shout 1–6–2–5', mode: 'major', key: 'Bb', bpm: 150, vamp: ['I7', 'VI7#9', 'ii9', 'V13'], beatsPerChord: 2,
    ending: ['ii9', 'V13', 'I9'], endingBeats: [4, 4, 8], calls: ['RUN!', 'PRAISE BREAK', 'COME ON!'] },
];

export const COLLECTIONS: Collection[] = [
  { id: 'preaching', name: 'Preaching (whoop)', kind: 'progression', ids: ['tune-up', 'whoop-14', 'whoop-145', 'two-five-one', 'one-six-two-five', 'passing-walk', 'minor-whoop', 'minor-walk', 'band-hits'] },
  { id: 'singer', name: 'Singer backup (hymns)', kind: 'song', ids: ['amazing-grace', 'blessed-assurance', 'little-light', 'call-response'] },
  { id: 'shout', name: 'Shout', kind: 'shout', ids: ['shout-14', 'shout-1415', 'shout-minor', 'shout-fast-1625'] },
  { id: 'worship', name: 'Worship & altar', kind: 'progression', ids: ['altar-call', 'two-five-one'] },
];

export const PLAYLISTS: Playlist[] = [
  { id: 'sunday-am', name: 'Sunday Morning (sample)', items: [
    { kind: 'song', id: 'call-response', key: 'Ab', label: 'Call to worship' },
    { kind: 'song', id: 'blessed-assurance', key: 'D' },
    { kind: 'song', id: 'amazing-grace', key: 'G' },
    { kind: 'progression', id: 'tune-up', key: 'Eb', label: 'Sermon: tune up' },
    { kind: 'progression', id: 'whoop-145', key: 'Eb', label: 'Sermon: whoop' },
    { kind: 'shout', id: 'shout-14', key: 'Eb', label: 'Praise break' },
    { kind: 'progression', id: 'altar-call', key: 'Db', label: 'Altar call' },
  ] },
  { id: 'revival', name: 'Revival Night — organ & drums', items: [
    { kind: 'progression', id: 'tune-up', key: 'F', band: 'duo' },
    { kind: 'progression', id: 'minor-whoop', key: 'Fm', band: 'duo' },
    { kind: 'shout', id: 'shout-minor', key: 'Fm', band: 'duo' },
    { kind: 'song', id: 'little-light', key: 'F', band: 'duo' },
    { kind: 'shout', id: 'shout-fast-1625', key: 'F', band: 'duo' },
  ] },
];

export function findItem(kind: ItemKind, id: string): Progression | Song | ShoutSet | undefined {
  return kind === 'progression' ? PROGRESSIONS.find((p) => p.id === id) : kind === 'song' ? SONGS.find((s) => s.id === id) : SHOUT_SETS.find((s) => s.id === id);
}
export function itemTitle(it: PlaylistItem): string {
  const x = findItem(it.kind, it.id) as any; return it.label || x?.name || x?.title || it.id;
}
/** Flatten a song into steps carrying section names (for the cue display). */
export function songSteps(s: Song): (Step & { section: string; index: number })[] {
  const out: (Step & { section: string; index: number })[] = [];
  for (const sec of s.sections) sec.steps.forEach((x, i) => out.push({ ...x, section: sec.name, index: i }));
  return out;
}

/** Sanity check of the library. Returns a list of problems (empty = OK). Pass a chord parser to also check every token. */
export function validateLibrary(parse?: (tok: string, mode: Mode) => unknown): string[] {
  const errs: string[] = [];
  const ids = new Set<string>();
  for (const x of [...PROGRESSIONS, ...SONGS, ...SHOUT_SETS]) { if (ids.has(x.id)) errs.push('duplicate id ' + x.id); ids.add(x.id); }
  for (const pl of PLAYLISTS) for (const it of pl.items) if (!findItem(it.kind, it.id)) errs.push(`playlist ${pl.id}: missing ${it.kind} ${it.id}`);
  for (const c of COLLECTIONS) for (const id of c.ids) if (!findItem(c.kind, id)) errs.push(`collection ${c.id}: missing ${id}`);
  for (const s of SHOUT_SETS) if (s.ending.length !== s.endingBeats.length) errs.push(`shout ${s.id}: ending/endingBeats length`);
  if (parse) {
    const tryTok = (t: string, m: Mode, where: string) => { try { parse(t, m); } catch (e) { errs.push(`${where}: ${(e as Error).message}`); } };
    for (const p of PROGRESSIONS) p.steps.forEach((s) => tryTok(s.c, p.mode, p.id));
    for (const s of SONGS) s.sections.forEach((sec) => sec.steps.forEach((x) => tryTok(x.c, s.mode, s.id)));
    for (const s of SHOUT_SETS) [...s.vamp, ...s.ending].forEach((t) => tryTok(t, s.mode, s.id));
  }
  return errs;
}
