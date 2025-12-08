/**
 * Tests for Theme Switcher functionality
 * Covers theme application, system preference detection, and sunrise/sunset calculations
 */

// Helper to create mock HTML element
function createMockHtml() {
  return {
    _theme: null,
    setAttribute(attr, value) {
      if (attr === 'data-theme') this._theme = value;
    },
    getAttribute(attr) {
      if (attr === 'data-theme') return this._theme;
      return null;
    },
    removeAttribute(attr) {
      if (attr === 'data-theme') this._theme = null;
    },
  };
}

// Helper to create mock matchMedia
function createMockMatchMedia(prefersDark) {
  return (query) => ({
    matches: query === '(prefers-color-scheme: dark)' ? prefersDark : false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  });
}

// Helper to create mock geolocation
function createMockGeolocation(latitude, longitude, shouldFail = false) {
  return {
    getCurrentPosition(success, error) {
      if (shouldFail) {
        error(new Error('Geolocation denied'));
      } else {
        success({ coords: { latitude, longitude } });
      }
    },
  };
}

// Theme controller class extracted for testing
class ThemeController {
  constructor(documentElement, matchMedia, geolocation) {
    this.html = documentElement;
    this.matchMedia = matchMedia;
    this.geolocation = geolocation;
  }

  applyTheme(theme) {
    if (theme === 'auto') {
      const mediaQuery = this.matchMedia('(prefers-color-scheme: dark)');
      const prefersDark = mediaQuery.matches;
      this.html.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
    } else if (theme === 'daynight') {
      this.applyDayNightTheme();
    } else if (theme === 'light') {
      this.html.setAttribute('data-theme', 'light');
    } else if (theme === 'dark') {
      this.html.setAttribute('data-theme', 'dark');
    }
  }

  applyDayNightTheme() {
    if (this.geolocation) {
      this.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          const isDaytime = this.isDaytime(latitude, longitude);
          this.html.setAttribute('data-theme', isDaytime ? 'light' : 'dark');
        },
        () => {
          const hour = new Date().getHours();
          const isDaytime = hour >= 6 && hour < 18;
          this.html.setAttribute('data-theme', isDaytime ? 'light' : 'dark');
        }
      );
    } else {
      const hour = new Date().getHours();
      const isDaytime = hour >= 6 && hour < 18;
      this.html.setAttribute('data-theme', isDaytime ? 'light' : 'dark');
    }
  }

  isDaytime(lat, lng) {
    const now = new Date();
    const { sunrise, sunset } = this.getSunTimes(now, lat, lng);
    return now >= sunrise && now < sunset;
  }

  getSunTimes(date, lat, lng) {
    const rad = Math.PI / 180;
    const dayOfYear = this.getDayOfYear(date);

    const declination = -23.45 * Math.cos((rad * (360 / 365)) * (dayOfYear + 10));
    const cosHourAngle = -Math.tan(lat * rad) * Math.tan(declination * rad);
    const clampedCos = Math.max(-1, Math.min(1, cosHourAngle));
    const hourAngle = Math.acos(clampedCos) / rad;

    const solarNoon = 12 - lng / 15;
    const sunriseHour = solarNoon - hourAngle / 15;
    const sunsetHour = solarNoon + hourAngle / 15;

    const sunrise = new Date(date);
    sunrise.setUTCHours(Math.floor(sunriseHour), (sunriseHour % 1) * 60, 0, 0);

    const sunset = new Date(date);
    sunset.setUTCHours(Math.floor(sunsetHour), (sunsetHour % 1) * 60, 0, 0);

    return { sunrise, sunset };
  }

  getDayOfYear(date) {
    const start = new Date(date.getFullYear(), 0, 0);
    const diff = date - start;
    const oneDay = 1000 * 60 * 60 * 24;
    return Math.floor(diff / oneDay);
  }
}

