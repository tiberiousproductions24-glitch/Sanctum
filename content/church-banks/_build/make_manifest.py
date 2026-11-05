import json, os
os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DESC = {
    'shout-guitar': 'Funky gospel shout guitar in G, C, D, A: chicken scratch, passing chords, shout licks, stabs.',
    'shout-organ': 'Hammond-style shout organ in G, C, D, A: I7/IV9 stabs, shout loops, 6/9 swells.',
    'shout-bass': 'Shout bass in G, C, D, A: octave pump, passing walk, turnaround runs, hits.',
    'shout-percussion': 'Shout percussion: shaker, tambourine, claps, snap, and groove loops at 120/132/140/150.',
    'trap-sanctuary': 'Gospel trap in F minor, 140 BPM: distorted 808s, clicky kick, stacked clap, rolling hats, dark keys + synth choir, riser.',
    'drill-pulpit': 'Gospel drill in G minor, 142 BPM: sliding 808s, 3-3-2 hats, displaced snares, dark synth choir.',
    'amapiano-praise': 'Amapiano / Afro-gospel praise in D minor, 112 BPM: FM log drums, swung shakers, wood, conga, deep sub, Rhodes stabs.',
    'neo-soul-sunday': 'Neo-soul Sunday service in Eb, 84 BPM: Rhodes 9/11/13sus chords, tonewheel organ chops, brushed kit, sub, tape texture.',
    'stage-fx-modern': 'Cinematic worship FX: impacts, sub drop, reverse swell, tape stop, risers, synthesized formant choir, supersaw, reese.',
}
banks = []
for b in ['guitar', 'organ', 'bass', 'perc', 'modern']:
    if os.path.exists(f'_build/banks_{b}.json'): banks += json.load(open(f'_build/banks_{b}.json'))
for bank in banks:
    if bank['id'] in DESC: bank['description'] = DESC[bank['id']]
    for i, p in enumerate(bank['pads']):
        p['pad'] = i + 1; p['trigger'] = 'quantized' if p['type'] == 'loop' else 'immediate'; p['sizeBytes'] = os.path.getsize(p['file'])
man = json.load(open('manifest.json')) if os.path.exists('manifest.json') else {}
man['name'] = 'Sanctum Church, Shout & Modern Banks'
man['version'] = '1.1.0'
man['sampleRateNote'] = 'Shout banks: 44.1 kHz. Modern banks (group "modern", v0.3.1): 48 kHz. Every pad carries its own sampleRate.'
man['license'] = 'All sounds are original synthesis created for Sanctum (synthesized by Tiberious Productions / Sanctum); no third-party samples. No attribution required.'
man['formats']['ogg'] = 'Vorbis web version (q4 shout banks, q5 modern banks); the only format shipped in the Android APK'
man['banks'] = banks
json.dump(man, open('manifest.json', 'w'), indent=2)
print('banks', len(banks), 'pads', sum(len(b['pads']) for b in banks))
