"""
Chordly - Chord Engine (Python)
Generates MusicXML and MIDI files from chord progression data.
"""
import io
import os
import re
import tempfile
from music21 import stream, note, chord, meter, tempo, key, metadata, expressions, harmony, pitch, clef
from midiutil import MIDIFile

# Mapping from note name to pitch class (0-11)
NOTE_TO_PC = {
    'C': 0, 'C#': 1, 'Db': 1, 'D♭': 1, 'D': 2, 'D#': 3, 'Eb': 3, 'E♭': 3,
    'E': 4, 'F': 5, 'F#': 6, 'Gb': 6, 'G♭': 6, 'G': 7, 'G#': 8,
    'Ab': 8, 'A♭': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B♭': 10, 'B': 11
}

# Chord type to intervals (semitones from root)
CHORD_INTERVALS = {
    '':       [0, 4, 7],
    'm':      [0, 3, 7],
    '7':      [0, 4, 7, 10],
    'maj7':   [0, 4, 7, 11],
    'm7':     [0, 3, 7, 10],
    'm7b5':   [0, 3, 6, 10],
    'dim':    [0, 3, 6],
    'dim7':   [0, 3, 6, 9],
    'aug':    [0, 4, 8],
    'sus2':   [0, 2, 7],
    'sus4':   [0, 5, 7],
    '6':      [0, 4, 7, 9],
    'm6':     [0, 3, 7, 9],
    '9':      [0, 4, 7, 10, 14],
    'm9':     [0, 3, 7, 10, 14],
    'maj9':   [0, 4, 7, 11, 14],
    'add9':   [0, 4, 7, 14],
    'm(maj7)':[0, 3, 7, 11],
    '7sus4':  [0, 5, 7, 10],
}


def parse_chord_symbol(symbol):
    """Parse a chord symbol into root, type, and optional bass note.

    Returns (root_name, chord_type, bass_note_or_None).
    """
    if not symbol:
        return ('C', '', None)

    # Normalize ♭ to b
    symbol = str(symbol).replace('♭', 'b')

    # Handle slash chords
    bass = None
    if '/' in symbol:
        parts = symbol.split('/')
        main_part = parts[0]
        bass_str = parts[1]
        if bass_str in NOTE_TO_PC:
            bass = bass_str
    else:
        main_part = symbol

    match = re.match(r'^([A-G][#b]?)(.*)', main_part)
    if not match:
        return ('C', '', None)

    root = match.group(1)
    chord_type = match.group(2)

    # Normalize common aliases
    if chord_type == 'M7' or chord_type == 'Maj7':
        chord_type = 'maj7'
    elif chord_type == 'min' or chord_type == 'mi':
        chord_type = 'm'
    elif chord_type == 'min7':
        chord_type = 'm7'

    if chord_type not in CHORD_INTERVALS:
        chord_type = ''  # Default to major triad

    return (root, chord_type, bass)


def chord_to_midi_notes(symbol, octave=4):
    """Convert a chord symbol to a list of MIDI note numbers:
    1. All upper voicing notes across ALL chords are clamped into a FIXED 1-OCTAVE ABSOLUTE WINDOW (C4 to B4 / MIDI 60-71).
       No matter what chord it is (C or B or F#), notes higher than B4 are folded down into this single window.
    2. Bass note (slash bass if specified, else root) is placed in lower octave window (C3 to B3 / MIDI 48-59).
    """
    root, ctype, bass = parse_chord_symbol(symbol)
    root_pc = NOTE_TO_PC.get(root, 0)
    raw_intervals = CHORD_INTERVALS.get(ctype, [0, 4, 7])

    # 1. Extract unique pitch classes (0-11) for all chord tones
    pitch_classes = sorted(list(set([(root_pc + iv) % 12 for iv in raw_intervals])))

    # 2. Clamp all upper notes into the fixed absolute 1-octave window [60..71] (C4 to B4)
    upper_window_base = 60  # C4
    upper_notes = [upper_window_base + pc for pc in pitch_classes]

    # 3. Bass note in lower octave window [48..59] (C3 to B3)
    bass_name = bass if (bass and bass in NOTE_TO_PC) else root
    bass_pc = NOTE_TO_PC.get(bass_name, root_pc)
    bass_window_base = 48  # C3
    bass_midi = bass_window_base + bass_pc
    if bass_midi >= upper_notes[0]:
        bass_midi -= 12

    return [bass_midi] + upper_notes


