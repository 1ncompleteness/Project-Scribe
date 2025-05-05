import os
from fastapi import FastAPI, HTTPException, Depends, status, Request, File, UploadFile, Form
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from contextlib import asynccontextmanager
from pydantic import BaseModel, field_validator, Field
from passlib.context import CryptContext
from jose import JWTError, jwt
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any, Union
from dotenv import load_dotenv
from langchain_neo4j import Neo4jGraph
from fastapi.middleware.cors import CORSMiddleware
import uuid
import base64
from datetime import datetime
import json
import numpy as np
import re
from sse_starlette.sse import EventSourceResponse
from langchain_huggingface import HuggingFaceEmbeddings
from neo4j import GraphDatabase
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request as StarletteRequest
import asyncio
import logging
import requests

# Instead, define the create_vector_index function directly here
def create_vector_index(graph: Neo4jGraph) -> None:
    # Remove old/unused indices
    # index_query = "CREATE VECTOR INDEX stackoverflow IF NOT EXISTS FOR (m:Question) ON m.embedding"
    # try:
    #     driver.query(index_query)
    # except Exception as e:
    #     print(f"Error creating index stackoverflow (potentially harmless if already exists): {e}")
    # index_query = (
    #     "CREATE VECTOR INDEX top_answers IF NOT EXISTS FOR (m:Answer) ON m.embedding"
    # )
    # try:
    #     driver.query(index_query)
    # except Exception as e:
    #     print(f"Error creating index top_answers (potentially harmless if already exists): {e}")
    
    # Additional index for notes
    index_query_notes = "CREATE VECTOR INDEX notes_vector IF NOT EXISTS FOR (n:Note) ON (n.embedding)"
    try:
        print(f"Attempting to execute query: {index_query_notes}")
        graph.query(index_query_notes)
        print("Successfully created or verified 'notes_vector' index.")
    except Exception as e:
        print(f"ERROR creating 'notes_vector' index: {e}")

    # Index for journals
    index_query_journals = "CREATE VECTOR INDEX journals_vector IF NOT EXISTS FOR (j:Journal) ON (j.embedding)"
    try:
        print(f"Attempting to execute query: {index_query_journals}")
        graph.query(index_query_journals)
        print("Successfully created or verified 'journals_vector' index.")
    except Exception as e:
        print(f"ERROR creating 'journals_vector' index: {e}")

# Add a simple logger class to avoid utils dependency
class BaseLogger:
    def __init__(self) -> None:
        self.info = print

def format_docs(docs):
    return "\n\n".join(doc.page_content for doc in docs)

# Load environment variables
load_dotenv(".env")

# Neo4j connection
url = os.getenv("NEO4J_URI")
username = os.getenv("NEO4J_USERNAME")
password = os.getenv("NEO4J_PASSWORD")

# JWT settings
SECRET_KEY = os.getenv("SECRET_KEY", "your-secret-key")  # Change in production
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Connect to Neo4j
neo4j_graph = Neo4jGraph(url=url, username=username, password=password)

# Create constraints
def create_user_constraints():
    # Create uniqueness constraint on username and email
    neo4j_graph.query("""
    CREATE CONSTRAINT user_username_unique IF NOT EXISTS 
    FOR (u:User) REQUIRE u.username IS UNIQUE
    """)
    
    neo4j_graph.query("""
    CREATE CONSTRAINT user_email_unique IF NOT EXISTS 
    FOR (u:User) REQUIRE u.email IS UNIQUE
    """)

def create_note_constraints():
    # Create uniqueness constraint on note id
    neo4j_graph.query("""
    CREATE CONSTRAINT note_id_unique IF NOT EXISTS
    FOR (n:Note) REQUIRE n.id IS UNIQUE
    """)

def create_journal_constraints():
    # Create uniqueness constraint on journal id
    neo4j_graph.query("""
    CREATE CONSTRAINT journal_id_unique IF NOT EXISTS
    FOR (j:Journal) REQUIRE j.id IS UNIQUE
    """)

# First, let's add a function to check if properties exist in Neo4j
def ensure_property_exists(property_name):
    # Check if property exists, create it if it doesn't
    neo4j_graph.query(
        """
        CREATE (temp:PropertyCheck {
          name: 'temp', 
          %s: ''
        })
        """ % property_name
    )
    
    # Clean up the temporary node
    neo4j_graph.query(
        """
        MATCH (temp:PropertyCheck {name: 'temp'})
        DELETE temp
        """
    )
    print(f"Ensured property {property_name} exists in the database schema")

# Add a function to ensure relationships exist in Neo4j
def ensure_relationship_exists(relationship_type):
    # Create a temporary relationship to ensure it exists in the schema
    neo4j_graph.query(
        f"""
        CREATE (a:RelationshipCheck {{name: 'source'}})
        CREATE (b:RelationshipCheck {{name: 'target'}})
        CREATE (a)-[:{relationship_type}]->(b)
        """
    )
    
    # Clean up temporary nodes and relationships
    neo4j_graph.query(
        """
        MATCH (n:RelationshipCheck)
        DETACH DELETE n
        """
    )
    print(f"Ensured relationship {relationship_type} exists in the database schema")

