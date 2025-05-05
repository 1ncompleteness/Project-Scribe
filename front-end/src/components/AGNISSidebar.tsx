import React, { useState, useRef } from "react";
import AGNISService, { SearchResult, SummaryResponse, TemplateResponse } from "../services/AGNISService";

export interface AGNISSidebarProps {
  notes: any[];
  onNoteSelected: (noteId: string) => void;
  onCreateNote?: (title: string, content: string) => void;
}

const AGNISSidebar: React.FC<AGNISSidebarProps> = ({ notes, onNoteSelected, onCreateNote }) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchType, setSearchType] = useState<"text" | "semantic" | "tags">("text");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);
  
  // Question answering state
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [isAsking, setIsAsking] = useState(false);
  const [systemPrompt, setSystemPrompt] = useState(
    "You are a helpful assistant that answers questions based on the provided context."
  );
  
  // Summarization state
  const [selectedNoteForSummary, setSelectedNoteForSummary] = useState<string | null>(null);
  const [summaries, setSummaries] = useState<Record<string, SummaryResponse>>({});
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [activeTab, setActiveTab] = useState<'search' | 'ask' | 'summarize' | 'template'>('search');
  
  // Template suggestion state
  const [noteType, setNoteType] = useState("");
  const [noteDetails, setNoteDetails] = useState("");
  const [template, setTemplate] = useState<TemplateResponse | null>(null);
  const [isGeneratingTemplate, setIsGeneratingTemplate] = useState(false);
  const [commonNoteTypes, setCommonNoteTypes] = useState([
    'Meeting Notes', 'Project Plan', 'Research Notes', 'Journal Entry',
    'Book Notes', 'Lecture Notes', 'To-Do List', 'Decision Log',
    'Learning Notes', 'Creative Writing', 'Recipe', 'Travel Itinerary'
  ]);
  
  const answerRef = useRef<HTMLDivElement>(null);
  
  // Search function
  const handleSearch = async () => {
    if (searchQuery.trim().length < 2) return;
    
    setIsSearching(true);
    setShowSearchResults(true);
    
    try {
      let results: SearchResult[] = [];
      
      if (searchType === "text") {
        const response = await AGNISService.searchFullText(searchQuery);
        results = response.data.results;
      } else if (searchType === "semantic") {
        const response = await AGNISService.searchSemantic(searchQuery);
        results = response.data.results;
      } else if (searchType === "tags") {
        const response = await AGNISService.searchByTags(searchQuery);
        results = response.data.results;
      }
      
      setSearchResults(results);
    } catch (error) {
      console.error("Search error:", error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };
  
  // Question answering function
  const handleAskQuestion = async () => {
    if (question.trim().length < 3) return;
    
    setIsAsking(true);
    setAnswer("");
    console.log("Asking question:", question, "System prompt:", systemPrompt);
    
    try {
      const stream = await AGNISService.askQuestion(question, systemPrompt);
      console.log("Stream received from service");
      const reader = stream.getReader();
      const decoder = new TextDecoder();
      
      while (true) {
        const { done, value } = await reader.read();
        console.log("Reader read:", { done, value });
        
        if (done) {
          console.log("Stream finished");
          break;
        }
        
        const textChunk = decoder.decode(value, { stream: true });
        console.log("Decoded chunk:", textChunk);
        
        const lines = textChunk.split("\n").filter(line => line.trim() !== "");
        console.log("Parsed lines:", lines);
        
        for (const line of lines) {
          console.log("Processing line:", line);
          if (line.startsWith("data: ")) {
            try {
              const jsonData = line.substring(6);
              console.log("Attempting to parse JSON:", jsonData);
              const data = JSON.parse(jsonData);
              console.log("Parsed data:", data);
              
              if (data.type === "answer" && data.content) {
                console.log("Updating answer with content:", data.content);
                setAnswer(prev => prev + data.content);
              } else {
                console.log("Received data object, but not type 'answer' or no content:", data);
              }
              
              if (answerRef.current) {
                answerRef.current.scrollTop = answerRef.current.scrollHeight;
              }
            } catch (e) {
              console.error("Error parsing SSE JSON:", e, "Raw line:", line);
            }
          } else {
             console.log("Line does not start with 'data: '");
          }
        }
      }
    } catch (error) {
      console.error("Question answering error:", error);
      setAnswer("Sorry, there was an error processing your question. Please try again.");
    } finally {
      console.log("Finished asking question flow.");
      setIsAsking(false);
    }
  };
  
  // Summarization function
  const handleSummarizeNote = async (noteId: string) => {
    if (isSummarizing) return;
    
    setIsSummarizing(true);
    setSelectedNoteForSummary(noteId);
    
    try {
      const response = await AGNISService.summarizeNote(noteId);
      const summary = response.data;
      
      setSummaries(prev => ({
        ...prev,
        [noteId]: summary
      }));
    } catch (error) {
      console.error("Summarization error:", error);
      alert("Failed to generate summary. Please try again.");
    } finally {
      setIsSummarizing(false);
    }
  };
  
  // Template generation function
  const handleGenerateTemplate = async () => {
    if (!noteType.trim()) {
      alert('Please enter a note type');
      return;
    }
    
    setIsGeneratingTemplate(true);
    setTemplate(null);
    
    try {
      const response = await AGNISService.generateTemplate(noteType, noteDetails);
      setTemplate(response.data);
    } catch (error) {
      console.error("Template generation error:", error);
      alert("Failed to generate template. Please try again.");
    } finally {
      setIsGeneratingTemplate(false);
    }
  };
  
  // Function to handle template selection and create new note
  const handleUseTemplate = () => {
    if (!template || !onCreateNote) return;
    
    onCreateNote(template.title_suggestion, template.template);
    
    // Reset form after creating
    setNoteType("");
    setNoteDetails("");
    setTemplate(null);
  };
  
  const handleQuickNoteType = (type: string) => {
    setNoteType(type);
    // Automatically trigger template generation when selecting a common type
    setTimeout(() => {
      handleGenerateTemplate();
    }, 100);
  };

  return (
    <div className="bg-white rounded-lg shadow-md h-full overflow-hidden flex flex-col">
      <div className="p-4 border-b border-gray-200">
        <h2 className="text-xl font-semibold text-gray-800">AGNIS</h2>
        <p className="text-sm text-gray-600">Artificial Generative Notation & Indexing System</p>
      </div>
      
      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        <button
          className={`flex-1 py-2 px-4 text-sm font-medium ${
            activeTab === 'search' 
              ? 'text-blue-600 border-b-2 border-blue-500' 
              : 'text-gray-500 hover:text-gray-700'
          }`}
          onClick={() => setActiveTab('search')}
        >
          Search
        </button>
        <button
          className={`flex-1 py-2 px-4 text-sm font-medium ${
            activeTab === 'ask' 
              ? 'text-blue-600 border-b-2 border-blue-500' 
              : 'text-gray-500 hover:text-gray-700'
          }`}
          onClick={() => setActiveTab('ask')}
        >
          Ask
        </button>
        <button
          className={`flex-1 py-2 px-4 text-sm font-medium ${
            activeTab === 'template' 
              ? 'text-blue-600 border-b-2 border-blue-500' 
              : 'text-gray-500 hover:text-gray-700'
          }`}
          onClick={() => setActiveTab('template')}
        >
          Template
        </button>
        <button
          className={`flex-1 py-2 px-4 text-sm font-medium ${
            activeTab === 'summarize' 
              ? 'text-blue-600 border-b-2 border-blue-500' 
              : 'text-gray-500 hover:text-gray-700'
          }`}
          onClick={() => setActiveTab('summarize')}
        >
          Summarize
        </button>
      </div>
      
      {/* Search Panel */}
      {activeTab === 'search' && (
        <>
          <div className="p-4 border-b border-gray-200">
            <div className="mb-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search notes..."
                  className="flex-1 shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                />
                <button
                  onClick={handleSearch}
                  disabled={isSearching}
                  className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  {isSearching ? "..." : "Search"}
                </button>
              </div>
            </div>
            
            <div className="flex space-x-2 mb-1">
              <label className="inline-flex items-center">
                <input
                  type="radio"
                  className="form-radio"
                  name="searchType"
                  checked={searchType === "text"}
                  onChange={() => setSearchType("text")}
                />
                <span className="ml-1 text-sm text-gray-700">Text</span>
              </label>
              <label className="inline-flex items-center">
                <input
                  type="radio"
                  className="form-radio"
                  name="searchType"
                  checked={searchType === "semantic"}
                  onChange={() => setSearchType("semantic")}
                />
                <span className="ml-1 text-sm text-gray-700">Semantic</span>
              </label>
              <label className="inline-flex items-center">
                <input
                  type="radio"
                  className="form-radio"
                  name="searchType"
                  checked={searchType === "tags"}
                  onChange={() => setSearchType("tags")}
                />
                <span className="ml-1 text-sm text-gray-700">Tags</span>
              </label>
            </div>
          </div>
          
          {showSearchResults && (
            <div className="p-4 border-b border-gray-200 flex-1 overflow-auto">
              <h3 className="text-md font-medium text-gray-700 mb-2">Search Results</h3>
              {isSearching ? (
                <p className="text-sm text-gray-500">Searching...</p>
              ) : searchResults.length > 0 ? (
                <div className="space-y-3">
                  {searchResults.map((result) => (
                    <div 
                      key={result.id} 
                      className="border border-gray-200 rounded p-2 cursor-pointer hover:bg-blue-50"
                      onClick={() => onNoteSelected(result.id)}
                    >
                      <h4 className="font-medium text-blue-600">{result.title}</h4>
                      <p className="text-sm text-gray-600 line-clamp-2">{result.excerpt}</p>
                      <div className="flex flex-wrap mt-1">
                        {result.tags && result.tags.map((tag) => (
                          <span key={tag} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 mr-1 mb-1">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500">No results found.</p>
              )}
            </div>
          )}
        </>
      )}
      
      {/* Ask AGNIS Panel */}
      {activeTab === 'ask' && (
        <div className="p-4 flex-1 flex flex-col overflow-hidden">
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Ask a Question</label>
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="What would you like to know?"
              className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
              rows={3}
            />
            
            <div className="mt-2">
              <label className="block text-xs font-medium text-gray-700 mb-1">
                System Prompt <span className="text-xs text-gray-500">(Advanced)</span>
              </label>
              <textarea
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                placeholder="Custom instructions for the AI"
                className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-xs border-gray-300 rounded-md"
                rows={2}
              />
              <p className="text-xs text-gray-500 mt-1">
                Customize how AGNIS responds to your questions
              </p>
            </div>
            
            <button
              onClick={handleAskQuestion}
              disabled={isAsking || question.trim().length < 3}
              className="mt-2 w-full inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              {isAsking ? "Thinking..." : "Ask AGNIS"}
            </button>
          </div>
          
          {(answer || isAsking) && (
            <div className="flex-1 overflow-auto border border-gray-200 rounded-md p-3">
              <h3 className="text-md font-medium text-gray-700 mb-2">Answer</h3>
              <div 
                ref={answerRef}
                className="prose max-w-none text-sm"
              >
                {isAsking && !answer && <p className="text-gray-500 italic">Thinking...</p>}
                {answer ? <p>{answer}</p> : null}
              </div>
            </div>
          )}
        </div>
      )}
      
      {/* Template Suggestion Panel */}
      {activeTab === 'template' && (
        <div className="p-4 flex-1 overflow-auto">
          <h3 className="text-md font-medium text-gray-700 mb-2">Generate Note Templates</h3>
          
          <p className="text-sm text-gray-600 mb-4">
            Get AI-powered structured templates for your notes.
          </p>
          
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              What type of note do you want to create?
            </label>
            <input
              type="text"
              value={noteType}
              onChange={(e) => setNoteType(e.target.value)}
              placeholder="E.g., Meeting Notes, Project Plan, Research Notes..."
              className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
            />
          </div>
          
          <div className="mb-4">
            <p className="text-xs font-medium text-gray-700 mb-2">Common Note Types:</p>
            <div className="flex flex-wrap gap-2">
              {commonNoteTypes.map(type => (
                <button
                  key={type}
                  onClick={() => handleQuickNoteType(type)}
                  className="px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded text-xs"
                >
                  {type}
                </button>
              ))}
            </div>
          </div>
          
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Additional Details (Optional)
            </label>
            <textarea
              value={noteDetails}
              onChange={(e) => setNoteDetails(e.target.value)}
              placeholder="Any specific requirements or details for your template..."
              className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
              rows={2}
            />
          </div>
          
          <button
            onClick={handleGenerateTemplate}
            disabled={isGeneratingTemplate || !noteType.trim()}
            className="w-full inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            {isGeneratingTemplate ? "Generating..." : "Generate Template"}
          </button>
          
          {template && (
            <div className="mt-4">
              <div className="border border-green-200 bg-green-50 rounded-md p-3">
                <div className="flex justify-between items-center mb-2">
                  <h4 className="font-medium text-green-900">
                    Template: {template.title_suggestion}
                  </h4>
                  {onCreateNote && (
                    <button
                      onClick={handleUseTemplate}
                      className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700"
                    >
                      Use Template
                    </button>
                  )}
                </div>
                <div className="bg-white p-3 rounded border border-gray-200 text-sm font-mono whitespace-pre-wrap max-h-96 overflow-y-auto">
                  {template.template}
                </div>
              </div>
            </div>
          )}
          
          {isGeneratingTemplate && (
            <div className="mt-4 text-center">
              <p className="text-sm text-gray-500">Generating your template...</p>
              <div className="mt-2 flex justify-center">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
              </div>
            </div>
          )}
        </div>
      )}
      
      {/* Summarize Panel */}
      {activeTab === 'summarize' && (
        <div className="p-4 flex-1 overflow-auto">
          <h3 className="text-md font-medium text-gray-700 mb-2">Generate Note Summaries</h3>
          
          <p className="text-sm text-gray-600 mb-4">
            Select a note to generate a concise summary using AGNIS.
          </p>
          
          <div className="space-y-3">
            {notes.length > 0 ? notes.map((note) => (
              <div key={note.id} className="border border-gray-200 rounded p-3">
                <div className="flex justify-between items-start">
                  <h4 
                    className="font-medium text-blue-600 cursor-pointer hover:underline" 
                    onClick={() => onNoteSelected(note.id)}
                  >
                    {note.title}
                  </h4>
                  
                  <button
                    onClick={() => handleSummarizeNote(note.id)}
                    disabled={isSummarizing && selectedNoteForSummary === note.id}
                    className={`px-2 py-1 text-xs rounded ${
                      isSummarizing && selectedNoteForSummary === note.id
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        : 'bg-blue-600 text-white hover:bg-blue-700'
                    }`}
                  >
                    {isSummarizing && selectedNoteForSummary === note.id
                      ? 'Summarizing...'
                      : summaries[note.id] ? 'Refresh' : 'Summarize'
                    }
                  </button>
                </div>
                
                {summaries[note.id] && (
                  <div className="mt-2">
                    <p className="text-xs font-medium text-gray-500">SUMMARY:</p>
                    <p className="text-sm text-gray-700 mt-1 bg-gray-50 p-2 rounded">
                      {summaries[note.id].summary}
                    </p>
                  </div>
                )}
              </div>
            )) : (
              <p className="text-sm text-gray-500">No notes available to summarize.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AGNISSidebar; 