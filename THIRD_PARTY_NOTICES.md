# Third-party notices

## ChoCo: the Chord Corpus

Chordly includes aggregate, transposition-normalized harmonic transition probabilities derived from **ChoCo v1.0.0**.

- Authors: Jacopo de Berardinis, Andrea Poltronieri, Albert Meroño-Peñuela, and Valentina Presutti
- Project: https://github.com/smashub/choco
- DOI: https://doi.org/10.5281/zenodo.7706751
- Paper: *ChoCo: a Chord Corpus and a Data Transformation Workflow for Musical Harmony Knowledge Graphs*, Scientific Data 10, 641 (2023)
- License: Creative Commons Attribution 4.0 International (CC BY 4.0), https://creativecommons.org/licenses/by/4.0/

Only these CC BY 4.0 partitions are used: `billboard`, `isophonics`, `robbie-williams`, `rock-corpus`, `rwc-pop`, and `uspop2002`.

The build process infers a tonal center where necessary, maps chords to transposition-invariant Roman-numeral categories, removes consecutive duplicates, and stores only aggregate unigram, bigram, and trigram probabilities. Chordly does not redistribute song titles or individual source progressions. The aggregate was modified for Chordly and is not endorsed by the ChoCo authors.

The ChoCo partitions identified upstream as CC BY-NC-SA 4.0 (`chordify`, `mozart-piano-sonatas`, and `jaah`) are explicitly excluded.
