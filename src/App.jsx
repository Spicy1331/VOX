import { useState, useEffect } from 'react'
import { SignedIn, SignedOut, SignIn, UserButton, useUser, ClerkProvider } from "@clerk/clerk-react";
import VoiceVisualizer from './components/VoiceVisualizer'
import MicrophoneButton from './components/MicrophoneButton'
import { startListening, stopListening, speak, stopSpeaking, pauseSpeaking, resumeSpeaking } from './services/voiceService'
import { initializeGemini, generateResponse } from './services/aiService'
import CharacterManager from './components/CharacterManager'
import './App.css'

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (!PUBLISHABLE_KEY) {
  throw new Error("Missing Publishable Key")
}

function AppContent() {
  const { user } = useUser();
  const [isListening, setIsListening] = useState(false)
  const [stream, setStream] = useState(null)
  const [transcript, setTranscript] = useState('')
  const [aiResponse, setAiResponse] = useState('')
  const [messages, setMessages] = useState([])
  const [textInput, setTextInput] = useState('')
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [selectedLanguage, setSelectedLanguage] = useState('en-US')
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [installable, setInstallable] = useState(false)
  const [isCallActive, setIsCallActive] = useState(false)
  const [callDuration, setCallDuration] = useState(0)
  const [isSharedView, setIsSharedView] = useState(false)
  const [characters, setCharacters] = useState(() => {
    const saved = localStorage.getItem('ai_characters');
    if (saved) return JSON.parse(saved);
    return [
      { id: 'default-prof', name: 'Professional Assistant', description: 'You are a professional, polite, and efficient AI assistant. You provide clear, concise, and helpful answers.' },
      { id: 'default-creative', name: 'Creative Muse', description: 'You are a highly creative and imaginative companion. You love metaphors, storytelling, and thinking outside the box.' },
      { id: 'default-coder', name: 'Coding Expert', description: 'You are a world-class senior software engineer. You provide clean, efficient, and well-explained code solutions.' }
    ];
  })
  const [selectedCharacterId, setSelectedCharacterId] = useState(localStorage.getItem('selected_character_id') || '')
  const [isCharacterManagerOpen, setIsCharacterManagerOpen] = useState(false)

  const envApiKey = import.meta.env.VITE_GEMINI_API_KEY;
  const [apiKey, setApiKey] = useState(envApiKey || localStorage.getItem('gemini_api_key') || '')
  const [isApiKeySet, setIsApiKeySet] = useState(!!(envApiKey || localStorage.getItem('gemini_api_key')))
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    // Check for shared chat in URL
    const urlParams = new URLSearchParams(window.location.search);
    const sharedData = urlParams.get('share');
    if (sharedData) {
      setIsSharedView(true);
      try {
        const decoded = JSON.parse(atob(sharedData));
        if (Array.isArray(decoded)) {
          setMessages(decoded);
          const lastAi = decoded.filter(m => m.role.includes("model")).pop();
          if (lastAi) setAiResponse(lastAi.parts[0].text);
        }
      } catch (err) {
        console.error("Failed to decode shared chat:", err);
      }
    }
  }, []);

  const shareChat = () => {
    if (messages.length === 0) {
      alert("No messages to share!");
      return;
    }
    try {
      const encoded = btoa(JSON.stringify(messages));
      const shareUrl = `${window.location.origin}${window.location.pathname}?share=${encoded}`;
      navigator.clipboard.writeText(shareUrl);
      alert("Shareable link copied to clipboard!");
    } catch (err) {
      console.error("Sharing failed:", err);
      alert("Failed to create share link.");
    }
  };

  useEffect(() => {
    if (apiKey) {
      initializeGemini(apiKey);
    }
  }, [apiKey]);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setInstallable(true);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [stream]);

  const handleSaveApiKey = (e) => {
    e.preventDefault();
    const key = e.target.elements.apiKey.value;
    if (key) {
      setApiKey(key);
      localStorage.setItem('gemini_api_key', key);
      setIsApiKeySet(true);
      initializeGemini(key);
    }
  };

  const handleSaveCharacter = (char) => {
    const updated = characters.some(c => c.id === char.id)
      ? characters.map(c => c.id === char.id ? char : c)
      : [...characters, char];
    setCharacters(updated);
    localStorage.setItem('ai_characters', JSON.stringify(updated));
    if (!selectedCharacterId) {
      setSelectedCharacterId(char.id);
      localStorage.setItem('selected_character_id', char.id);
    }
  };

  const handleDeleteCharacter = (id) => {
    const updated = characters.filter(c => c.id !== id);
    setCharacters(updated);
    localStorage.setItem('ai_characters', JSON.stringify(updated));
    if (selectedCharacterId === id) {
      const nextId = updated.length > 0 ? updated[0].id : '';
      setSelectedCharacterId(nextId);
      localStorage.setItem('selected_character_id', nextId);
    }
  };

  const handleSelectCharacter = (id) => {
    setSelectedCharacterId(id);
    localStorage.setItem('selected_character_id', id);
  };

  const getBackstory = () => {
    const char = characters.find(c => c.id === selectedCharacterId);
    return char ? char.description : '';
  };

  const handleMicClick = async () => {
    if (isListening) {
      stopListening();
      setIsListening(false);
    } else {
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        setStream(mediaStream);
        setIsListening(true);
        setTranscript('');

        startListening(
          (text) => {
            setTranscript(text);
            handleVoiceInput(text);
          },
          () => setIsListening(false),
          (error) => {
            console.error(error);
            setIsListening(false);
          },
          selectedLanguage
        );
      } catch (err) {
        console.error("Error accessing microphone:", err);
        alert("Microphone access is required.");
      }
    }
  };

  const handleStopSpeaking = () => {
    stopSpeaking();
    setIsSpeaking(false);
    setIsPaused(false);
  };

  const handlePauseToggle = () => {
    if (isPaused) {
      resumeSpeaking();
      setIsPaused(false);
    } else {
      pauseSpeaking();
      setIsPaused(true);
    }
  };

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    setInstallable(false);
  };

  const handleVoiceInput = async (text) => {
    try {
      setIsLoading(true);
      const newUserMessage = { role: "user", parts: [{ text }] };
      const updatedMessages = [...messages, newUserMessage];
      setMessages(updatedMessages);
      setTranscript(text);

      const languageMap = {
        'en-US': 'English', 'hi-IN': 'Hindi', 'es-ES': 'Spanish', 'fr-FR': 'French', 'de-DE': 'German'
      };
      const langName = languageMap[selectedLanguage] || 'English';
      const systemPrompt = `(User is speaking in ${langName}. Respond in ${langName}.) ${text}`;

      const apiHistory = messages.map(m => ({
        role: m.role.includes("model") ? "model" : "user",
        parts: m.parts
      }));

      const characterBackstory = getBackstory();
      const response = await generateResponse(systemPrompt, apiHistory, characterBackstory);
      const newAiMessage = { role: "model", parts: [{ text: response }] };
      setMessages(prev => [...prev.filter(m => m.parts[0].text !== "..."), newAiMessage]);
      setAiResponse(response);

      setIsSpeaking(true);
      speak(response, () => {
        setIsSpeaking(false);
        if (isCallActive) {
          handleMicClick();
        }
      }, selectedLanguage);
    } catch (error) {
      console.error("AI Error:", error);
      let errorMessage = error.message || "Unknown error";
      const errorString = String(error).toLowerCase();
      if (errorString.includes("429") || errorString.includes("quota")) {
        errorMessage = "QUOTA EXCEEDED: Please wait a minute or try a different Gemini API key.";
      }
      const errorMsgObj = { role: "model error", parts: [{ text: "Error: " + errorMessage }] };
      setMessages(prev => [...prev.filter(m => m.parts[0].text !== "..."), errorMsgObj]);
      setAiResponse("Error: " + errorMessage);
      setIsSpeaking(true);
      speak("Sorry, I encountered an error: " + errorMessage, () => setIsSpeaking(false), selectedLanguage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTextInput = async (e) => {
    e.preventDefault();
    if (!textInput.trim()) return;
    const text = textInput;
    setTextInput('');
    setTranscript(text);
    try {
      setIsLoading(true);
      const newUserMessage = { role: "user", parts: [{ text }] };
      setMessages(prev => [...prev, newUserMessage, { role: "model", parts: [{ text: "..." }] }]);
      const apiHistory = messages.map(m => ({
        role: m.role.includes("model") ? "model" : "user",
        parts: m.parts
      }));
      const characterBackstory = getBackstory();
      const response = await generateResponse(text, apiHistory, characterBackstory);
      const newAiMessage = { role: "model", parts: [{ text: response }] };
      setMessages(prev => [...prev.filter(m => m.parts[0].text !== "..."), newAiMessage]);
      setAiResponse(response);
      setIsSpeaking(true);
      speak(response, () => setIsSpeaking(false), selectedLanguage);
    } catch (error) {
      console.error("AI Error:", error);
      let errorMessage = error.message || "Unknown error";
      const errorString = String(error).toLowerCase();
      if (errorString.includes("429") || errorString.includes("quota")) {
        errorMessage = "QUOTA EXCEEDED: Please wait a minute or try a different Gemini API key.";
      }
      const errorMsgObj = { role: "model error", parts: [{ text: "Error: " + errorMessage }] };
      setMessages(prev => [...prev.filter(m => m.parts[0].text !== "..."), errorMsgObj]);
      setAiResponse("Error: " + errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEndCall = () => {
    setIsCallActive(false);
    stopListening();
    stopSpeaking();
    setIsListening(false);
    setIsSpeaking(false);
    setCallDuration(0);
  };

  const handleStartCall = async () => {
    try {
      setIsCallActive(true);
      setCallDuration(0);
      const char = characters.find(c => c.id === selectedCharacterId);
      const charName = char ? char.name : "your AI assistant";
      const greeting = `Hello! I'm ${charName}. I'm on the line and ready to help. How can I assist you today?`;
      const newUserMessage = { role: "model", parts: [{ text: greeting }] };
      setMessages(prev => [...prev, newUserMessage]);
      setAiResponse(greeting);
      setIsSpeaking(true);
      speak(greeting, () => {
        setIsSpeaking(false);
        handleMicClick();
      }, selectedLanguage);
    } catch (err) {
      console.error("Start Call Error:", err);
      setIsCallActive(false);
    }
  };

  useEffect(() => {
    let interval;
    if (isCallActive) {
      interval = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isCallActive]);

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (isSharedView) {
    return (
      <div className="app-container shared-view glass-panel">
        <header className="app-header">
          <h1>Shared AI Conversation</h1>
          <button className="new-chat-button" onClick={() => window.location.href = window.location.pathname}>
            Start New Chat
          </button>
        </header>
        <main className="main-content">
          <div className="conversation-display">
            <div className="messages-container">
              {messages.map((msg, index) => (
                <div key={index} className={`message-bubble ${msg.role}`}>
                  {msg.parts[0].text}
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (!isApiKeySet) {
    return (
      <div className="app-container glass-panel">
        <h2>Setup Gemini API</h2>
        <p>Please enter your Gemini API Key to continue.</p>
        <form onSubmit={handleSaveApiKey} className="api-key-form">
          <input type="password" name="apiKey" placeholder="Enter API Key" required />
          <button type="submit">Save Key</button>
        </form>
        <p className="small-text">Key is saved locally in your browser.</p>
      </div>
    )
  }

  return (
    <div className="app-container glass-panel">
      <header className="app-header">
        <div className="header-top">
          <div className="title-group">
            <h1>Vox <span className="version-badge">v1.3.2</span></h1>
            {selectedCharacterId && (
              <div className="active-persona-tag">
                🎭 {characters.find(c => c.id === selectedCharacterId)?.name || 'Custom Persona'}
              </div>
            )}
          </div>
          <div className="header-actions">
            {installable && (
              <button className="install-button" onClick={handleInstallClick}>Install App</button>
            )}
            <button className="share-button" onClick={shareChat} title="Share Transcript">📤 Share</button>
            <button className={`character-btn ${selectedCharacterId ? 'active' : ''}`} onClick={() => setIsCharacterManagerOpen(true)} title="AI Characters">🎭 Characters</button>
            <button className="call-button" onClick={handleStartCall}>📞 Call</button>
            <select
              className="language-selector"
              value={selectedLanguage}
              onChange={(e) => setSelectedLanguage(e.target.value)}
            >
              <option value="en-US">English</option>
              <option value="hi-IN">Hindi</option>
              <option value="es-ES">Spanish</option>
              <option value="fr-FR">French</option>
              <option value="de-DE">German</option>
            </select>
            <UserButton />
          </div>
        </div>
      </header>
      <main className="main-content">
        <div className="visualizer-container">
          <VoiceVisualizer stream={stream} isListening={isListening} />
        </div>
        <div className="conversation-display">
          <div className="messages-container">
            {messages.length === 0 && !isLoading && (
              <p className="welcome-text">Start by speaking or typing a message!</p>
            )}
            {messages.map((msg, index) => {
              const isModel = msg.role.includes("model");
              const char = isModel ? characters.find(c => c.id === selectedCharacterId) : null;
              const displayName = isModel ? (char ? char.name : "AI") : "You";

              return (
                <div key={index} className={`message-bubble ${msg.role}`}>
                  <small className="message-label">{displayName}</small>
                  <div className="message-text">{msg.parts[0].text}</div>
                </div>
              );
            })}
            {isLoading && <p className="loading-text">Thinking...</p>}
          </div>
        </div>
        <div className="controls">
          <form className="text-input-form" onSubmit={handleTextInput}>
            <input
              type="text"
              placeholder="Type a message..."
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              disabled={isLoading}
            />
            <button type="submit" disabled={isLoading || !textInput.trim()}>Send</button>
          </form>
          <MicrophoneButton
            isListening={isListening}
            onClick={handleMicClick}
            disabled={isSpeaking || isLoading}
          />
          {isSpeaking && (
            <div className="speech-controls">
              <button className="speech-button pause-button" onClick={handlePauseToggle}>
                {isPaused ? 'Resume' : 'Pause'}
              </button>
              <button className="speech-button stop-button" onClick={handleStopSpeaking}>Stop</button>
            </div>
          )}
        </div>
      </main>
      <footer></footer>
      {isCallActive && (
        <div className="call-overlay">
          <div className="call-content glass-panel">
            <div className="call-header">
              <div className="ai-avatar pulsing">
                {characters.find(c => c.id === selectedCharacterId)?.name?.charAt(0) || 'AI'}
              </div>
              <h2>{characters.find(c => c.id === selectedCharacterId)?.name || 'AI Assistant'}</h2>
              <p className="call-timer">{formatDuration(callDuration)}</p>
            </div>
            <div className="call-status">
              {isLoading ? (
                <div className="status-indicator thinking">Thinking...</div>
              ) : isListening ? (
                <div className="status-indicator listening">Listening...</div>
              ) : isSpeaking ? (
                <div className="status-indicator speaking">Speaking...</div>
              ) : (
                <div className="status-indicator idle">Connected</div>
              )}
            </div>
            <div className="call-transcript-mini">
              {transcript && <p className="mini-user-text">"{transcript}"</p>}
            </div>
            <div className="call-actions">
              <button className="end-call-button" onClick={handleEndCall}>✕</button>
            </div>
          </div>
        </div>
      )}
      {isCharacterManagerOpen && (
        <CharacterManager
          characters={characters}
          onSave={handleSaveCharacter}
          onDelete={handleDeleteCharacter}
          onSelect={handleSelectCharacter}
          selectedId={selectedCharacterId}
          onClose={() => setIsCharacterManagerOpen(false)}
        />
      )}
    </div>
  )
}

function App() {
  return (
    <ClerkProvider publishableKey={PUBLISHABLE_KEY} afterSignOutUrl="/">
      <SignedOut>
        <div className="app-container glass-panel login-container-wrapper">
          <h1>Vox</h1>
          <SignIn />
        </div>
      </SignedOut>
      <SignedIn>
        <AppContent />
      </SignedIn>
    </ClerkProvider>
  )
}

export default App
