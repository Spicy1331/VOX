const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

export const isSpeechRecognitionSupported = !!SpeechRecognition;
export const isSpeechSynthesisSupported = !!window.speechSynthesis;

let recognition = null;

export const startListening = (onResult, onEnd, onError, lang = 'en-US') => {
    if (!isSpeechRecognitionSupported) {
        throw new Error('Speech Recognition not supported in this browser.');
    }

    if (recognition) {
        recognition.abort();
    }

    recognition = new SpeechRecognition();
    recognition.continuous = false; // We want one sentence/command at a time usually, or true for dictation
    recognition.interimResults = false;
    recognition.lang = lang;

    recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        onResult(transcript);
    };

    recognition.onerror = (event) => {
        console.error('Speech recognition error', event.error);
        if (onError) onError(event.error);
    };

    recognition.onend = () => {
        if (onEnd) onEnd();
    };

    recognition.start();
    return recognition;
};

export const stopListening = () => {
    if (recognition) {
        recognition.stop();
    }
};

export const stopSpeaking = () => {
    if (isSpeechSynthesisSupported) {
        window.speechSynthesis.cancel();
    }
};

export const pauseSpeaking = () => {
    if (isSpeechSynthesisSupported) {
        window.speechSynthesis.pause();
    }
};

export const resumeSpeaking = () => {
    if (isSpeechSynthesisSupported) {
        window.speechSynthesis.resume();
    }
};

export const speak = (text, onEnd, lang = 'en-US') => {
    if (!isSpeechSynthesisSupported) {
        console.error('Speech Synthesis not supported');
        return;
    }

    // Cancel any ongoing speech
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;

    // Try to find a voice that matches the language
    const voices = window.speechSynthesis.getVoices();
    const matchingVoice = voices.find(v => v.lang.startsWith(lang.split('-')[0]));
    if (matchingVoice) {
        utterance.voice = matchingVoice;
    }

    utterance.onstart = () => {
        // We can use a global or passed callback if needed, 
        // but for now, we rely on the caller's state management
    };

    if (onEnd) {
        utterance.onend = onEnd;
        utterance.onerror = onEnd; // Handle errors by clearing state too
    }

    window.speechSynthesis.speak(utterance);
};
