# Sample Audio Files

This directory contains sample background audio files that users can select without needing to upload their own files.

## How It Works

The application automatically discovers MP3 files in this directory by checking for expected filenames. Display names are generated from the filenames themselves (e.g., `sea_waves.mp3` becomes "Sea Waves").

## Current Samples

The following files are currently expected and will be auto-discovered:
- `meditation-yoga-relaxing-music.mp3`
- `sea_waves.mp3`
- `lunar_new_year.mp3`
- `river_and_birds.mp3`

To add new samples:
1. Add the MP3 file to this directory with a descriptive filename
2. Update the `expectedFilenames` array in `scripts/services/SampleAudioService.js`
3. Add license information below

## File Requirements

- Format: MP3 (for smaller file sizes)
- Use descriptive filenames (underscores or hyphens for spaces)
- Recommended duration: 30-120 seconds (will loop if needed)
- Recommended bitrate: 128-192 kbps
- File size: Keep under 2MB each for faster loading

## Copyright & License Information

### meditation-yoga-relaxing-music.mp3
- **Artist**: Genti Guxholli (GentiGuxholli)
- **Source**: [Pixabay](https://pixabay.com/music/ambient-meditation-yoga-relaxing-music-371413/)
- **License**: Pixabay Content License
- **Attribution**: Music by Genti Guxholli from Pixabay

### sea_waves.mp3
- **Artist**: Michael Koreli (kokoreli777)
- **Source**: [Pixabay](https://pixabay.com/sound-effects/sea-waves-169411/)
- **License**: Pixabay License (CC0-equivalent)
- **Attribution**: Sound Effect by Michael Koreli from Pixabay

### lunar_new_year.mp3
- **Artist**: Alex-Productions
- **Source**: [Free Music Archive](https://freemusicarchive.org/music/alex-productions/single/lunar-new-year/)
- **License**: Creative Commons
- **Attribution**: "Lunar New Year" by Alex-Productions

### river_and_birds.mp3
- **Artist**: Richard Vogt (Garuda1982)
- **Source**: [Freesound.org](https://freesound.org/people/Garuda1982/)
- **License**: CC-BY 4.0
- **Attribution**: "river_and_birds" by Garuda1982 licensed under CC BY 4.0

## Usage

The application automatically loads sample metadata from this file. To add or modify samples:
1. Add the MP3 file to this directory
2. Update the Sample Metadata section above with the format: `filename | display name | description`
3. Add license information in the Copyright & License Information section

## Recommended Sources for Additional Samples

- [Freesound.org](https://freesound.org/)
- [Pixabay](https://pixabay.com/)
- [Free Music Archive](https://freemusicarchive.org/)
- [Incompetech](https://incompetech.com/music/royalty-free/)
- [YouTube Audio Library](https://www.youtube.com/audiolibrary)
- [ccMixter](http://ccmixter.org/)
- [Bensound](https://www.bensound.com/)
