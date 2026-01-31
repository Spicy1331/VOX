import React, { useState } from 'react';
import './CharacterManager.css';

const CharacterManager = ({ characters, onSave, onDelete, onSelect, selectedId, onClose }) => {
    const [isAdding, setIsAdding] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');

    const handleEdit = (char) => {
        setEditingId(char.id);
        setName(char.name);
        setDescription(char.description);
        setIsAdding(true);
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (name.trim() && description.trim()) {
            onSave({
                id: editingId || Date.now().toString(),
                name,
                description
            });
            resetForm();
        }
    };

    const resetForm = () => {
        setIsAdding(false);
        setEditingId(null);
        setName('');
        setDescription('');
    };

    const wordCount = description.trim() ? description.trim().split(/\s+/).length : 0;
    const isOverLimit = wordCount > 2000;

    return (
        <div className="character-manager-overlay">
            <div className="character-manager-content glass-panel">
                <div className="manager-header">
                    <h2>AI Characters</h2>
                    <button className="close-manager" onClick={onClose}>✕</button>
                </div>

                {!isAdding ? (
                    <div className="character-list-container">
                        <button className="add-character-btn" onClick={() => setIsAdding(true)}>
                            + Create New Character
                        </button>
                        <div className="character-list">
                            {characters.length === 0 ? (
                                <p className="no-chars">No characters created yet.</p>
                            ) : (
                                characters.map(char => (
                                    <div
                                        key={char.id}
                                        className={`character-item ${selectedId === char.id ? 'selected' : ''}`}
                                        onClick={() => onSelect(char.id)}
                                    >
                                        <div className="char-info">
                                            <h3>{char.name}</h3>
                                            <p className="char-preview">{char.description.substring(0, 60)}...</p>
                                        </div>
                                        <div className="char-actions" onClick={e => e.stopPropagation()}>
                                            <button onClick={() => handleEdit(char)}>Edit</button>
                                            <button className="delete-btn" onClick={() => onDelete(char.id)}>Delete</button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                ) : (
                    <form className="character-form" onSubmit={handleSubmit}>
                        <h3>{editingId ? 'Edit Character' : 'New Character'}</h3>
                        <div className="form-group">
                            <label>Name</label>
                            <input
                                type="text"
                                value={name}
                                onChange={e => setName(e.target.value)}
                                placeholder="e.g. Helpful Assistant"
                                required
                            />
                        </div>
                        <div className="form-group">
                            <label>Personality / Behavior Description</label>
                            <textarea
                                value={description}
                                onChange={e => setDescription(e.target.value)}
                                placeholder="Define how the character should act, speak, and behave..."
                                required
                            />
                            <span className={`word-count ${isOverLimit ? 'limit-exceeded' : ''}`}>
                                {wordCount} / 2000 words
                            </span>
                        </div>
                        <div className="form-buttons">
                            <button type="submit" disabled={isOverLimit}>Save Character</button>
                            <button type="button" className="cancel-btn" onClick={resetForm}>Cancel</button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
};

export default CharacterManager;