# Function to initialize the database with sample data
def initialize_database():
    print("Checking if database needs initialization...")

    # Check if there's any content in the database
    result = neo4j_graph.query("""
    MATCH (n) RETURN count(n) as node_count
    """)
    
    node_count = result[0]['node_count']
    if node_count > 0:
        print(f"Database already has {node_count} nodes, skipping initialization")
        return

    print("Database is empty, initializing with sample data...")

    # Create admin user
    admin_username = "admin"
    admin_email = "admin@example.com"
    admin_password = get_password_hash("adminpassword")
    
    neo4j_graph.query(
        """
        CREATE (u:User {
            username: $username,
            email: $email,
            full_name: 'Admin User',
            hashed_password: $hashed_password,
            created_at: datetime(),
            disabled: false
        })
        RETURN u
        """,
        {
            "username": admin_username,
            "email": admin_email,
            "hashed_password": admin_password
        }
    )
    
    print("Created admin user")

    # Create a sample journal
    journal_id = str(uuid.uuid4())
    current_time = datetime.utcnow().isoformat()
    
    # Create a sample template
    template = {
        "sections": [
            {"name": "Summary", "type": "text", "required": True},
            {"name": "Details", "type": "text", "required": False},
            {"name": "Action Items", "type": "checklist", "required": False}
        ]
    }
    
    # Convert template to JSON string
    template_json = json.dumps(template)
    
    neo4j_graph.query(
        """
        MATCH (u:User {username: $username})
        CREATE (j:Journal {
            id: $id,
            title: 'Sample Journal',
            description: 'This is a sample journal created during initialization',
            created_at: $timestamp,
            updated_at: $timestamp,
            note_count: 0,
            template: $template
        })
        CREATE (j)-[:OWNED_BY]->(u)
        RETURN j
        """,
        {
            "id": journal_id,
            "username": admin_username,
            "timestamp": current_time,
            "template": template_json
        }
    )
    
    print("Created sample journal")
    
    # Generate embedding for the sample journal
    journal_text = "Sample Journal This is a sample journal created during initialization"
    journal_embedding = embedding_model.embed_query(journal_text)
    
    # Store the embedding
    neo4j_graph.query(
        """
        MATCH (j:Journal {id: $journal_id})
        SET j.embedding = $embedding
        """,
        {"journal_id": journal_id, "embedding": journal_embedding}
    )
    
    print("Generated embedding for sample journal")

    # Create a sample note
    note_id = str(uuid.uuid4())
    
    # Convert content to JSON string
    note_content = {
        "text": "This is a sample note to help you get started.", 
        "images": [], 
        "audio": None
    }
    content_json = json.dumps(note_content)
    
    neo4j_graph.query(
        """
        MATCH (u:User {username: $username})
        CREATE (n:Note {
            id: $id,
            title: 'Welcome to Project Scribe',
            content: $content,
            created_at: $timestamp,
            updated_at: $timestamp,
            tags: $tags,
            journal_id: $journal_id
        })
        CREATE (n)-[:CREATED_BY]->(u)
        RETURN n
        """,
        {
            "id": note_id,
            "username": admin_username,
            "content": content_json,
            "timestamp": current_time,
            "tags": ["sample", "welcome"],
            "journal_id": journal_id
        }
    )
    
    # Link note to journal
    neo4j_graph.query(
        """
        MATCH (n:Note {id: $note_id})
        MATCH (j:Journal {id: $journal_id})
        CREATE (n)-[:BELONGS_TO]->(j)
        """,
        {"note_id": note_id, "journal_id": journal_id}
    )
    
    # Update journal note count
    neo4j_graph.query(
        """
        MATCH (j:Journal {id: $journal_id})
        SET j.note_count = 1
        """,
        {"journal_id": journal_id}
    )
    
    print("Created sample note and linked it to the journal")
    
    # Generate embedding for the sample note
    note_text = "Welcome to Project Scribe This is a sample note to help you get started."
    note_embedding = embedding_model.embed_query(note_text)
    
    # Store the embedding
    neo4j_graph.query(
        """
        MATCH (n:Note {id: $note_id})
        SET n.embedding = $embedding
        """,
        {"note_id": note_id, "embedding": note_embedding}
    )
    
    print("Generated embedding for sample note")
    
    print("Database initialization complete")

# Lifespan context manager (replacing on_event)
@asynccontextmanager
async def lifespan(app: FastAPI):
    print("Creating constraints...")
    try:
        create_user_constraints()
        create_note_constraints()
        create_journal_constraints()
        print("Constraints created successfully")
        
        print("Creating vector indices...")
        create_vector_index(neo4j_graph)
        print("Vector indices created successfully")
        
        # Ensure all required properties exist in the schema
        print("Ensuring properties exist...")
        ensure_property_exists("full_name")
        ensure_property_exists("disabled")
        ensure_property_exists("title")
        ensure_property_exists("content")
        ensure_property_exists("tags")
        ensure_property_exists("journal_id")
        ensure_property_exists("updated_at")
        ensure_property_exists("created_at")
        ensure_property_exists("description")
        ensure_property_exists("note_count")
        ensure_property_exists("template")
        
        # Ensure relationships exist in the schema
        print("Ensuring relationships exist...")
        ensure_relationship_exists("CREATED_BY")
        ensure_relationship_exists("OWNED_BY")
        ensure_relationship_exists("BELONGS_TO")
        
        print("Schema properties and relationships created successfully")
        
        # Initialize database with sample data
        print("Starting database initialization...")
        initialize_database()
        print("Database initialization completed")
    except Exception as e:
        print(f"Error during startup: {str(e)}")
        import traceback
        traceback.print_exc()
    
    yield
    # Shutdown: nothing to do

# FastAPI app
app = FastAPI(title="Project Scribe Backend", lifespan=lifespan)

# Update CORS settings to be more specific
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8505", "http://localhost:8585", 
                  "http://127.0.0.1:8505", "http://127.0.0.1:8585", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

# Models
class UserCreate(BaseModel):
    username: str
    email: str
    password: str
    full_name: Optional[str] = None
    
    @field_validator('email')
    @classmethod
    def validate_email(cls, v):
        if '@' not in v:
            raise ValueError('Invalid email format')
        return v

class User(BaseModel):
    username: str
    email: str
    full_name: Optional[str] = None
    disabled: Optional[bool] = None

class UserInDB(User):
    hashed_password: str

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: Optional[str] = None

# Note and Journal models
class NoteContent(BaseModel):
    text: str = ""
    images: List[str] = []  # Base64 encoded images
    audio: Optional[str] = None  # Base64 encoded audio

class NoteCreate(BaseModel):
    title: str
    content: NoteContent
    journal_id: Optional[str] = None
    tags: List[str] = []

class Note(BaseModel):
    id: str
    title: str
    content: NoteContent
    created_at: str
    updated_at: str
    tags: List[str] = []
    journal_id: Optional[str] = None

class NoteUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[NoteContent] = None
    tags: Optional[List[str]] = None
    journal_id: Optional[str] = None

class JournalCreate(BaseModel):
    title: str
    description: Optional[str] = None
    template: Optional[Dict[str, Any]] = None

class Journal(BaseModel):
    id: str
    title: str
    description: Optional[str] = None
    created_at: str
    updated_at: str
    note_count: int = 0
    template: Optional[Dict[str, Any]] = None

class JournalUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    template: Optional[Dict[str, Any]] = None

# Helper functions
def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def get_user(username: str):
    result = neo4j_graph.query(
        """
        MATCH (u:User {username: $username}) 
        RETURN u.username as username, u.email as email, 
               COALESCE(u.full_name, '') as full_name, 
               COALESCE(u.disabled, false) as disabled, 
               u.hashed_password as hashed_password
        """,
        {"username": username}
    )
    
    if not result:
        return None
    
    user_data = result[0]
    return UserInDB(**user_data)

