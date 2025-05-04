import React, { useState, useEffect } from 'react';
import { Note, NoteContent } from '../services/NoteService';

interface NoteEditorProps {
  note?: Note;
  journalId?: string;
  onSave: (title: string, content: NoteContent, tags: string[]) => void;
  onCancel: () => void;
}

const NoteEditor: React.FC<NoteEditorProps> = ({ note, journalId, onSave, onCancel }) => {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [tags, setTags] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [audioChunks, setAudioChunks] = useState<Blob[]>([]);

  // Initialize editor with note data if editing
  useEffect(() => {
    if (note) {
      setTitle(note.title);
      setContent(note.content.text);
      setTags(note.tags.join(', '));
      setImages(note.content.images || []);
      setAudioUrl(note.content.audio || null);
    }
  }, [note]);

  // Handle image upload
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    
    const file = e.target.files[0];
    const reader = new FileReader();
    
    reader.onloadend = () => {
      const base64String = reader.result as string;
      setImages([...images, base64String]);
    };
    
    reader.readAsDataURL(file);
  };

  // Handle audio recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Try different MIME types based on browser support
      let mimeType = 'audio/webm';
      if (!MediaRecorder.isTypeSupported('audio/webm')) {
        if (MediaRecorder.isTypeSupported('audio/mp4')) {
          mimeType = 'audio/mp4';
        } else {
          mimeType = '';
        }
      }
      
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      
      // Clear previous audio chunks
      setAudioChunks([]);
      
      // Use a local array to collect chunks during this recording session
      const chunks: Blob[] = [];
      
      recorder.ondataavailable = (e) => {
        console.log('Audio data available:', e.data.size);
        if (e.data.size > 0) {
          // Add to local array immediately
          chunks.push(e.data);
        }
      };
      
      recorder.onstop = () => {
        console.log('Recording stopped, chunks collected:', chunks.length);
        if (chunks.length === 0) {
          console.error('No audio chunks recorded');
          alert('No audio was recorded. Please try again.');
          return;
        }
        
        // Update state with all chunks collected
        setAudioChunks(chunks);
        
        const audioBlob = new Blob(chunks, { type: mimeType || 'audio/webm' });
        console.log('Audio blob created, size:', audioBlob.size);
        
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64Audio = reader.result as string;
          console.log('Audio converted to base64, length:', base64Audio.length);
          setAudioUrl(base64Audio);
        };
        
        reader.readAsDataURL(audioBlob);
      };
      
      // Start recording with shorter timeslices for more frequent chunks
      setMediaRecorder(recorder);
      setIsRecording(true);
      recorder.start(250);
      console.log('Recording started with MIME type:', mimeType || 'default');
    } catch (err) {
      console.error('Error accessing microphone:', err);
      alert('Could not access microphone. Please ensure microphone permissions are enabled.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      console.log('Stopping recording...');
      mediaRecorder.stop();
      setIsRecording(false);
      // Stop all tracks on the stream
      mediaRecorder.stream.getTracks().forEach(track => track.stop());
    }
  };

  const deleteAudio = () => {
    setAudioUrl(null);
    setAudioChunks([]);
  };

  const deleteImage = (index: number) => {
    const newImages = [...images];
    newImages.splice(index, 1);
    setImages(newImages);
  };

  const handleSubmit = () => {
    const noteContent: NoteContent = {
      text: content,
      images: images,
      audio: audioUrl || undefined
    };
    
    const tagArray = tags
      .split(',')
      .map(tag => tag.trim())
      .filter(tag => tag);
    
    onSave(title, noteContent, tagArray);
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-xl font-semibold mb-4">
        {note ? 'Edit Note' : 'Create New Note'}
      </h2>
      
      <div className="mb-4">
        <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="title">
          Title
        </label>
        <input
          id="title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
          placeholder="Note title"
        />
      </div>
      
      <div className="mb-4">
        <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="content">
          Content
        </label>
        <textarea
          id="content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline h-64"
          placeholder="Write your note here..."
        />
      </div>
      
      <div className="mb-4">
        <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="tags">
          Tags (comma separated)
        </label>
        <input
          id="tags"
          type="text"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
          placeholder="tag1, tag2, tag3"
        />
      </div>
      
      {/* Image upload section */}
      <div className="mb-4">
        <label className="block text-gray-700 text-sm font-bold mb-2">
          Images
        </label>
        <div className="flex items-center">
          <label className="cursor-pointer bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">
            <span>Add Image</span>
            <input
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
            />
          </label>
        </div>
        
        {images.length > 0 && (
          <div className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-4">
            {images.map((image, index) => (
              <div key={index} className="relative">
                <img
                  src={image}
                  alt={`Uploaded ${index + 1}`}
                  className="w-full h-32 object-cover rounded"
                />
                <button
                  type="button"
                  onClick={() => deleteImage(index)}
                  className="absolute top-1 right-1 bg-red-500 hover:bg-red-700 text-white rounded-full p-1"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
      
      {/* Audio recording section */}
      <div className="mb-6">
        <label className="block text-gray-700 text-sm font-bold mb-2">
          Audio
        </label>
        
        {!audioUrl ? (
          <div className="flex items-center">
            {!isRecording ? (
              <button
                type="button"
                onClick={startRecording}
                className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
              >
                Start Recording
              </button>
            ) : (
              <button
                type="button"
                onClick={stopRecording}
                className="bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded flex items-center"
              >
                <span className="mr-2">Stop Recording</span>
                <span className="flex h-3 w-3">
                  <span className="animate-ping absolute h-3 w-3 rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative rounded-full h-3 w-3 bg-red-500"></span>
                </span>
              </button>
            )}
          </div>
        ) : (
          <div className="flex flex-col">
            <div className="flex items-center mb-2">
              <audio controls src={audioUrl} className="w-full mr-2"></audio>
            </div>
            <div className="flex items-center">
              <button
                type="button"
                onClick={deleteAudio}
                className="bg-red-500 hover:bg-red-700 text-white font-bold py-1 px-2 rounded mr-2"
              >
                Delete Recording
              </button>
              <button
                type="button"
                onClick={startRecording}
                className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-1 px-2 rounded"
              >
                Record Again
              </button>
            </div>
          </div>
        )}
      </div>
      
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onCancel}
          className="bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!title || !content}
          className={`${
            !title || !content
              ? 'bg-blue-300 cursor-not-allowed'
              : 'bg-blue-500 hover:bg-blue-700'
          } text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline`}
        >
          {note ? 'Update Note' : 'Create Note'}
        </button>
      </div>
    </div>
  );
};

export default NoteEditor; 