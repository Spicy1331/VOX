import { FaMicrophone, FaStop } from 'react-icons/fa';
import './MicrophoneButton.css';

export default function MicrophoneButton({ isListening, onClick, disabled }) {
    return (
        <button
            className={`mic-button ${isListening ? 'listening' : ''}`}
            onClick={onClick}
            disabled={disabled}
            aria-label={isListening ? 'Stop listening' : 'Start listening'}
        >
            {isListening ? <FaStop /> : <FaMicrophone />}
            <div className="pulse-ring"></div>
        </button>
    );
}