def authenticate_user(username: str, password: str):
    user = get_user(username)
    if not user:
        return False
    if not verify_password(password, user.hashed_password):
        return False
    return user

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(token: str = Depends(oauth2_scheme)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
        token_data = TokenData(username=username)
    except JWTError:
        raise credentials_exception
    user = get_user(username=token_data.username)
    if user is None:
        raise credentials_exception
    return user

async def get_current_active_user(current_user: User = Depends(get_current_user)):
    if current_user.disabled:
        raise HTTPException(status_code=400, detail="Inactive user")
    return current_user

# API Endpoints
@app.post("/register", response_model=User)
async def register_user(user: UserCreate, request: Request):
    print(f"Registration request received from: {request.client.host}")
    print(f"Registration attempt for user: {user.username}, email: {user.email}")
    
    try:
        # Check if user already exists
        existing_user = neo4j_graph.query(
            """
            MATCH (u:User) 
            WHERE u.username = $username OR u.email = $email
            RETURN u
            """,
            {"username": user.username, "email": user.email}
        )
        
        if existing_user:
            print(f"User already exists: {user.username}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Username or email already registered"
            )
        
        # Create new user
        hashed_password = get_password_hash(user.password)
        
        # Ensure full_name is always a string
        full_name = user.full_name if user.full_name is not None else ''
        
        # Use MERGE instead of CREATE to be more robust
        neo4j_graph.query(
            """
            CREATE (u:User {
                username: $username, 
                email: $email, 
                full_name: $full_name, 
                hashed_password: $hashed_password,
                created_at: datetime(),
                disabled: false
            })
            RETURN u
            """,
            {
                "username": user.username,
                "email": user.email,
                "full_name": full_name,
                "hashed_password": hashed_password
            }
        )
        
        print(f"User created successfully: {user.username}")
        return {
            "username": user.username,
            "email": user.email,
            "full_name": full_name,
            "disabled": False
        }
        
    except Exception as e:
        print(f"Error creating user: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create user: {str(e)}"
        )

@app.post("/token", response_model=Token)
async def login_for_access_token(request: Request, form_data: OAuth2PasswordRequestForm = Depends()):
    print(f"Login attempt from: {request.client.host}, username: {form_data.username}")
    user = authenticate_user(form_data.username, form_data.password)
    if not user:
        print(f"Invalid credentials for user: {form_data.username}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username}, expires_delta=access_token_expires
    )
    print(f"Login successful for user: {form_data.username}")
    return {"access_token": access_token, "token_type": "bearer"}

@app.get("/users/me", response_model=User)
async def read_users_me(current_user: User = Depends(get_current_active_user)):
    return current_user

@app.get("/api/hello")
async def hello(request: Request):
    return {"message": "Hello from the API"}

# Notes API Endpoints
@app.post("/api/notes", response_model=Note)
async def create_note(note_data: NoteCreate, current_user: User = Depends(get_current_active_user)):
    note_id = str(uuid.uuid4())
    current_time = datetime.utcnow().isoformat()
    
    # Check if journal exists if journal_id is provided
    if note_data.journal_id:
        journal = neo4j_graph.query(
            """
            MATCH (j:Journal {id: $journal_id})
            MATCH (u:User {username: $username})
            MATCH (j)-[:OWNED_BY]->(u)
            RETURN j
            """,
            {"journal_id": note_data.journal_id, "username": current_user.username}
        )
        
        if not journal:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Journal not found or you don't have access to it"
            )
    
    # Serialize content to JSON string
    content_json = json.dumps(note_data.content.model_dump())
    
    # Create note
    neo4j_graph.query(
        """
        MATCH (u:User {username: $username})
        CREATE (n:Note {
            id: $id,
            title: $title,
            content: $content,
            created_at: $timestamp,
            updated_at: $timestamp,
            tags: $tags
        })
        CREATE (n)-[:CREATED_BY]->(u)
        RETURN n
        """,
        {
            "id": note_id,
            "title": note_data.title,
            "content": content_json,
            "timestamp": current_time,
            "tags": note_data.tags,
            "username": current_user.username
        }
    )
    
    # Link note to journal if journal_id is provided
    if note_data.journal_id:
        neo4j_graph.query(
            """
            MATCH (n:Note {id: $note_id})
            MATCH (j:Journal {id: $journal_id})
            CREATE (n)-[:BELONGS_TO]->(j)
            SET n.journal_id = $journal_id
            """,
            {"note_id": note_id, "journal_id": note_data.journal_id}
        )
        
        # Update note count in journal
        neo4j_graph.query(
            """
            MATCH (j:Journal {id: $journal_id})
            SET j.note_count = COALESCE(j.note_count, 0) + 1
            """,
            {"journal_id": note_data.journal_id}
        )
    
    return {
        "id": note_id,
        "title": note_data.title,
        "content": note_data.content,
        "created_at": current_time,
        "updated_at": current_time,
        "tags": note_data.tags,
        "journal_id": note_data.journal_id
    }

@app.get("/api/notes", response_model=List[Note])
async def get_notes(current_user: User = Depends(get_current_active_user)):
    notes = neo4j_graph.query(
        """
        MATCH (n:Note)-[:CREATED_BY]->(u:User {username: $username})
        RETURN n.id as id, n.title as title, n.content as content, 
               n.created_at as created_at, n.updated_at as updated_at,
               n.tags as tags, n.journal_id as journal_id
        ORDER BY n.updated_at DESC
        """,
        {"username": current_user.username}
    )
    
    result = []
    for note in notes:
        # Convert content from string/dict to NoteContent model
        content_dict = deserialize_json_field(note["content"])
            
        note_content = NoteContent(**content_dict)
        
        result.append({
            "id": note["id"],
            "title": note["title"],
            "content": note_content,
            "created_at": note["created_at"],
            "updated_at": note["updated_at"],
            "tags": note["tags"] if note["tags"] else [],
            "journal_id": note["journal_id"]
        })
    
    return result

@app.get("/api/notes/{note_id}", response_model=Note)
async def get_note(note_id: str, current_user: User = Depends(get_current_active_user)):
    result = neo4j_graph.query(
        """
        MATCH (n:Note {id: $note_id})-[:CREATED_BY]->(u:User {username: $username})
        RETURN n.id as id, n.title as title, n.content as content, 
               n.created_at as created_at, n.updated_at as updated_at,
               n.tags as tags, n.journal_id as journal_id
        """,
        {"note_id": note_id, "username": current_user.username}
    )
    
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Note not found or you don't have access to it"
        )
    
    note = result[0]
    
    # Convert content from string/dict to NoteContent model
    content_dict = deserialize_json_field(note["content"])
        
    note_content = NoteContent(**content_dict)
    
    return {
        "id": note["id"],
        "title": note["title"],
        "content": note_content,
        "created_at": note["created_at"],
        "updated_at": note["updated_at"],
        "tags": note["tags"] if note["tags"] else [],
        "journal_id": note["journal_id"]
    }