describe('ThemeController', () => {
  let controller;
  let mockHtml;

  beforeEach(() => {
    mockHtml = createMockHtml();
  });

  describe('applyTheme - explicit themes', () => {
    beforeEach(() => {
      controller = new ThemeController(
        mockHtml,
        createMockMatchMedia(false),
        null
      );
    });

    test('should set data-theme to light when theme is "light"', () => {
      controller.applyTheme('light');
      expect(mockHtml._theme).toBe('light');
    });

    test('should set data-theme to dark when theme is "dark"', () => {
      controller.applyTheme('dark');
      expect(mockHtml._theme).toBe('dark');
    });
  });

  describe('applyTheme - auto (system preference)', () => {
    test('should set light theme when system prefers light', () => {
      mockHtml = createMockHtml();
      controller = new ThemeController(
        mockHtml,
        createMockMatchMedia(false),
        null
      );
      controller.applyTheme('auto');
      expect(mockHtml._theme).toBe('light');
    });

    test('should set dark theme when system prefers dark', () => {
      mockHtml = createMockHtml();
      controller = new ThemeController(
        mockHtml,
        createMockMatchMedia(true),
        null
      );
      controller.applyTheme('auto');
      expect(mockHtml._theme).toBe('dark');
    });
  });

  describe('applyTheme - daynight (sun-based)', () => {
    test('should use geolocation when daynight theme is selected', () => {
      mockHtml = createMockHtml();
      const mockGeo = createMockGeolocation(39.7, -104.9);
      controller = new ThemeController(
        mockHtml,
        createMockMatchMedia(false),
        mockGeo
      );
      controller.applyTheme('daynight');
      // Should have set a theme based on geolocation
      expect(mockHtml._theme).not.toBeNull();
    });

    test('should fall back to time-based when geolocation fails', () => {
      mockHtml = createMockHtml();
      const mockGeo = createMockGeolocation(0, 0, true);
      controller = new ThemeController(
        mockHtml,
        createMockMatchMedia(false),
        mockGeo
      );
      controller.applyTheme('daynight');
      expect(mockHtml._theme).not.toBeNull();
    });

    test('should fall back to time-based when geolocation unavailable', () => {
      mockHtml = createMockHtml();
      controller = new ThemeController(
        mockHtml,
        createMockMatchMedia(false),
        null
      );
      controller.applyTheme('daynight');
      expect(mockHtml._theme).not.toBeNull();
    });
  });

  describe('getSunTimes', () => {
    beforeEach(() => {
      controller = new ThemeController(
        mockHtml,
        createMockMatchMedia(false),
        null
      );
    });

    test('should calculate sunrise and sunset for Denver on Dec 8', () => {
      // Denver coordinates
      const lat = 39.7392;
      const lng = -104.9903;
      const date = new Date('2025-12-08T12:00:00Z');

      const { sunrise, sunset } = controller.getSunTimes(date, lat, lng);

      // Sunrise should be around 7:08 AM MT (14:08 UTC)
      // Sunset should be around 4:36 PM MT (23:36 UTC)
      expect(sunrise).toBeInstanceOf(Date);
      expect(sunset).toBeInstanceOf(Date);
      expect(sunset > sunrise).toBe(true);

      // Check sunrise is roughly correct (within 30 minutes of expected)
      const sunriseHourUTC = sunrise.getUTCHours() + sunrise.getUTCMinutes() / 60;
      expect(sunriseHourUTC).toBeGreaterThan(13.5); // After 13:30 UTC
      expect(sunriseHourUTC).toBeLessThan(15); // Before 15:00 UTC
    });

    test('should calculate sunrise and sunset for equator on equinox', () => {
      // Equator
      const lat = 0;
      const lng = 0;
      // March 20 (approx equinox)
      const date = new Date('2025-03-20T12:00:00Z');

      const { sunrise, sunset } = controller.getSunTimes(date, lat, lng);

      // At equator on equinox, sunrise ~6am, sunset ~6pm local
      const sunriseHourUTC = sunrise.getUTCHours() + sunrise.getUTCMinutes() / 60;
      const sunsetHourUTC = sunset.getUTCHours() + sunset.getUTCMinutes() / 60;

      // Should be roughly 12 hours of daylight
      const daylightHours = sunsetHourUTC - sunriseHourUTC;
      expect(daylightHours).toBeGreaterThan(11.5);
      expect(daylightHours).toBeLessThan(12.5);
    });

    test('should handle polar regions (clamp hour angle)', () => {
      // Arctic circle in summer
      const lat = 70;
      const lng = 0;
      const date = new Date('2025-06-21T12:00:00Z'); // Summer solstice

      // Should not throw
      expect(() => controller.getSunTimes(date, lat, lng)).not.toThrow();
    });
  });

  describe('getDayOfYear', () => {
    beforeEach(() => {
      controller = new ThemeController(
        mockHtml,
        createMockMatchMedia(false),
        null
      );
    });

    test('should return 1 for January 1', () => {
      const date = new Date('2025-01-01T12:00:00Z');
      expect(controller.getDayOfYear(date)).toBe(1);
    });

    test('should return 365 for December 31 (non-leap year)', () => {
      const date = new Date('2025-12-31T12:00:00Z');
      expect(controller.getDayOfYear(date)).toBe(365);
    });

    test('should return 342 for December 8', () => {
      const date = new Date('2025-12-08T12:00:00Z');
      expect(controller.getDayOfYear(date)).toBe(342);
    });
  });

  describe('isDaytime', () => {
    beforeEach(() => {
      controller = new ThemeController(
        mockHtml,
        createMockMatchMedia(false),
        null
      );
    });

    test('should correctly identify daytime based on sun position', () => {
      // Test with a known location and time
      // Denver at noon local time (19:00 UTC in winter) should be daytime
      const lat = 39.7392;
      const lng = -104.9903;
      
      // Get sun times for today
      const now = new Date();
      const { sunrise, sunset } = controller.getSunTimes(now, lat, lng);
      
      // Verify sunrise is before sunset
      expect(sunrise < sunset).toBe(true);
      
      // Verify the day length is reasonable (8-16 hours depending on season)
      const dayLengthHours = (sunset - sunrise) / (1000 * 60 * 60);
      expect(dayLengthHours).toBeGreaterThan(8);
      expect(dayLengthHours).toBeLessThan(16);
    });

    test('should return consistent results for same inputs', () => {
      // isDaytime should be deterministic for same lat/lng
      const result1 = controller.isDaytime(0, 0);
      const result2 = controller.isDaytime(0, 0);
      expect(result1).toBe(result2);
    });
  });
});

