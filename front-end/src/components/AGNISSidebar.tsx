import React, { useState, useRef } from "react";
import AGNISService, { SearchResult } from "../services/AGNISService";

export interface AGNISSidebarProps {
  notes: any[];
  onNoteSelected: (noteId: string) => void;
}

const AGNISSidebar: React.FC<AGNISSidebarProps> = ({ notes, onNoteSelected }) => {
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
  
  return (
    <div className="bg-white rounded-lg shadow-md h-full overflow-hidden flex flex-col">
      <div className="p-4 border-b border-gray-200">
        <h2 className="text-xl font-semibold text-gray-800">AGNIS</h2>
        <p className="text-sm text-gray-600">Artificial Generative Notation & Indexing System</p>
      </div>
      
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
                      <span
                        key={tag}
                        className="text-xs bg-gray-200 text-gray-700 px-1 py-0.5 rounded mr-1 mb-1"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">No results found</p>
          )}
        </div>
      )}
      
      <div className="p-4 border-b border-gray-200">
        <h3 className="text-md font-medium text-gray-700 mb-2">Ask a Question</h3>
        <div className="mb-2">
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask something about your notes..."
            className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
            rows={2}
            onKeyDown={(e) => e.ctrlKey && e.key === "Enter" && handleAskQuestion()}
          />
        </div>
        <div className="mb-4">
          <label className="block text-xs font-medium text-gray-700 mb-1">System Prompt</label>
          <textarea
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-xs border-gray-300 rounded-md"
            rows={2}
          />
        </div>
        <button
          onClick={handleAskQuestion}
          disabled={isAsking || question.trim().length < 3}
          className="w-full inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
        >
          {isAsking ? "Generating Answer..." : "Ask (llama3)"}
        </button>
      </div>
      
      {answer && (
        <div className="p-4 flex-1 overflow-auto" ref={answerRef}>
          <h3 className="text-md font-medium text-gray-700 mb-2">Answer</h3>
          <div className="text-sm text-gray-800 border border-gray-200 rounded p-3 bg-gray-50 whitespace-pre-wrap">
            {answer}
          </div>
        </div>
      )}
    </div>
  );
};

export default AGNISSidebar; 