@app.put("/api/notes/{note_id}", response_model=Note)
async def update_note(note_id: str, note_update: NoteUpdate, current_user: User = Depends(get_current_active_user)):
    # Verify note exists and belongs to user
    import json  # Local import to ensure it's available
    result = neo4j_graph.query(
        """
        MATCH (n:Note {id: $note_id})-[:CREATED_BY]->(u:User {username: $username})
        RETURN n.id as id, n.title as title, n.content as content, 
               n.created_at as created_at, n.updated_at as updated_at,
               n.tags as tags, n.journal_id as journal_id
        """,
        {"note_id": note_id, "username": current_user.username}
    )
    
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Note not found or you don't have access to it"
        )
    
    current_note = result[0]
    
    # Update note fields
    update_data = {}
    if note_update.title:
        update_data["title"] = note_update.title
    
    if note_update.content:
        # Serialize content to JSON string
        update_data["content"] = json.dumps(note_update.content.model_dump())
    
    if note_update.tags is not None:
        update_data["tags"] = note_update.tags
    
    # Handle journal update if needed
    old_journal_id = current_note["journal_id"]
    new_journal_id = note_update.journal_id
    
    # Update note in Neo4j
    update_cypher = """
    MATCH (n:Note {id: $note_id})-[:CREATED_BY]->(u:User {username: $username})
    SET n.updated_at = $timestamp
    """
    
    # Add each field to update
    for key, value in update_data.items():
        update_cypher += f", n.{key} = ${key}"
    
    # Execute update query
    neo4j_graph.query(
        update_cypher,
        {
            "note_id": note_id,
            "username": current_user.username,
            "timestamp": datetime.utcnow().isoformat(),
            **update_data
        }
    )
    
    # Handle journal relationship changes if needed
    if new_journal_id != old_journal_id:
        # Remove from old journal if it existed
        if old_journal_id:
            neo4j_graph.query(
                """
                MATCH (n:Note {id: $note_id})-[r:BELONGS_TO]->(j:Journal {id: $journal_id})
                DELETE r
                SET n.journal_id = null
                WITH j
                MATCH (j)
                SET j.note_count = COALESCE(j.note_count, 1) - 1
                """,
                {"note_id": note_id, "journal_id": old_journal_id}
            )
        
        # Add to new journal if specified
        if new_journal_id:
            # Verify journal exists and belongs to user
            journal = neo4j_graph.query(
                """
                MATCH (j:Journal {id: $journal_id})-[:OWNED_BY]->(u:User {username: $username})
                RETURN j
                """,
                {"journal_id": new_journal_id, "username": current_user.username}
            )
            
            if not journal:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Journal not found or you don't have access to it"
                )
            
            # Link note to new journal
            neo4j_graph.query(
                """
                MATCH (n:Note {id: $note_id})
                MATCH (j:Journal {id: $journal_id})
                CREATE (n)-[:BELONGS_TO]->(j)
                SET n.journal_id = $journal_id
                WITH j
                MATCH (j)
                SET j.note_count = COALESCE(j.note_count, 0) + 1
                """,
                {"note_id": note_id, "journal_id": new_journal_id}
            )
            
            update_data["journal_id"] = new_journal_id
    
    # Get updated note
    updated_note = neo4j_graph.query(
        """
        MATCH (n:Note {id: $note_id})
        RETURN n.id as id, n.title as title, n.content as content, 
               n.created_at as created_at, n.updated_at as updated_at,
               n.tags as tags, n.journal_id as journal_id
        """,
        {"note_id": note_id}
    )[0]
    
    # Convert content from string/dict to NoteContent model
    if isinstance(updated_note["content"], str):
        import json
        content_dict = json.loads(updated_note["content"])
    else:
        content_dict = updated_note["content"]
        
    note_content = NoteContent(**content_dict)
    
    return {
        "id": updated_note["id"],
        "title": updated_note["title"],
        "content": note_content,
        "created_at": updated_note["created_at"],
        "updated_at": updated_note["updated_at"],
        "tags": updated_note["tags"] if updated_note["tags"] else [],
        "journal_id": updated_note["journal_id"]
    }

@app.delete("/api/notes/{note_id}")
async def delete_note(note_id: str, current_user: User = Depends(get_current_active_user)):
    # First, verify note exists and get its journal if any
    result = neo4j_graph.query(
        """
        MATCH (n:Note {id: $note_id})-[:CREATED_BY]->(u:User {username: $username})
        RETURN n.journal_id as journal_id
        """,
        {"note_id": note_id, "username": current_user.username}
    )
    
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Note not found or you don't have access to it"
        )
    
    journal_id = result[0]["journal_id"]
    
    # Delete note
    neo4j_graph.query(
        """
        MATCH (n:Note {id: $note_id})-[:CREATED_BY]->(u:User {username: $username})
        DETACH DELETE n
        """,
        {"note_id": note_id, "username": current_user.username}
    )
    
    # Update journal note count if note was in a journal
    if journal_id:
        neo4j_graph.query(
            """
            MATCH (j:Journal {id: $journal_id})
            SET j.note_count = COALESCE(j.note_count, 1) - 1
            """,
            {"journal_id": journal_id}
        )
    
    return {"message": "Note deleted successfully"}

# Journal API Endpoints
@app.post("/api/journals", response_model=Journal)
async def create_journal(journal_data: JournalCreate, current_user: User = Depends(get_current_active_user)):
    journal_id = str(uuid.uuid4())
    current_time = datetime.utcnow().isoformat()
    
    # Serialize template to JSON string if it's provided
    template_json = json.dumps(journal_data.template or {})
    
    # Create journal
    neo4j_graph.query(
        """
        MATCH (u:User {username: $username})
        CREATE (j:Journal {
            id: $id,
            title: $title,
            description: $description,
            created_at: $timestamp,
            updated_at: $timestamp,
            note_count: 0,
            template: $template
        })
        CREATE (j)-[:OWNED_BY]->(u)
        RETURN j
        """,
        {
            "id": journal_id,
            "title": journal_data.title,
            "description": journal_data.description or "",
            "timestamp": current_time,
            "template": template_json,
            "username": current_user.username
        }
    )
    
    return {
        "id": journal_id,
        "title": journal_data.title,
        "description": journal_data.description,
        "created_at": current_time,
        "updated_at": current_time,
        "note_count": 0,
        "template": journal_data.template
    }

