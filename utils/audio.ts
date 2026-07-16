import { createAudioPlayer } from 'expo-audio';
import * as Speech from 'expo-speech';

// Play sound from a local URI or fall back to Malayalam Text-To-Speech
export async function playCigaretteAlert(count: number, mappings: Record<number, string>, userName?: string) {
  const uri = mappings[count] || mappings[0]; // fallback to mapping 0 (default/all counts) if specific count not found

  if (uri) {
    try {
      console.log(`Playing custom recording for count ${count}:`, uri);
      const player = createAudioPlayer(uri);
      
      // Release player resource when playback finishes to avoid memory leaks
      const subscription = player.addListener('playbackStatusUpdate', (status) => {
        if (status.playbackState === 'finished') {
          console.log('Playback finished, releasing player');
          subscription.remove();
          player.release();
        }
      });
      
      await player.play();
      return;
    } catch (e) {
      console.error('Error playing custom recorded voice, falling back to TTS:', e);
    }
  }

  // Fallback to Malayalam Text-To-Speech
  const ttsMessage = getMalayalamTTSMessage(count, userName);
  try {
    console.log(`Speaking Malayalam TTS fallback for count ${count}:`, ttsMessage);
    Speech.stop(); // Stop any currently speaking TTS
    Speech.speak(ttsMessage, {
      language: 'ml-IN', // Malayalam (India)
      pitch: 1.0,
      rate: 0.95,
    });
  } catch (error) {
    console.error('Error with Malayalam TTS:', error);
  }
}

// Generate warnings in Malayalam script for high TTS accuracy
function getMalayalamTTSMessage(count: number, userName?: string): string {
  const greeting = userName ? `${userName}, ` : '';
  switch (count) {
    case 1:
      return `${greeting}ഇത് നിൻ്റെ ഒന്നാമത്തെ സിഗരറ്റ് ആണ്. നിർത്താൻ നോക്ക്!`;
    case 2:
      return `${greeting}ഇത് നിൻ്റെ രണ്ടാമത്തെ സിഗരറ്റ് ആണ്. പതുക്കെ കുറക്കാൻ നോക്ക്!`;
    case 3:
      return `${greeting}ഇത് നിൻ്റെ മൂന്നാമത്തെ സിഗരറ്റ് ആണ്. മൂഞ്ചും നീ, അല്ലെങ്കിൽ ശ്വാസകോശം പുകയാകും!`;
    case 4:
      return `${greeting}ഇത് നിൻ്റെ നാലാമത്തെ സിഗരറ്റ് ആണ്. കാലൻ നിന്നെ നോക്കി ഇറങ്ങിയിട്ടുണ്ട്.`;
    default:
      return `${greeting}ഇത് നിൻ്റെ ${count}-ാമത്തെ സിഗരറ്റ് ആണ്. നി തീരാൻ പോണു മൈരേ!`;
  }
}