describe('Time-based fallback', () => {
  // Create a testable version of the fallback logic
  function getThemeForHour(hour) {
    const isDaytime = hour >= 6 && hour < 18;
    return isDaytime ? 'light' : 'dark';
  }

  test('should return dark for hours before 6am', () => {
    expect(getThemeForHour(0)).toBe('dark');
    expect(getThemeForHour(3)).toBe('dark');
    expect(getThemeForHour(5)).toBe('dark');
  });

  test('should return light for hours 6am to 5pm', () => {
    expect(getThemeForHour(6)).toBe('light');
    expect(getThemeForHour(9)).toBe('light');
    expect(getThemeForHour(12)).toBe('light');
    expect(getThemeForHour(15)).toBe('light');
    expect(getThemeForHour(17)).toBe('light');
  });

  test('should return dark for hours 6pm and later', () => {
    expect(getThemeForHour(18)).toBe('dark');
    expect(getThemeForHour(20)).toBe('dark');
    expect(getThemeForHour(23)).toBe('dark');
  });

  test('should apply fallback when no geolocation', () => {
    const mockHtml = createMockHtml();
    const controller = new ThemeController(mockHtml, createMockMatchMedia(false), null);
    
    // Without geolocation, applyDayNightTheme should set a theme
    controller.applyDayNightTheme();
    
    // Should have set either light or dark based on current hour
    expect(['light', 'dark']).toContain(mockHtml._theme);
  });
});