@app.get("/api/journals", response_model=List[Journal])
async def get_journals(current_user: User = Depends(get_current_active_user)):
    journals = neo4j_graph.query(
        """
        MATCH (j:Journal)-[:OWNED_BY]->(u:User {username: $username})
        RETURN j.id as id, j.title as title, j.description as description,
               j.created_at as created_at, j.updated_at as updated_at,
               COALESCE(j.note_count, 0) as note_count, j.template as template
        ORDER BY j.updated_at DESC
        """,
        {"username": current_user.username}
    )
    
    # Deserialize template fields
    for journal in journals:
        if "template" in journal and journal["template"]:
            journal["template"] = deserialize_json_field(journal["template"])
    
    return journals

@app.get("/api/journals/{journal_id}", response_model=Journal)
async def get_journal(journal_id: str, current_user: User = Depends(get_current_active_user)):
    result = neo4j_graph.query(
        """
        MATCH (j:Journal {id: $journal_id})-[:OWNED_BY]->(u:User {username: $username})
        RETURN j.id as id, j.title as title, j.description as description,
               j.created_at as created_at, j.updated_at as updated_at,
               COALESCE(j.note_count, 0) as note_count, j.template as template
        """,
        {"journal_id": journal_id, "username": current_user.username}
    )
    
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Journal not found or you don't have access to it"
        )
    
    journal = result[0]
    
    # Deserialize the template if it's stored as a JSON string
    if "template" in journal and journal["template"]:
        journal["template"] = deserialize_json_field(journal["template"])
    
    return journal

@app.get("/api/journals/{journal_id}/notes", response_model=List[Note])
async def get_journal_notes(journal_id: str, current_user: User = Depends(get_current_active_user)):
    # Verify journal exists and belongs to user
    journal = neo4j_graph.query(
        """
        MATCH (j:Journal {id: $journal_id})-[:OWNED_BY]->(u:User {username: $username})
        RETURN j
        """,
        {"journal_id": journal_id, "username": current_user.username}
    )
    
    if not journal:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Journal not found or you don't have access to it"
        )
    
    # Get all notes in journal
    notes = neo4j_graph.query(
        """
        MATCH (n:Note)-[:BELONGS_TO]->(j:Journal {id: $journal_id})
        MATCH (j)-[:OWNED_BY]->(u:User {username: $username})
        RETURN n.id as id, n.title as title, n.content as content, 
               n.created_at as created_at, n.updated_at as updated_at,
               n.tags as tags, n.journal_id as journal_id
        ORDER BY n.updated_at DESC
        """,
        {"journal_id": journal_id, "username": current_user.username}
    )
    
    result = []
    for note in notes:
        # Convert content from string/dict to NoteContent model
        content_dict = deserialize_json_field(note["content"])
            
        note_content = NoteContent(**content_dict)
        
        result.append({
            "id": note["id"],
            "title": note["title"],
            "content": note_content,
            "created_at": note["created_at"],
            "updated_at": note["updated_at"],
            "tags": note["tags"] if note["tags"] else [],
            "journal_id": note["journal_id"]
        })
    
    return result

def deserialize_json_field(field_value):
    """Convert a JSON string to a dictionary if it's a string, or return as is if it's already a dict."""
    if isinstance(field_value, str):
        try:
            return json.loads(field_value)
        except:
            return field_value
    return field_value

@app.put("/api/journals/{journal_id}", response_model=Journal)
async def update_journal(journal_id: str, journal_update: JournalUpdate, current_user: User = Depends(get_current_active_user)):
    # Verify journal exists and belongs to user
    import json  # Local import to ensure it's available
    result = neo4j_graph.query(
        """
        MATCH (j:Journal {id: $journal_id})-[:OWNED_BY]->(u:User {username: $username})
        RETURN j
        """,
        {"journal_id": journal_id, "username": current_user.username}
    )
    
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Journal not found or you don't have access to it"
        )
    
    # Update journal fields
    update_data = {}
    if journal_update.title:
        update_data["title"] = journal_update.title
    
    if journal_update.description is not None:  # Allow empty description
        update_data["description"] = journal_update.description
    
    if journal_update.template is not None:
        # Serialize template to JSON string
        update_data["template"] = json.dumps(journal_update.template)
    
    # Update journal in Neo4j
    update_cypher = """
    MATCH (j:Journal {id: $journal_id})-[:OWNED_BY]->(u:User {username: $username})
    SET j.updated_at = $timestamp
    """
    
    # Add each field to update
    for key, value in update_data.items():
        update_cypher += f", j.{key} = ${key}"
    
    # Execute update query
    neo4j_graph.query(
        update_cypher + " RETURN j",
        {
            "journal_id": journal_id,
            "username": current_user.username,
            "timestamp": datetime.utcnow().isoformat(),
            **update_data
        }
    )
    
    # Get updated journal
    updated_journal = neo4j_graph.query(
        """
        MATCH (j:Journal {id: $journal_id})
        RETURN j.id as id, j.title as title, j.description as description,
               j.created_at as created_at, j.updated_at as updated_at,
               COALESCE(j.note_count, 0) as note_count, j.template as template
        """,
        {"journal_id": journal_id}
    )[0]
    
    # Deserialize the template if it's stored as a JSON string
    if "template" in updated_journal and updated_journal["template"]:
        updated_journal["template"] = deserialize_json_field(updated_journal["template"])
    
    return updated_journal

@app.delete("/api/journals/{journal_id}")
async def delete_journal(journal_id: str, delete_notes: bool = False, current_user: User = Depends(get_current_active_user)):
    # Verify journal exists and belongs to user
    result = neo4j_graph.query(
        """
        MATCH (j:Journal {id: $journal_id})-[:OWNED_BY]->(u:User {username: $username})
        RETURN j
        """,
        {"journal_id": journal_id, "username": current_user.username}
    )
    
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Journal not found or you don't have access to it"
        )
    
    if delete_notes:
        # Delete all notes in journal
        neo4j_graph.query(
            """
            MATCH (n:Note)-[:BELONGS_TO]->(j:Journal {id: $journal_id})
            MATCH (j)-[:OWNED_BY]->(u:User {username: $username})
            DETACH DELETE n
            """,
            {"journal_id": journal_id, "username": current_user.username}
        )
    else:
        # Remove journal relationship from notes but keep notes
        neo4j_graph.query(
            """
            MATCH (n:Note)-[r:BELONGS_TO]->(j:Journal {id: $journal_id})
            MATCH (j)-[:OWNED_BY]->(u:User {username: $username})
            DELETE r
            SET n.journal_id = null
            """,
            {"journal_id": journal_id, "username": current_user.username}
        )
    
    # Delete journal
    neo4j_graph.query(
        """
        MATCH (j:Journal {id: $journal_id})-[:OWNED_BY]->(u:User {username: $username})
        DETACH DELETE j
        """,
        {"journal_id": journal_id, "username": current_user.username}
    )
    
    return {"message": "Journal deleted successfully"}

