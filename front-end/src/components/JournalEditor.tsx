import React, { useState, useEffect } from 'react';
import { Journal } from '../services/NoteService';

interface JournalEditorProps {
  journal?: Journal;
  onSave: (title: string, description: string, template?: Record<string, string>) => void;
  onCancel: () => void;
}

const JournalEditor: React.FC<JournalEditorProps> = ({ journal, onSave, onCancel }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [templateActive, setTemplateActive] = useState(false);
  const [templateFields, setTemplateFields] = useState<{name: string, type: string}[]>([]);
  const [newFieldName, setNewFieldName] = useState('');
  const [newFieldType, setNewFieldType] = useState('text');

  // Initialize editor with journal data if editing
  useEffect(() => {
    if (journal) {
      setTitle(journal.title);
      setDescription(journal.description || '');
      
      if (journal.template && Object.keys(journal.template).length > 0) {
        setTemplateActive(true);
        const fields = Object.entries(journal.template).map(([name, type]) => ({
          name,
          type: type as string
        }));
        setTemplateFields(fields);
      }
    }
  }, [journal]);

  const addTemplateField = () => {
    if (!newFieldName.trim()) return;
    
    // Check for duplicate field names
    if (templateFields.some(field => field.name === newFieldName)) {
      alert('Field name already exists');
      return;
    }
    
    setTemplateFields([...templateFields, { name: newFieldName, type: newFieldType }]);
    setNewFieldName('');
    setNewFieldType('text');
  };

  const removeTemplateField = (index: number) => {
    const newFields = [...templateFields];
    newFields.splice(index, 1);
    setTemplateFields(newFields);
  };

  const handleSubmit = () => {
    let template: Record<string, string> | undefined;
    
    if (templateActive && templateFields.length > 0) {
      template = {};
      templateFields.forEach(field => {
        template![field.name] = field.type;
      });
    }
    
    onSave(title, description, template);
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-xl font-semibold mb-4">
        {journal ? 'Edit Journal' : 'Create New Journal'}
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
          placeholder="Journal title"
        />
      </div>
      
      <div className="mb-4">
        <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="description">
          Description
        </label>
        <textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline h-24"
          placeholder="Journal description (optional)"
        />
      </div>
      
      {/* Template section */}
      <div className="mb-6">
        <div className="flex items-center mb-4">
          <input
            type="checkbox"
            id="useTemplate"
            checked={templateActive}
            onChange={() => setTemplateActive(!templateActive)}
            className="mr-2"
          />
          <label htmlFor="useTemplate" className="text-gray-700 font-bold">
            Use Note Template
          </label>
        </div>
        
        {templateActive && (
          <div className="pl-6 border-l-2 border-blue-200">
            <p className="text-sm text-gray-600 mb-3">
              Templates define custom fields for notes in this journal.
            </p>
            
            <div className="mb-4">
              <h3 className="text-gray-700 text-sm font-bold mb-2">Template Fields</h3>
              
              {templateFields.length === 0 ? (
                <p className="text-sm text-gray-500 italic">No fields defined yet.</p>
              ) : (
                <ul className="border rounded divide-y">
                  {templateFields.map((field, index) => (
                    <li key={index} className="p-2 flex justify-between items-center">
                      <div>
                        <span className="font-medium">{field.name}</span>
                        <span className="ml-2 text-xs text-gray-500">{field.type}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeTemplateField(index)}
                        className="text-red-500 hover:text-red-700"
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            
            <div className="flex flex-col md:flex-row md:items-end space-y-2 md:space-y-0 md:space-x-2 mb-4">
              <div className="flex-1">
                <label className="block text-gray-700 text-xs font-bold mb-1" htmlFor="fieldName">
                  Field Name
                </label>
                <input
                  id="fieldName"
                  type="text"
                  value={newFieldName}
                  onChange={(e) => setNewFieldName(e.target.value)}
                  className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                  placeholder="e.g. Mood, Weather, Location"
                />
              </div>
              
              <div className="w-full md:w-1/3">
                <label className="block text-gray-700 text-xs font-bold mb-1" htmlFor="fieldType">
                  Field Type
                </label>
                <select
                  id="fieldType"
                  value={newFieldType}
                  onChange={(e) => setNewFieldType(e.target.value)}
                  className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                >
                  <option value="text">Text</option>
                  <option value="number">Number</option>
                  <option value="date">Date</option>
                  <option value="select">Select</option>
                </select>
              </div>
              
              <button
                type="button"
                onClick={addTemplateField}
                disabled={!newFieldName.trim()}
                className={`${
                  !newFieldName.trim() ? 'bg-blue-300 cursor-not-allowed' : 'bg-blue-500 hover:bg-blue-700'
                } text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline`}
              >
                Add Field
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
          disabled={!title}
          className={`${
            !title ? 'bg-blue-300 cursor-not-allowed' : 'bg-blue-500 hover:bg-blue-700'
          } text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline`}
        >
          {journal ? 'Update Journal' : 'Create Journal'}
        </button>
      </div>
    </div>
  );
};

export default JournalEditor; 