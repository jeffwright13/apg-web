# Audio Program Generator (Web)

Browser-based audio program generator - creates spoken audio from text with optional background music.

## Features

- **Text-to-Speech**: Convert text files to spoken audio
- **Multiple TTS Engines**: Google Translate TTS (free), Google Cloud TTS (premium), Web Speech API
- **Background Music**: Mix speech with background audio
- **Audio Export**: Download generated audio as WAV files
- **Browser-Based**: No installation required, runs entirely in your browser
- **Modern UI**: Clean, responsive interface with Pico.css

## Quick Start

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run a local web server:
   ```bash
   npm run serve
   ```
4. Open `http://localhost:8080` in your browser
5. Upload a phrase file and generate audio!

## Text-to-Speech Engines

### Google Cloud Text-to-Speech - **Recommended Default**

**High quality, requires API key and billing setup**

- 💰 **Cost**: Free tier (1M characters/month), then $16/1M characters
- 🔑 **Setup Required**:
  1. Create [Google Cloud account](https://console.cloud.google.com/)
  2. Enable Text-to-Speech API
  3. **Enable billing** (credit card required, even for free tier)
  4. Create API key
- ✅ **Quality**: Excellent (Neural2/WaveNet voices)
- ✅ **Features**: Advanced parameters (pitch, rate, volume), dynamic voice discovery
- ✅ **Export**: Full audio export and mixing support

**Billing Details**:
- Free tier: 1 million characters/month (WaveNet/Neural2)
- After free tier: $16 per 1 million characters
- Example: 6,600 generations of 150-char program = FREE
- Example: 10,000 generations = ~$8/month

**Best for**: Most users (generous free tier), professional quality

### Google Translate TTS (gTTS) - **Coming Soon**

**Requires backend proxy (CORS limitation)**

- ✅ **Cost**: Completely free
- ❌ **Status**: Not available in browser-only version
- ⚠️ **Issue**: Google Translate endpoint blocks browser requests (CORS)
- 🔧 **Solution**: Requires backend server or CORS proxy

**Note**: This worked in the Python version because it ran server-side. Browser version needs a proxy server to bypass CORS restrictions.

### Web Speech API - **Browser Playback Only**

**Free, no setup, limited functionality**

- ✅ **Cost**: Free
- ✅ **Setup**: None
- ⚠️ **Quality**: Browser-dependent (Chrome: good, Firefox/Safari: poor)
- ❌ **Export**: Not supported (playback only)
- ❌ **Mixing**: Not supported

**Best for**: Quick previews, testing (not recommended for production)

## Phrase File Format

Create a text file with phrases and durations:

```
Welcome to your audio program; 2
Take a deep breath; 3
*; 2
Relax your shoulders; 3
*; 5
You are calm and centered; 2
```

Format: `phrase; duration_in_seconds`
- Use `*` for silence
- One phrase per line

## Installation

```bash
# Clone the repository
git clone https://github.com/jeffwright13/apg-web.git
cd apg-web

# Install dependencies
npm install

# Set up git hooks
npm run prepare
```

## Usage

### Local Development

```bash
# Start local server
npm run serve

# Open browser to http://localhost:8080
```

### Running Tests

```bash
# Run all tests
npm test

# Watch mode
npm test:watch

# Coverage report
npm test:coverage
```

### Code Quality

```bash
# Lint code
npm run lint

# Auto-fix linting issues
npm run lint:fix

# Format code
npm run format

# Check formatting
npm run format:check
```

## Phrase File Format

Create a text file with phrases and pause durations:

```
First phrase; 2
Second phrase; 5
*; 3
Third phrase; 0
```

- Each line: `phrase; duration_in_seconds`
- Use `*` for silence
- Duration can be decimal (e.g., `2.5`)

## Development

Pre-commit hooks automatically run:

- ESLint (code quality)
- Prettier (formatting)
- Jest (tests for changed files)

## License

MIT

## Author

Jeff Wright <jeff.washcloth@gmail.com>
