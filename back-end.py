import os
from fastapi import FastAPI, HTTPException, Depends, status, Request
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from contextlib import asynccontextmanager
from pydantic import BaseModel, field_validator
from passlib.context import CryptContext
from jose import JWTError, jwt
from datetime import datetime, timedelta
from typing import Optional
from dotenv import load_dotenv
from langchain_neo4j import Neo4jGraph
from fastapi.middleware.cors import CORSMiddleware

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

# Lifespan context manager (replacing on_event)
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: create constraints
    create_user_constraints()
    yield
    # Shutdown: nothing to do

# FastAPI app
app = FastAPI(title="Project Scribe Backend", lifespan=lifespan)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace with specific origins
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
               u.full_name as full_name, u.disabled as disabled, 
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
async def register_user(user: UserCreate):
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
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username or email already registered"
        )
    
    # Create new user
    hashed_password = get_password_hash(user.password)
    
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
            "full_name": user.full_name,
            "hashed_password": hashed_password
        }
    )
    
    return {
        "username": user.username,
        "email": user.email,
        "full_name": user.full_name,
        "disabled": False
    }

@app.post("/token", response_model=Token)
async def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends()):
    user = authenticate_user(form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

@app.get("/users/me", response_model=User)
async def read_users_me(current_user: User = Depends(get_current_active_user)):
    return current_user

# Hello endpoint for testing
@app.get("/api/hello")
async def hello():
    return {"message": "Welcome to Project Scribe API!"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8585)
