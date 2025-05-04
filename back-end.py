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
    
    # Convert template to JSON string
    template_data = {"field1": "text", "field2": "date"}
    template_json = json.dumps(template_data)
    
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
        
        print("Schema properties created successfully")
        
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
            "content": note_data.content.model_dump(),
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
        if isinstance(note["content"], str):
            import json
            content_dict = json.loads(note["content"])
        else:
            content_dict = note["content"]
            
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
    if isinstance(note["content"], str):
        import json
        content_dict = json.loads(note["content"])
    else:
        content_dict = note["content"]
        
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
    
    # Handle content update
    if isinstance(current_note["content"], str):
        import json
        current_content = json.loads(current_note["content"])
    else:
        current_content = current_note["content"]
    
    # Update note fields
    update_data = {}
    if note_update.title:
        update_data["title"] = note_update.title
    
    if note_update.content:
        update_data["content"] = note_update.content.model_dump()
    
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
            "template": journal_data.template or {},
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
    
    return result[0]

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
        if isinstance(note["content"], str):
            import json
            content_dict = json.loads(note["content"])
        else:
            content_dict = note["content"]
            
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

@app.put("/api/journals/{journal_id}", response_model=Journal)
async def update_journal(journal_id: str, journal_update: JournalUpdate, current_user: User = Depends(get_current_active_user)):
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
    
    # Update journal fields
    update_data = {}
    if journal_update.title:
        update_data["title"] = journal_update.title
    
    if journal_update.description is not None:  # Allow empty description
        update_data["description"] = journal_update.description
    
    if journal_update.template is not None:
        update_data["template"] = journal_update.template
    
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

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8585)
