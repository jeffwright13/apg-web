# Audio Program Generator (Web)

Browser-based audio program generator - creates spoken audio from text with optional background music.

## Features

- **Text-to-Speech**: Convert text files to spoken audio
- **Multiple TTS Engines**: OpenAI TTS, Google Cloud TTS, Web Speech API
- **Background Music**: Mix speech with background audio (supports MP3, WAV, OGG, M4A, AAC, FLAC, AIFF)
- **Audio Export**: Download as WAV (uncompressed) or MP3 (7-10x smaller)
- **Browser-Based**: No installation required, runs entirely in your browser
- **Modern UI**: Clean, responsive interface with Pico.css
- **Internet Required**: First load requires internet to download styling and MP3 encoder library

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

### OpenAI TTS - **Simple & Affordable**

**High quality, pay-as-you-go pricing**

- 💰 **Cost**: $15/1M characters (standard), $30/1M (HD)
- 🔑 **Setup Required**:
  1. Create [OpenAI account](https://platform.openai.com/)
  2. Add payment method (pay-as-you-go, no monthly fees)
  3. Create API key
- ✅ **Quality**: Excellent (6 natural-sounding voices)
- ✅ **Features**: Voice selection, speed control (0.25x-4x)
- ✅ **Export**: Full audio export and mixing support
- ✅ **Simplicity**: No billing account setup hassles

**Pricing Details**:
- Pay only for what you use
- No monthly subscription required
- Example: 100K characters = $1.50 (standard) or $3.00 (HD)
- Example: 1000 phrases @ 150 chars = $2.25 (standard)

**Best for**: Users who want simple setup, predictable per-use costs, and excellent quality

### Google Cloud Text-to-Speech

**High quality, generous free tier, complex setup**

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

## TTS Engine Setup Guides

### OpenAI TTS Setup

**Time Required**: ~2 minutes (one-time setup)

#### Step 1: Create OpenAI Account

1. Go to [OpenAI Platform](https://platform.openai.com/)
2. Sign up or sign in with your account
3. Note: This is separate from ChatGPT Plus subscription

#### Step 2: Add Payment Method

1. Click on "Settings" → "Billing"
2. Click "Add payment method"
3. Enter your credit card information
4. **Note**: You only pay for what you use (no monthly fees)

**Setting up usage limits** (recommended):
1. Go to "Settings" → "Billing" → "Usage limits"
2. Set a monthly budget (e.g., $10)
3. You'll be notified when you approach the limit

#### Step 3: Create API Key

1. Go to [API Keys page](https://platform.openai.com/api-keys)
2. Click "Create new secret key"
3. Configure the key:
   - **Name**: "Audio Program Generator" (or any name you prefer)
   - **Owned by**: Select "You"
   - **Permissions**: Select "All" (includes TTS access)
     - *Alternative*: Choose "Restricted" and enable "Model capabilities" for TTS-only access
4. Click "Create secret key"
5. Copy the API key (it will look like: `sk-proj-...`)
6. **Important**: Save it securely - you won't be able to see it again

**Note**: The same API key works for all OpenAI services (ChatGPT API, DALL-E, TTS, Whisper, etc.). There's no separate "TTS-only" key type.

#### Step 4: Use API Key in App

1. Open the Audio Program Generator in your browser
2. Select "OpenAI TTS" from the TTS Engine dropdown
3. Paste your API key in the "OpenAI API Key" field
4. Click "Save"
5. The key is stored locally in your browser (not sent anywhere else)

**Done!** You can now generate high-quality audio with OpenAI TTS.

**Available Voices**:
- **Nova** (Female - warm and friendly) - Recommended for meditation
- **Shimmer** (Female - soft and gentle) - Great for relaxation
- **Alloy** (Neutral - balanced)
- **Echo** (Male)
- **Fable** (Male - British)
- **Onyx** (Male - deep)

---

### Google Cloud Text-to-Speech Setup

**Time Required**: ~5 minutes (one-time setup)

#### Step 1: Create Google Cloud Account

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Sign in with your Google account
3. Accept the terms of service

#### Step 2: Create a New Project

1. Click the project dropdown at the top of the page
2. Click "New Project"
3. Enter a project name (e.g., "Audio Program Generator")
4. Click "Create"

#### Step 3: Enable Text-to-Speech API

1. In the search bar, type "Text-to-Speech API"
2. Click on "Cloud Text-to-Speech API"
3. Click "Enable"
4. Wait for the API to be enabled (~30 seconds)

#### Step 4: Enable Billing

⚠️ **Required even for free tier**

1. Click the hamburger menu (☰) → "Billing"
2. Click "Link a billing account" or "Add billing account"
3. Enter your credit card information
4. **Don't worry**: You won't be charged unless you exceed the free tier (1M characters/month)
5. You can set up billing alerts to notify you before any charges

**Setting up billing alerts** (recommended):
1. Go to "Billing" → "Budgets & alerts"
2. Click "Create budget"
3. Set budget to $1 (or any amount)
4. Set alert threshold to 50%, 90%, 100%
5. You'll receive email alerts if you approach the limit

#### Step 5: Create API Key

1. Click the hamburger menu (☰) → "APIs & Services" → "Credentials"
2. Click "Create Credentials" → "API key"
3. Copy the API key (it will look like: `AIzaSyC...`)
4. **Optional but recommended**: Click "Restrict key"
   - Under "API restrictions", select "Restrict key"
   - Select "Cloud Text-to-Speech API"
   - Click "Save"

#### Step 6: Use API Key in App

1. Open the Audio Program Generator in your browser
2. Select "Google Cloud TTS" from the TTS Engine dropdown
3. Paste your API key in the "Google Cloud API Key" field
4. Click "Save"
5. The key is stored locally in your browser (not sent anywhere else)

**Done!** You can now generate high-quality audio with Google Cloud TTS.

---

### Microsoft Edge TTS Setup (Alternative - Coming Soon)

**Free alternative with no API key required**

Microsoft Edge TTS is an unofficial API that provides free, high-quality neural voices without requiring an API key or billing setup.

**Status**: Implementation planned for future release

**Advantages**:
- ✅ Completely free
- ✅ No API key required
- ✅ No billing setup needed
- ✅ Excellent voice quality (Neural voices)
- ✅ Works from browser

**Limitations**:
- ⚠️ Unofficial API (not officially supported by Microsoft)
- ⚠️ Could potentially be rate-limited or discontinued
- ⚠️ Fewer voice options than Google Cloud TTS

**When available**, this will be a great option for users who want high-quality TTS without the API key setup process.

---

### Troubleshooting

#### "Invalid API key" error
- Make sure you copied the entire API key
- Check that you enabled the Text-to-Speech API
- Verify the API key restrictions (if set) include Text-to-Speech API

#### "Billing not enabled" error
- Billing must be enabled even for free tier usage
- Go to Billing section and link a payment method
- Wait a few minutes after enabling billing

#### "Quota exceeded" error
- You've exceeded the free tier (1M characters/month)
- Check your usage in Google Cloud Console → APIs & Services → Dashboard
- Either wait for the monthly reset or upgrade to paid tier

#### API key security
- Your API key is stored locally in your browser (localStorage)
- It's never sent to any server except Google's TTS API
- You can clear it anytime by clicking "Clear" in the browser
- For production use, consider restricting the API key to specific domains

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

## Supported Audio Formats

### Background Music Files

The app supports all common audio formats via the Web Audio API:

**✅ Universal Support (All Browsers):**
- **MP3** (.mp3) - Most common format
- **WAV** (.wav) - Uncompressed, high quality

**✅ Wide Support (Most Browsers):**
- **OGG Vorbis** (.ogg) - All except Safari
- **AAC/M4A** (.m4a, .aac) - Most browsers
- **WebM** (.webm) - Chrome, Firefox, Edge

**⚠️ Limited Support:**
- **FLAC** (.flac) - Chrome, Edge only (lossless)
- **AIFF** (.aiff, .aif) - Safari only

**Recommendation**: Use **MP3** for maximum compatibility and small file sizes.

### Output Format

Generated audio is always exported as **WAV** (uncompressed) for maximum quality and compatibility with audio editing software.

---

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