# AGNIS - Search and Question Answering API Endpoints
class SearchQuery(BaseModel):
    query: str

class SearchResult(BaseModel):
    id: str
    title: str
    excerpt: str
    score: float
    tags: List[str] = []
    type: str = "note"  # Add type field with default value "note"

class SearchResponse(BaseModel):
    results: List[SearchResult]
    total: int

class QuestionQuery(BaseModel):
    text: str
    system_prompt: Optional[str] = None
    rag: bool = True

class QuestionResponse(BaseModel):
    answer: str
    sources: List[str] = []
    model: str = "llama3"

# Load embedding model for semantic search
embedding_model = HuggingFaceEmbeddings(
    model_name="all-MiniLM-L6-v2", 
    cache_folder="/embedding_model"
)

# Full-text search endpoint
@app.get("/api/search", response_model=SearchResponse)
async def search_notes(query: str, current_user: User = Depends(get_current_active_user)):
    if not query or len(query.strip()) < 2:
        return {"results": [], "total": 0}
    
    # Create case-insensitive regex pattern
    pattern = re.compile(query, re.IGNORECASE)
    
    # Search notes by title and content
    results = neo4j_graph.query(
        """
        MATCH (n:Note)-[:CREATED_BY]->(u:User {username: $username})
        WHERE n.title =~ $query_regex OR n.content =~ $query_regex
        RETURN n.id as id, n.title as title, n.content as content, 
               n.tags as tags, n.updated_at as updated_at,
               CASE 
                 WHEN n.title =~ $query_regex THEN 3
                 ELSE 1
               END as score
        ORDER BY score DESC, n.updated_at DESC
        LIMIT 20
        """,
        {"username": current_user.username, "query_regex": f"(?i).*{query}.*"}
    )
    
    search_results = []
    for result in results:
        # Get excerpt containing the search term
        content_dict = deserialize_json_field(result["content"])
        text_content = content_dict.get("text", "")
        
        # Find position of query in text
        match = pattern.search(text_content)
        if match:
            start_pos = max(0, match.start() - 50)
            end_pos = min(len(text_content), match.end() + 50)
            excerpt = "..." + text_content[start_pos:end_pos] + "..."
        else:
            excerpt = text_content[:100] + "..." if len(text_content) > 100 else text_content
        
        search_results.append({
            "id": result["id"],
            "title": result["title"],
            "excerpt": excerpt,
            "score": result["score"],
            "tags": result["tags"] if result["tags"] else [],
            "type": result["type"]
        })
    
    return {"results": search_results, "total": len(search_results)}

# Semantic search endpoint
@app.get("/api/search/semantic", response_model=SearchResponse)
async def semantic_search(query: str, current_user: User = Depends(get_current_active_user)):
    if not query or len(query.strip()) < 2:
        return {"results": [], "total": 0}
    
    # Get query embedding
    query_embedding = embedding_model.embed_query(query)
    
    # Get all notes with their embeddings
    notes = neo4j_graph.query(
        """
        MATCH (n:Note)-[:CREATED_BY]->(u:User {username: $username})
        RETURN n.id as id, n.title as title, n.content as content, 
               n.tags as tags, n.updated_at as updated_at,
               n.embedding as embedding,
               'note' as type
        """,
        {"username": current_user.username}
    )
    
    # Get all journals with their embeddings
    journals = neo4j_graph.query(
        """
        MATCH (j:Journal)-[:OWNED_BY]->(u:User {username: $username})
        RETURN j.id as id, j.title as title, j.description as description, 
               j.updated_at as updated_at, j.embedding as embedding,
               'journal' as type
        """,
        {"username": current_user.username}
    )
    
    # Combine results for processing
    all_items = notes + journals
    
    # Calculate similarity in Python
    search_results = []
    for item in all_items:
        item_type = item.get("type", "note")
        
        if item_type == "note":
            # Extract text content for excerpt
            content_dict = deserialize_json_field(item["content"])
            text_content = content_dict.get("text", "")
            
            # If note has no embedding yet, generate one on the fly
            if not item.get("embedding"):
                note_text = f"{item['title']} {text_content}"
                item_embedding = embedding_model.embed_query(note_text)
                
                # Store this for future use
                neo4j_graph.query(
                    """
                    MATCH (n:Note {id: $item_id})
                    SET n.embedding = $embedding
                    """,
                    {"item_id": item["id"], "embedding": item_embedding}
                )
            else:
                item_embedding = item["embedding"]
            
            excerpt = text_content[:100] + "..." if len(text_content) > 100 else text_content
            tags = item["tags"] if item["tags"] else []
            
        else:  # journal
            # If journal has no embedding yet, generate one on the fly
            description = item.get("description", "")
            
            if not item.get("embedding"):
                journal_text = f"{item['title']} {description}"
                item_embedding = embedding_model.embed_query(journal_text)
                
                # Store this for future use
                neo4j_graph.query(
                    """
                    MATCH (j:Journal {id: $item_id})
                    SET j.embedding = $embedding
                    """,
                    {"item_id": item["id"], "embedding": item_embedding}
                )
            else:
                item_embedding = item["embedding"]
            
            excerpt = description[:100] + "..." if len(description) > 100 else description
            tags = []  # Journals don't have tags
            
        # Calculate cosine similarity
        if isinstance(query_embedding, list):
            query_vec = np.array(query_embedding)
        else:
            query_vec = query_embedding
            
        if isinstance(item_embedding, list):
            item_vec = np.array(item_embedding)
        else:
            item_vec = item_embedding
        
        # Calculate dot product for similarity
        similarity = np.dot(query_vec, item_vec) / (np.linalg.norm(query_vec) * np.linalg.norm(item_vec))
        
        # Only include results with reasonable similarity - threshold at 0.2
        if similarity > 0.2:
            search_results.append({
                "id": item["id"],
                "title": item["title"],
                "excerpt": excerpt,
                "score": float(similarity),  # Convert to float for JSON serialization
                "tags": tags,
                "type": item_type  # Include type in results
            })
    
    # Sort by similarity score
    search_results.sort(key=lambda x: x["score"], reverse=True)
    
    # Limit to top 20 results
    return {"results": search_results[:20], "total": len(search_results[:20])}

