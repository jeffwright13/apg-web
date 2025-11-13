/**
 * Sample Audio Library Service
 * Manages bundled sample audio files for users who don't have their own
 */

export class SampleAudioService {
  constructor() {
    // Sample audio files will be stored in /samples directory
    // User will provide these files
    this.samples = [
      {
        id: 'sample1',
        name: 'Sample 1',
        description: 'Ambient background music',
        filename: 'sample1.mp3',
        path: './samples/sample1.mp3'
      },
      {
        id: 'sample2',
        name: 'Sample 2',
        description: 'Upbeat background music',
        filename: 'sample2.mp3',
        path: './samples/sample2.mp3'
      },
      {
        id: 'sample3',
        name: 'Sample 3',
        description: 'Calm meditation music',
        filename: 'sample3.mp3',
        path: './samples/sample3.mp3'
      },
      {
        id: 'sample4',
        name: 'Sample 4',
        description: 'Nature sounds',
        filename: 'sample4.mp3',
        path: './samples/sample4.mp3'
      },
      {
        id: 'sample5',
        name: 'Sample 5',
        description: 'Corporate background',
        filename: 'sample5.mp3',
        path: './samples/sample5.mp3'
      }
    ];
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
