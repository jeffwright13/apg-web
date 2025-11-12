# UI Reorganization - TTS Settings & Audio Mixing

## Summary

Reorganized the UI to provide clear separation between TTS engine settings and audio post-processing settings, improving user understanding and maintainability.

## Changes Made

### **1. Consistent TTS Engine Structure**

Each TTS engine now follows the same pattern:

```
Engine-Specific Settings (always visible when engine selected)
├─ API Key (if required)
├─ Voice selection
└─ Advanced TTS Settings (collapsible <details>)
   └─ Engine-specific parameters
```

### **2. Engine-Specific Settings**

#### **OpenAI TTS**
- **Basic**: API Key, Voice
- **Advanced TTS Settings**:
  - Model Quality (Standard vs HD)
  - Speed (0.25x - 4.0x)

#### **Google Cloud TTS**
- **Basic**: API Key, Voice
- **Advanced TTS Settings**:
  - Speaking Rate (0.25x - 4.0x)
  - Pitch (-20 to +20)
  - Volume Gain (-96 to +16 dB)

#### **Web Speech API**
- **Basic**: Informational message (no configuration needed)
- **Advanced TTS Settings**: None (uses browser defaults)

#### **gTTS (Google Translate TTS)**
- **Basic**: Accent/Region
- **Advanced TTS Settings**:
  - Slow speech checkbox (half speed)

### **3. Audio Mixing Settings**

Renamed from "Advanced Options" to "Audio Mixing Settings" for clarity.

**Settings include:**
- Background volume adjustment (-40 to +6 dB)
- Fade in duration (0-10000 ms)
- Fade out duration (0-10000 ms)

**Behavior:**
- Hidden for Web Speech API (no export/mixing support)
- Visible for all other engines that support audio export

### **4. Removed Redundancy**

- **Removed global `slow-speech` checkbox** - Was redundant with engine-specific speed/rate controls
- **Moved gTTS slow speech** to its own Advanced TTS Settings section
- **Consistent naming** - All advanced sections now called "Advanced TTS Settings"

## UI Flow

### **Before:**
```
TTS Engine Selection
├─ Engine Settings (mixed basic + advanced)
│  ├─ Some engines had "Advanced Voice Settings"
│  └─ Some engines had no advanced section
└─ Advanced Options (mixed TTS + audio mixing)
   ├─ Slow speech (TTS setting)
   ├─ Background volume (audio mixing)
   ├─ Fade in (audio mixing)
   └─ Fade out (audio mixing)
```

### **After:**
```
TTS Engine Selection
├─ Engine-Specific Settings
│  ├─ Basic settings (API key, voice)
│  └─ Advanced TTS Settings (engine parameters)
└─ Audio Mixing Settings (post-processing)
   ├─ Background volume adjustment
   ├─ Fade in duration
   └─ Fade out duration
```

## Benefits

### **1. Clear Separation of Concerns**
- **TTS Generation**: Settings that affect how speech is generated
- **Audio Mixing**: Settings that affect how speech is combined with background music

### **2. Consistent Structure**
- All engines follow the same pattern
- Easy to understand what each section does
- Predictable UI behavior

### **3. Context-Aware**
- Audio Mixing Settings hidden for Web Speech API (no export support)
- Each engine shows only relevant settings
- No confusing disabled controls

### **4. Scalable**
- Easy to add new TTS engines
- Easy to add new audio effects (compression, EQ, normalization, etc.)
- Clear place for each type of setting

### **5. User-Friendly**
- Beginners see simple options (API key + voice)
- Advanced users can expand for more control
- Clear labels explain what each section does

## Technical Changes

### **HTML Changes**
- Reorganized TTS settings sections
- Added `web-speech-settings` section
- Renamed "Advanced Options" to "Audio Mixing Settings"
- Added descriptive help text
- Moved `gtts-slow-speech` checkbox to gTTS Advanced TTS Settings

### **JavaScript Changes**
- Updated `updateEngineUI()` to handle `web-speech-settings`
- Added logic to hide Audio Mixing Settings for Web Speech API
- Removed global `slow-speech` checkbox handling
- Updated gTTS to use `gtts-slow-speech` checkbox

### **Backward Compatibility**
- All existing functionality preserved
- All form field names unchanged (except `slow-speech` → `gtts-slow-speech`)
- All event handlers work as before

## Future Enhancements

### **Potential Audio Mixing Settings**
- **Normalization**: Adjust overall volume to target level
- **Compression**: Reduce dynamic range
- **EQ**: Adjust frequency balance
- **Reverb**: Add spatial effects
- **Noise gate**: Remove background noise
- **Crossfade**: Smooth transitions between phrases

### **Potential TTS Settings**
- **Web Speech API**: Add language/voice selection if we implement it
- **Pronunciation dictionary**: Custom word pronunciations
- **SSML support**: Advanced speech markup
- **Emotion/style**: Vary speaking style (if engine supports it)

## Testing Recommendations

1. **Test each engine**: Verify settings show/hide correctly
2. **Test Web Speech API**: Verify Audio Mixing Settings hidden
3. **Test gTTS slow speech**: Verify checkbox works in new location
4. **Test form submission**: Verify all values captured correctly
5. **Test advanced sections**: Verify collapse/expand works
6. **Test responsive design**: Verify layout on mobile devices

## Notes

- This is a **non-breaking change** - all functionality works the same
- Users may need to re-learn where settings are located
- Consider adding tooltips or help text for first-time users
- The reorganization makes the codebase more maintainable
- Future audio effects can be added to Audio Mixing Settings without cluttering TTS settings