# Tag-based search endpoint
@app.get("/api/search/tags", response_model=SearchResponse)
async def tag_search(tags: str, current_user: User = Depends(get_current_active_user)):
    # Split tags by comma and strip whitespace
    tag_list = [tag.strip() for tag in tags.split(",") if tag.strip()]
    
    if not tag_list:
        return {"results": [], "total": 0}
    
    # Search notes with any of the provided tags
    results = neo4j_graph.query(
        """
        MATCH (n:Note)-[:CREATED_BY]->(u:User {username: $username})
        WHERE any(tag IN n.tags WHERE tag IN $tag_list)
        RETURN n.id as id, n.title as title, n.content as content, 
               n.tags as tags, n.updated_at as updated_at,
               'note' as type
        ORDER BY n.updated_at DESC
        """,
        {"username": current_user.username, "tag_list": tag_list}
    )
    
    search_results = []
    for result in results:
        # Extract text content for excerpt
        content_dict = deserialize_json_field(result["content"])
        text_content = content_dict.get("text", "")
        excerpt = text_content[:100] + "..." if len(text_content) > 100 else text_content
        
        # Calculate matching tags for scoring
        matching_tags = [tag for tag in result["tags"] if tag in tag_list]
        
        search_results.append({
            "id": result["id"],
            "title": result["title"],
            "excerpt": excerpt,
            "score": len(matching_tags),  # Score based on number of matching tags
            "tags": result["tags"] if result["tags"] else [],
            "type": result["type"]
        })
    
    # Sort by score (number of matching tags)
    search_results.sort(key=lambda x: x["score"], reverse=True)
    
    return {"results": search_results, "total": len(search_results)}

# Generate embeddings for notes (background task or on-demand)
def generate_note_embeddings(note_id: str = None):
    if note_id:
        # Generate embedding for a specific note
        note = neo4j_graph.query(
            """
            MATCH (n:Note {id: $note_id})
            RETURN n.id as id, n.title as title, n.content as content
            """,
            {"note_id": note_id}
        )
        
        if not note:
            return
        
        note = note[0]
        content_dict = deserialize_json_field(note["content"])
        text_content = content_dict.get("text", "")
        
        # Include title in embedding to improve search relevance
        embed_text = f"{note['title']} {text_content}"
        
        if embed_text.strip():
            embedding = embedding_model.embed_query(embed_text)
            
            # Store embedding back to note
            neo4j_graph.query(
                """
                MATCH (n:Note {id: $note_id})
                SET n.embedding = $embedding
                """,
                {"note_id": note["id"], "embedding": embedding}
            )
    else:
        # Generate embeddings for all notes without embeddings
        notes = neo4j_graph.query(
            """
            MATCH (n:Note)
            WHERE n.embedding IS NULL
            RETURN n.id as id, n.title as title, n.content as content
            LIMIT 100  // Process in batches
            """
        )
        
        for note in notes:
            content_dict = deserialize_json_field(note["content"])
            text_content = content_dict.get("text", "")
            
            # Include title in embedding to improve search relevance
            embed_text = f"{note['title']} {text_content}"
            
            if embed_text.strip():
                embedding = embedding_model.embed_query(embed_text)
                
                # Store embedding back to note
                neo4j_graph.query(
                    """
                    MATCH (n:Note {id: $note_id})
                    SET n.embedding = $embedding
                    """,
                    {"note_id": note["id"], "embedding": embedding}
                )

# Generate embeddings for journals
def generate_journal_embeddings(journal_id: str = None):
    if journal_id:
        # Generate embedding for a specific journal
        journal = neo4j_graph.query(
            """
            MATCH (j:Journal {id: $journal_id})
            RETURN j.id as id, j.title as title, j.description as description
            """,
            {"journal_id": journal_id}
        )
        
        if not journal:
            return
        
        journal = journal[0]
        description = journal.get("description", "")
        
        # Combine title and description for embedding
        embed_text = f"{journal['title']} {description}"
        
        if embed_text.strip():
            embedding = embedding_model.embed_query(embed_text)
            
            # Store embedding back to journal
            neo4j_graph.query(
                """
                MATCH (j:Journal {id: $journal_id})
                SET j.embedding = $embedding
                """,
                {"journal_id": journal["id"], "embedding": embedding}
            )
    else:
        # Generate embeddings for all journals without embeddings
        journals = neo4j_graph.query(
            """
            MATCH (j:Journal)
            WHERE j.embedding IS NULL
            RETURN j.id as id, j.title as title, j.description as description
            LIMIT 100  // Process in batches
            """
        )
        
        for journal in journals:
            description = journal.get("description", "")
            
            # Combine title and description for embedding
            embed_text = f"{journal['title']} {description}"
            
            if embed_text.strip():
                embedding = embedding_model.embed_query(embed_text)
                
                # Store embedding back to journal
                neo4j_graph.query(
                    """
                    MATCH (j:Journal {id: $journal_id})
                    SET j.embedding = $embedding
                    """,
                    {"journal_id": journal["id"], "embedding": embedding}
                )

# Hook into note creation/update to generate embeddings
@app.post("/api/notes/embeddings/{note_id}")
async def create_note_embedding(note_id: str, current_user: User = Depends(get_current_active_user)):
    # Verify user owns the note
    note = neo4j_graph.query(
        """
        MATCH (n:Note {id: $note_id})-[:CREATED_BY]->(u:User {username: $username})
        RETURN n
        """,
        {"note_id": note_id, "username": current_user.username}
    )
    
    if not note:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Note not found or you don't have access to it"
        )
    
    # Generate embedding in background (this is a simple implementation - in production use proper async tasks)
    generate_note_embeddings(note_id)
    
    return {"message": "Embedding generation started"}

# Hook into journal creation/update to generate embeddings
@app.post("/api/journals/embeddings/{journal_id}")
async def create_journal_embedding(journal_id: str, current_user: User = Depends(get_current_active_user)):
    # Verify user owns the journal
    journal = neo4j_graph.query(
        """
        MATCH (j:Journal {id: $journal_id})-[:OWNED_BY]->(u:User {username: $username})
        RETURN j
        """,
        {"journal_id": journal_id, "username": current_user.username}
    )
    
    if not journal:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Journal not found or you don't have access to it"
        )
    
    # Generate embedding
    generate_journal_embeddings(journal_id)
    
    return {"message": "Embedding generation started"}

