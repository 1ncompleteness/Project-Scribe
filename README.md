# Project Scribe - Intelligent Note-Taking and Journaling

[![Project Scribe Logo](front-end/public/project-scribe-icon.svg)](front-end/public/project-scribe-icon.svg)

Project Scribe helps you organize your thoughts, notes, and journal entries intelligently. Built on the foundation of the GenAI Stack, it leverages Large Language Models (LLMs) and a Neo4j graph database to provide features like semantic search, automated tagging, summarization, and question answering over your personal knowledge base.

This application uses Docker for containerization, ensuring a consistent development and deployment environment.

## Features

*   **User Management:** Secure registration and login using JWT.
*   **Notes & Journals:** Create, read, update, and delete notes and journals. Notes can be organized within journals.
*   **Rich Content:** Notes support text, base64 encoded images, and audio (future enhancement).
*   **Tagging:** Assign tags to notes for organization and retrieval.
*   **Journal Templates:** Define structures for consistent journal entries.
*   **Intelligent Search:**
    *   Semantic search using vector embeddings (powered by Sentence Transformers and Neo4j's vector index) to find conceptually similar notes/journals. Cosine similarity is used by the underlying vector index for comparison.
    *   Full-text keyword search (used as a fallback).
    *   Tag-based filtering.
*   **LLM Integration (via Ollama):**
    *   **Ask Your Notes:** Chat with your knowledge base using Retrieval-Augmented Generation (RAG).
    *   **Auto-Tagging:** Generate relevant tags for notes automatically.
    *   **Summarization:** Create concise summaries of your notes.
    *   **Template Generation:** Generate structured note templates based on type/topic.
*   **Database Management:** Includes constraints, indexing (including vector indexes), initialization logic, and a reset function.

## Screenshots

| Registration Page | Dashboard / Note Creation |
|---|---|
| [![Registration Page](images/Registration%20Page.png)](images/Registration%20Page.png) | [![Dashboard Page](images/Dashboard%20Page.png)](images/Dashboard%20Page.png) |

## Technology Stack

*   **Backend:** Python, FastAPI
*   **Frontend:** JavaScript, SvelteKit, Tailwind CSS
*   **Database:** Neo4j (Graph Database with Vector Index support)
*   **LLM Engine:** Ollama (for local model serving)
*   **Embedding Model:** Sentence Transformers (specifically `all-MiniLM-L6-v2` by default)
*   **Containerization:** Docker, Docker Compose
*   **Core Libraries:**
    *   `langchain-neo4j`: Interacting with Neo4j Graph Database.
    *   `langchain-huggingface`: Loading embedding models.
    *   `sse-starlette`: Server-Sent Events for streaming responses.
    *   `passlib[bcrypt]`: Password hashing.
    *   `python-jose[cryptography]`: JWT token handling.
    *   `uvicorn`: ASGI server.
    *   `python-dotenv`: Environment variable management.
    *   `requests`: HTTP requests to Ollama.

## Getting Started

### Prerequisites

1.  **Git:** Ensure Git is installed (`git --version`). Used for version control and cloning the repository.
2.  **Docker:** Install Docker Desktop (MacOS/Windows) or Docker Engine (Linux). This is required to build and run the application containers.
    *   [Install Docker](https://docs.docker.com/get-docker/)
    > [!WARNING]
    > There was a performance issue impacting python applications in Docker Desktop `4.24.x`. Please upgrade to the latest release.
3.  **Ollama (MacOS/Windows Host):** If running on MacOS or Windows, install [Ollama](https://ollama.ai) locally on your host machine. Start the Ollama server (`ollama serve`) before running Docker Compose. Download the required LLM (e.g., `ollama pull llama3`).

### Installation & Setup

1.  **Clone the Repository:**
    ```bash
    git clone https://github.com/b3hr0uz/Project-Scribe
    cd Project-Scribe # Or your repository name
    ```
2.  **Configure Environment:**
    *   Copy the example environment file: `cp env.example .env`
    *   Edit the `.env` file with your specific configurations (Database credentials, Ollama URL if not default, Secret Key, etc.). See the Configuration section below for details.
3.  **Build and Run Containers:**
    *   **Standard:**
        ```bash
        docker compose up --build
        ```
    *   **Linux (with Ollama in Docker):** If you prefer to run Ollama in a container on Linux instead of the host:
        ```bash
        # Ensure OLLAMA_API_URL=http://llm:11434/api/chat in .env
        docker compose --profile linux up --build
        ```
    *   **Linux GPU (with Ollama in Docker):** For GPU acceleration on Linux:
        ```bash
        # Ensure OLLAMA_API_URL=http://llm-gpu:11434/api/chat in .env
        docker compose --profile linux-gpu up --build
        ```
        The `--build` flag is only necessary the first time or when Dockerfiles or build dependencies change.

4.  **Access the Application:**
    *   Frontend UI: http://localhost:8505
    *   Backend API Docs: http://localhost:8585/docs
    *   Neo4j Browser: http://localhost:7474

## Configuration

Create a `.env` file from `env.example` and modify the values as needed.

**Required:**
| Variable Name          | Default value                      | Description                                                             |
|------------------------|------------------------------------|-------------------------------------------------------------------------|
| NEO4J_URI              | neo4j://database:7687              | URL to Neo4j database container                                         |
| NEO4J_USERNAME         | neo4j                              | Username for Neo4j database                                             |
| NEO4J_PASSWORD         | password                           | Password for Neo4j database                                             |
| SECRET_KEY             | your-secret-key                    | **IMPORTANT:** Change this! Secret key for JWT token generation.        |
| OLLAMA_API_URL         | http://host.docker.internal:11434/api/chat | URL to Ollama chat API endpoint (adjust if using Linux profile/different host) |
| OLLAMA_MODEL           | llama3                             | The specific Ollama model tag to use (e.g., llama3, mistral)            |
| EMBEDDING_MODEL_NAME   | all-MiniLM-L6-v2                   | The sentence-transformer model for embeddings                           |
| EMBEDDING_MODEL_CACHE_FOLDER | /embedding_model             | Docker volume path to cache the embedding model                         |

**Optional (Integrations & Tracing):**
| Variable Name          | Default value                      | Description                                                             |
|------------------------|------------------------------------|-------------------------------------------------------------------------|
| AWS_ACCESS_KEY_ID      |                                    | Only needed for potential future AWS integrations                       |
| AWS_SECRET_ACCESS_KEY  |                                    | Only needed for potential future AWS integrations                       |
| AWS_DEFAULT_REGION     |                                    | Only needed for potential future AWS integrations                       |
| OPENAI_API_KEY         |                                    | Only needed for potential future OpenAI integrations                    |
| GOOGLE_API_KEY         |                                    | Only needed for potential future Google GenAI integrations              |
| LANGCHAIN_ENDPOINT     | "https://api.smith.langchain.com"  | URL to Langchain Smith API for tracing                                  |
| LANGCHAIN_TRACING_V2   | false                              | Enable Langchain tracing v2                                             |
| LANGCHAIN_PROJECT      |                                    | Langchain project name for tracing                                      |
| LANGCHAIN_API_KEY      |                                    | Langchain API key for tracing                                           |

### LLM Configuration Details

*   **Model:** Ensure the model specified in `OLLAMA_MODEL` is available in your Ollama instance (use `ollama list` or `ollama pull <model>`).
    *   ***Tested Models:*** *Project Scribe has been primarily tested using `llama3` as the `OLLAMA_MODEL` and the default `all-MiniLM-L6-v2` Sentence Transformer for embeddings (`EMBEDDING_MODEL_NAME`). Other models might work but may require prompt adjustments.*
*   **Ollama URL:**
    *   For Docker Desktop (MacOS/Windows) with Ollama running on the host: `http://host.docker.internal:11434/api/chat` is typically correct.
    *   For Linux with Ollama on the host: You might need to use your host IP address instead of `host.docker.internal`.

## Development

*   **Start Services:** `docker compose up`
*   **Watch Mode (Auto-rebuild):** After starting services, run `docker compose watch` in a separate terminal for automatic container rebuilding on file changes (useful for frontend development).
*   **Rebuild Manually:** `docker compose up --build`
*   **Shutdown:** `docker compose down` (use `docker compose down -v` to also remove volumes like the database and model cache).

## Application Components

Project Scribe consists of the following services managed by Docker Compose:

| Service Name | Main files/folders | Compose name | URLs                 | Description                                                                                                                                  |
|--------------|--------------------|--------------|----------------------|----------------------------------------------------------------------------------------------------------------------------------------------|
| Backend API  | `back-end.py`      | `back-end`   | http://localhost:8585 | FastAPI application providing RESTful endpoints. Handles auth, CRUD, search, and LLM features. |
| Frontend UI  | `front-end/`       | `front-end`  | http://localhost:8505 | SvelteKit web application providing the user interface. Interacts with the Backend API.                                                     |
| Database     | (Neo4j Image)      | `database`   | http://localhost:7474 | Neo4j graph database storing user data, notes, journals, relationships, and vector embeddings. Access via Neo4j Browser.                      |
| LLM Service  | (Ollama Image)     | `llm` / `llm-gpu` | N/A (internal)    | (Optional - Linux profile only) Runs the Ollama LLM service within Docker. Accessed by the Backend API.                                     |

## Based on GenAI Stack

Project Scribe leverages the foundational setup provided by the [GenAI Stack template](https://github.com/docker/genai-stack). This template offered the initial Docker configuration, Neo4j integration, and examples for LLM interaction. Building upon this base, the entire full-stack application, particularly the backend API (`back-end.py`), was bootstrapped specifically for Project Scribe's note-taking and knowledge management features.