def generate_musicxml(song_data):
    """Generate a MusicXML file from song data dict with section key signatures and chord symbols for MuseScore.

    Args:
        song_data: dict with keys:
            title, tempo, timeSignature, chordDurationBeats, sections

    Returns:
        bytes of the MusicXML file.
    """
    title = song_data.get('title', 'Chordly Export')
    bpm = song_data.get('tempo', 120)
    ts = song_data.get('timeSignature', [4, 4])
    chord_dur_beats = song_data.get('chordDurationBeats', 2)

    # Create a music21 score
    score = stream.Score()
    score.metadata = metadata.Metadata()
    score.metadata.title = title
    score.metadata.composer = 'Created with Chordly'

    part = stream.Part()
    part.partName = 'Chords'

    # Add Treble Clef (ト音記号), time signature, and tempo to the first measure
    treble_clef = clef.TrebleClef()
    time_sig = meter.TimeSignature(f'{ts[0]}/{ts[1]}')
    tempo_mark = tempo.MetronomeMark(number=bpm)

    current_offset = 0.0
    first_element = True
    last_key_str = None

    for section in song_data.get('sections', []):
        section_name = section.get('name', '')
        raw_key = str(section.get('key', 'C')).replace('♭', 'b')
        raw_mode = str(section.get('mode', 'major'))

        if raw_key == 'auto':
            raw_key = 'C'
        if raw_mode == 'auto':
            raw_mode = 'major'

        # Create Key Signature object for section
        current_key_str = f"{raw_key}_{raw_mode}"
        try:
            key_obj = key.Key(raw_key, raw_mode)
        except Exception:
            key_obj = key.Key('C', 'major')

        if first_element or current_key_str != last_key_str:
            part.insert(current_offset, key_obj)
            last_key_str = current_key_str

        for i, chord_sym in enumerate(section.get('chords', [])):
            clean_sym = str(chord_sym).replace('♭', 'b')
            midi_notes = chord_to_midi_notes(clean_sym)
            pitches = []
            for mn in midi_notes:
                p = note.Note(mn).pitch
                # Align enharmonic pitch spelling to section key signature (e.g. D# instead of Eb in sharp keys)
                if key_obj.sharps > 0 and '-' in p.name:
                    p = p.getEnharmonic()
                elif key_obj.sharps < 0 and '#' in p.name:
                    p = p.getEnharmonic()

                if p.accidental and p.accidental.name == 'natural':
                    p.accidental = None
                pitches.append(p)

            c = chord.Chord(pitches)
            c.quarterLength = chord_dur_beats
            for p in c.pitches:
                if p.accidental and p.accidental.name == 'natural':
                    p.accidental = None
                elif p.accidental:
                    p.accidental.displayStatus = False

            # Add Chord Symbol text (e.g. Ebmaj7, C#m7) for MuseScore chord display
            try:
                m21_sym = re.sub(r'([A-G])--', r'\1-', clean_sym.replace('b', '-'))
                cs = harmony.ChordSymbol(m21_sym)
                part.insert(current_offset, cs)
            except Exception:
                pass

            # Add section label as rehearsal mark on first chord
            if i == 0 and section_name:
                rm = expressions.RehearsalMark(section_name)
                c.expressions.append(rm)

            if first_element:
                part.insert(0, treble_clef)
                part.insert(0, time_sig)
                part.insert(0, tempo_mark)
                first_element = False

            part.insert(current_offset, c)
            current_offset += chord_dur_beats

    score.insert(0, part)

    # Make measures from the flat part
    part.makeMeasures(inPlace=True)

    # Ensure all pitches across entire score do not force explicit accidentals or naturals
    for p in score.recurse().getElementsByClass(pitch.Pitch):
        if p.accidental and p.accidental.name == 'natural':
            p.accidental = None
        elif p.accidental:
            p.accidental.displayStatus = False

    # Export to MusicXML safely
    tmp = tempfile.NamedTemporaryFile(suffix='.musicxml', delete=False)
    tmp_path = tmp.name
    tmp.close()

    try:
        score.write('musicxml', fp=tmp_path)
        with open(tmp_path, 'rb') as f:
            xml_bytes = f.read()
    finally:
        if os.path.exists(tmp_path):
            try:
                os.remove(tmp_path)
            except Exception:
                pass

    return xml_bytes


def generate_midi(song_data):
    """Generate a MIDI file from song data dict.

    Returns:
        bytes of the MIDI file.
    """
    bpm = song_data.get('tempo', 120)
    chord_dur_beats = song_data.get('chordDurationBeats', 2)

    midi = MIDIFile(1)  # One track
    track = 0
    channel = 0
    volume = 100
    time_offset = 0  # in beats

    midi.addTrackName(track, 0, song_data.get('title', 'Chordly Export'))
    midi.addTempo(track, 0, bpm)

    # Set piano instrument
    midi.addProgramChange(track, channel, 0, 0)  # Acoustic Grand Piano

    for section in song_data.get('sections', []):
        for chord_sym in section.get('chords', []):
            midi_notes = chord_to_midi_notes(chord_sym)
            for mn in midi_notes:
                midi.addNote(track, channel, mn, time_offset,
                             chord_dur_beats, volume)
            time_offset += chord_dur_beats

    buffer = io.BytesIO()
    midi.writeFile(buffer)
    return buffer.getvalue()
