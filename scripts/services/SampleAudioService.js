/**
 * Sample Audio Library Service
 * Manages bundled sample audio files for users who don't have their own
 * Discovers available samples by checking for known filenames
 */

export class SampleAudioService {
  constructor() {
    // List of expected sample filenames in /samples directory
    // Add or remove filenames here - the service will check which ones exist
    this.expectedFilenames = [
      'meditation-yoga-relaxing-music.mp3',
      'sea_waves.mp3',
      'lunar_new_year.mp3',
      'river_and_birds.mp3'
    ];
    
    this.samples = [];
    this.samplesLoaded = false;
  }

  /**
   * Convert filename to human-readable display name
   * @param {string} filename - The filename (e.g., 'sea_waves.mp3')
   * @returns {string} Display name (e.g., 'Sea Waves')
   */
  filenameToDisplayName(filename) {
    // Remove extension
    const nameWithoutExt = filename.replace(/\.[^/.]+$/, '');
    
    // Replace underscores and hyphens with spaces
    const withSpaces = nameWithoutExt.replace(/[_-]/g, ' ');
    
    // Capitalize each word
    return withSpaces
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  /**
   * Load and verify which sample files actually exist
   * @returns {Promise<void>}
   */
  async loadAvailableSamples() {
    if (this.samplesLoaded) return;

    const availableSamples = [];

    for (const filename of this.expectedFilenames) {
      try {
        const path = `./samples/${filename}`;
        const response = await fetch(path, { method: 'HEAD' });
        
        if (response.ok) {
          const id = filename.replace(/\.[^/.]+$/, '').replace(/[^a-z0-9]/gi, '_');
          const displayName = this.filenameToDisplayName(filename);
          
          availableSamples.push({
            id,
            name: displayName,
            description: displayName, // Use display name as description
            filename,
            path
          });
        }
      } catch {
        // File doesn't exist or can't be accessed, skip it
        console.error(`Sample not available: ${filename}`);
      }
    }

    this.samples = availableSamples;
    this.samplesLoaded = true;

    // eslint-disable-next-line no-console
    console.log(`✓ Found ${this.samples.length} available sample(s):`, 
      this.samples.map(s => s.filename).join(', '));
  }

  /**
   * Get all available samples
   * @returns {Array} List of sample metadata
   */
  getSamples() {
    return this.samples;
  }

  /**
   * Get sample options for dropdown
   * @returns {Array<{value: string, label: string, description: string}>}
   */
  getSampleOptions() {
    return [
      { value: '', label: '-- Select a sample --', description: '' },
      ...this.samples.map(sample => ({
        value: sample.id,
        label: sample.name,
        description: sample.description
      }))
    ];
  }

  /**
   * Load sample audio file
   * @param {string} sampleId - ID of sample to load
   * @returns {Promise<ArrayBuffer>} Audio data
   */
  async loadSample(sampleId) {
    const sample = this.samples.find(s => s.id === sampleId);
    if (!sample) {
      throw new Error(`Sample not found: ${sampleId}`);
    }

    try {
      const response = await fetch(sample.path);
      if (!response.ok) {
        throw new Error(`Failed to load sample: ${response.statusText}`);
      }
      return await response.arrayBuffer();
    } catch (error) {
      console.error(`Error loading sample ${sampleId}:`, error);
      throw new Error(`Could not load sample audio file. Make sure sample files are in the /samples directory.`);
    }
  }

  /**
   * Get sample metadata by ID
   * @param {string} sampleId - Sample ID
   * @returns {Object|null} Sample metadata
   */
  getSampleById(sampleId) {
    return this.samples.find(s => s.id === sampleId) || null;
  }

  /**
   * Check if sample files exist
   * @returns {Promise<Object>} Status of each sample file
   */
  async checkSampleAvailability() {
    const availability = {};
    
    for (const sample of this.samples) {
      try {
        const response = await fetch(sample.path, { method: 'HEAD' });
        availability[sample.id] = response.ok;
      } catch {
        availability[sample.id] = false;
      }
    }
    
    return availability;
  }
}