@app.post("/api/migrate/generate-all-embeddings")
async def migrate_generate_all_embeddings(current_user: User = Depends(get_current_active_user)):
    """Admin endpoint to generate embeddings for all notes that don't have them yet."""
    # Check if user is admin
    if current_user.username != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admin users can run migrations"
        )
    
    # Start background task to generate embeddings
    # In a real app, you would use a proper task queue like Celery
    try:
        # Count notes without embeddings
        result = neo4j_graph.query(
            """
            MATCH (n:Note)
            WHERE n.embedding IS NULL
            RETURN count(n) as missing_note_embeddings
            """
        )
        
        missing_notes_count = result[0]["missing_note_embeddings"] if result else 0
        
        # Count journals without embeddings
        result = neo4j_graph.query(
            """
            MATCH (j:Journal)
            WHERE j.embedding IS NULL
            RETURN count(j) as missing_journal_embeddings
            """
        )
        
        missing_journals_count = result[0]["missing_journal_embeddings"] if result else 0
        
        # Start the embedding generation process
        generate_note_embeddings()  # This will process notes in batches
        generate_journal_embeddings()  # This will process journals in batches
        
        return {
            "message": f"Started embedding generation for items without embeddings",
            "notes_to_process": missing_notes_count,
            "journals_to_process": missing_journals_count
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error starting migration: {str(e)}"
        )

# Question Answering Endpoint (Streaming)
@app.get("/api/query-stream")
async def query_stream(
    text: str,
    system_prompt: Optional[str] = "You are a helpful assistant.",
    rag: bool = True,
    current_user: User = Depends(get_current_active_user)
):
    """
    Handles querying the LLM with optional RAG context, streaming the response.
    """
    print(f"Received query: text='{text}', rag={rag}, system_prompt='{system_prompt}'")

    async def event_generator():
        context = ""
        sources = []

        if rag:
            print("Performing RAG search...")
            try:
                # Use semantic search to find relevant context
                query_embedding = embedding_model.embed_query(text)

                # Search notes using vector index
                note_results = neo4j_graph.query(
                    """
                    CALL db.index.vector.queryNodes('notes_vector', $top_k, $query_embedding) YIELD node, score
                    MATCH (node)-[:CREATED_BY]->(u:User {username: $username})
                    WHERE score > 0.7  // Adjust threshold as needed
                    RETURN node.id as id, node.title as title, node.content as content, score
                    ORDER BY score DESC
                    LIMIT 3
                    """,
                    {
                        "username": current_user.username,
                        "query_embedding": query_embedding,
                        "top_k": 5 # Ask for more results initially, then filter by score and limit
                    }
                )

                # Search journals using vector index
                journal_results = neo4j_graph.query(
                    """
                    CALL db.index.vector.queryNodes('journals_vector', $top_k, $query_embedding) YIELD node, score
                    MATCH (node)-[:OWNED_BY]->(u:User {username: $username})
                    WHERE score > 0.7  // Adjust threshold as needed
                    RETURN node.id as id, node.title as title, node.description as description, score
                    ORDER BY score DESC
                    LIMIT 2
                    """,
                    {
                        "username": current_user.username,
                        "query_embedding": query_embedding,
                        "top_k": 3
                    }
                )

                context_items = []
                for res in note_results:
                    content_dict = deserialize_json_field(res["content"])
                    text_content = content_dict.get("text", "")
                    context_items.append(f"Note Title: {res['title']}\nContent: {text_content}")
                    sources.append({"id": res["id"], "type": "note", "title": res["title"]})

                for res in journal_results:
                    description = res.get("description", "")
                    context_items.append(f"Journal Title: {res['title']}\nDescription: {description}")
                    sources.append({"id": res["id"], "type": "journal", "title": res["title"]})

                if context_items:
                    # Correctly join context items
                    context = "\n\n---\n\n".join(context_items)
                    print(f"Found RAG context: {len(context_items)} items.")
                else:
                    print("No relevant RAG context found.")

                # Send sources info first
                yield json.dumps({"type": "sources", "data": sources}) + "\n\n"

            except Exception as e:
                print(f"Error during RAG search: {e}")
                # Continue without context if RAG fails

        # Prepare messages for Ollama (use chat endpoint format)
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})

        # Simplify prompt construction
        if context:
            user_content = f"Context:\n{context}\n\nQuestion: {text}"
            messages.append({"role": "user", "content": user_content})
        else:
            messages.append({"role": "user", "content": text})

        # Call Ollama API
        ollama_url = os.getenv("OLLAMA_API_URL", "http://host.docker.internal:11434/api/chat")
        payload = {
            "model": os.getenv("OLLAMA_MODEL", "llama3"),
            "messages": messages,
            "stream": True
        }

        print(f"Sending request to Ollama: {ollama_url}")
        try:
            response = requests.post(ollama_url, json=payload, stream=True, timeout=60) # Add timeout
            response.raise_for_status()

            print("Streaming response from Ollama...")
            for line in response.iter_lines():
                if line:
                    try:
                        chunk = json.loads(line)
                        if chunk.get("done") is not True:
                            message_chunk = chunk.get("message", {}).get("content", "")
                            if message_chunk:
                                yield json.dumps({"type": "message", "data": message_chunk}) + "\n\n"
                        else:
                            final_info = chunk.get("total_duration")
                            if final_info:
                                yield json.dumps({"type": "final", "data": {"duration": final_info}}) + "\n\n"
                            print("Ollama stream finished.")
                            break
                    except json.JSONDecodeError as json_err:
                        print(f"Error decoding Ollama response line: {line}, Error: {json_err}")
                    except Exception as e:
                        print(f"Error processing Ollama stream chunk: {e}")
                        yield json.dumps({"type": "error", "data": f"Error processing stream: {e}"}) + "\n\n"
                        break # Stop streaming on processing error
        except requests.exceptions.Timeout:
             print(f"Error calling Ollama API: Timeout")
             yield json.dumps({"type": "error", "data": "LLM service timed out."}) + "\n\n"
        except requests.exceptions.RequestException as req_err:
            print(f"Error calling Ollama API: {req_err}")
            yield json.dumps({"type": "error", "data": f"Could not connect to LLM service: {req_err}"}) + "\n\n"
        except Exception as e:
            print(f"An unexpected error occurred during Ollama streaming: {e}")
            yield json.dumps({"type": "error", "data": f"An unexpected error occurred: {e}"}) + "\n\n"
        finally:
            # This block executes regardless of exceptions in the try block
            print("Closing event generator.")
            # Send a final event to signal the end cleanly
            yield json.dumps({"type": "close", "data": "Stream ended"}) + "\n\n"

    # Return the streaming response object
    return EventSourceResponse(event_generator(), media_type="text/event-stream")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8585)
