# Audio Program Generator (Web)

Browser-based audio program generator that creates spoken audio from text files with optional background music.

## Features

- **Text-to-Speech**: Multiple TTS engines (Web Speech API, ElevenLabs, Google Cloud)
- **Background Music**: Mix speech with background audio
- **Audio Effects**: Fade in/out, attenuation control
- **Browser-based**: No server required, runs entirely in your browser
- **Local Storage**: All processing happens client-side

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
