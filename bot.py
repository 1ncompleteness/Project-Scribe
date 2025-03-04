import os
import time

import streamlit as st
from streamlit.logger import get_logger
from langchain.callbacks.base import BaseCallbackHandler
from langchain_community.graphs import Neo4jGraph
from dotenv import load_dotenv
import datetime
import json
import base64
import hashlib
from PIL import Image
from io import BytesIO
from utils import (
    create_vector_index,
    create_constraints,
)
from chains import (
    load_embedding_model,
    load_llm,
    configure_llm_only_chain,
    configure_qa_rag_chain,
)

load_dotenv(".env")

url = os.getenv("NEO4J_URI")
username = os.getenv("NEO4J_USERNAME")
password = os.getenv("NEO4J_PASSWORD")
ollama_base_url = os.getenv("OLLAMA_BASE_URL")
embedding_model_name = os.getenv("EMBEDDING_MODEL")
llm_name = os.getenv("LLM")
# Remapping for Langchain Neo4j integration
os.environ["NEO4J_URL"] = url

logger = get_logger(__name__)

# if Neo4j is local, you can go to http://localhost:7474/ to browse the database
neo4j_graph = Neo4jGraph(
    url=url, username=username, password=password, refresh_schema=True
)
embeddings, dimension = load_embedding_model(
    embedding_model_name, config={"ollama_base_url": ollama_base_url}, logger=logger
)
create_vector_index(neo4j_graph)
create_constraints(neo4j_graph)

# Create user constraints and indexes
def setup_user_schema():
    try:
        # User constraints
        neo4j_graph.query(
            "CREATE CONSTRAINT user_username IF NOT EXISTS FOR (u:User) REQUIRE u.username IS UNIQUE"
        )
        neo4j_graph.query(
            "CREATE INDEX user_created_at IF NOT EXISTS FOR (u:User) ON u.created_at"
        )
        
        # Note constraints
        neo4j_graph.query(
            "CREATE CONSTRAINT note_id IF NOT EXISTS FOR (n:Note) REQUIRE n.id IS UNIQUE"
        )
        neo4j_graph.query(
            "CREATE INDEX note_updated_at IF NOT EXISTS FOR (n:Note) ON n.updated_at"
        )
        
        # Journal constraints
        neo4j_graph.query(
            "CREATE CONSTRAINT journal_id IF NOT EXISTS FOR (j:Journal) REQUIRE j.id IS UNIQUE"
        )
        neo4j_graph.query(
            "CREATE INDEX journal_created_at IF NOT EXISTS FOR (j:Journal) ON j.created_at"
        )
        
        # Tag constraints
        neo4j_graph.query(
            "CREATE CONSTRAINT tag_name IF NOT EXISTS FOR (t:Tag) REQUIRE t.name IS UNIQUE"
        )
    except Exception as e:
        logger.error(f"Error setting up user schema: {e}")

setup_user_schema()

class StreamHandler(BaseCallbackHandler):
    def __init__(self, container, initial_text=""):
        self.container = container
        self.text = initial_text

    def on_llm_new_token(self, token: str, **kwargs) -> None:
        self.text += token
        self.container.markdown(self.text)


llm = load_llm(llm_name, logger=logger, config={"ollama_base_url": ollama_base_url})

llm_chain = configure_llm_only_chain(llm)
rag_chain = configure_qa_rag_chain(
    llm, embeddings, embeddings_store_url=url, username=username, password=password
)

# Streamlit UI
st.set_page_config(
    page_title="Scribe Project",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Initialize session state for user profiles
if 'current_user' not in st.session_state:
    st.session_state.current_user = None

# Helper functions for user management with Neo4j
def hash_password(password):
    return hashlib.sha256(password.encode()).hexdigest()

def user_exists(username):
    result = neo4j_graph.query(
        "MATCH (u:User {username: $username}) RETURN u",
        {"username": username}
    )
    return len(result) > 0

def create_user(username, password):
    hashed_password = hash_password(password)
    created_at = datetime.datetime.now().isoformat()
    neo4j_graph.query(
        """
        CREATE (u:User {
            username: $username,
            password: $password,
            created_at: $created_at
        })
        """,
        {
            "username": username,
            "password": hashed_password,
            "created_at": created_at
        }
    )

def authenticate_user(username, password):
    hashed_password = hash_password(password)
    result = neo4j_graph.query(
        """
        MATCH (u:User {
            username: $username,
            password: $password
        })
        RETURN u
        """,
        {
            "username": username,
            "password": hashed_password
        }
    )
    return len(result) > 0

def get_next_note_id():
    result = neo4j_graph.query(
        "MATCH (n:Note) RETURN MAX(n.id) as max_id"
    )
    if not result or result[0]["max_id"] is None:
        return 0
    return result[0]["max_id"] + 1

def get_next_journal_id():
    result = neo4j_graph.query(
        "MATCH (j:Journal) RETURN MAX(j.id) as max_id"
    )
    if not result or result[0]["max_id"] is None:
        return 0
    return result[0]["max_id"] + 1

def get_user_notes(username):
    result = neo4j_graph.query(
        """
        MATCH (u:User {username: $username})-[r:OWNS]->(n:Note)
        OPTIONAL MATCH (n)-[r2:HAS_TAG]->(t:Tag)
        OPTIONAL MATCH (n)-[r3:BELONGS_TO]->(j:Journal)
        RETURN n, collect(DISTINCT t.name) as tags, j.id as journal_id, j.name as journal_name
        ORDER BY n.updated_at DESC
        """,
        {"username": username}
    )
    
    notes = []
    for record in result:
        note = dict(record["n"])
        
        # Convert media JSON string back to list
        if "media" in note:
            try:
                note["media"] = json.loads(note["media"])
            except:
                note["media"] = []
        else:
            note["media"] = []
        
        # Add tags
        note["tags"] = [tag for tag in record["tags"] if tag is not None]
        
        # Add journal info if exists
        if record["journal_id"] is not None:
            note["journal"] = record["journal_id"]
            note["journal_name"] = record["journal_name"]
        else:
            note["journal"] = None
            note["journal_name"] = None
        
        notes.append(note)
    
    return notes

def get_user_journals(username):
    result = neo4j_graph.query(
        """
        MATCH (u:User {username: $username})-[r:OWNS]->(j:Journal)
        OPTIONAL MATCH (n:Note)-[r2:BELONGS_TO]->(j)
        RETURN j, count(n) as note_count
        ORDER BY j.created_at DESC
        """,
        {"username": username}
    )
    
    journals = []
    for record in result:
        journal = dict(record["j"])
        journal["note_count"] = record["note_count"]
        journals.append(journal)
    
    return journals

def get_note_by_id(note_id, username):
    result = neo4j_graph.query(
        """
        MATCH (u:User {username: $username})-[r:OWNS]->(n:Note {id: $id})
        OPTIONAL MATCH (n)-[r2:HAS_TAG]->(t:Tag)
        OPTIONAL MATCH (n)-[r3:BELONGS_TO]->(j:Journal)
        RETURN n, collect(DISTINCT t.name) as tags, j.id as journal_id, j.name as journal_name
        """,
        {"username": username, "id": note_id}
    )
    
    if not result:
        return None
    
    record = result[0]
    note = dict(record["n"])
    
    # Convert media JSON string back to list
    if "media" in note:
        try:
            note["media"] = json.loads(note["media"])
        except:
            note["media"] = []
    else:
        note["media"] = []
    
    # Add tags
    note["tags"] = [tag for tag in record["tags"] if tag is not None]
    
    # Add journal info if exists
    if record["journal_id"] is not None:
        note["journal"] = record["journal_id"]
        note["journal_name"] = record["journal_name"]
    else:
        note["journal"] = None
        note["journal_name"] = None
    
    return note

def save_note_to_db(note, username):
    # Convert media list to JSON string
    media_json = json.dumps(note.get("media", []))
    
    # Save or update the note
    if get_note_by_id(note["id"], username):
        # Update existing note
        neo4j_graph.query(
            """
            MATCH (u:User {username: $username})-[r:OWNS]->(n:Note {id: $id})
            SET n.title = $title,
                n.content = $content,
                n.updated_at = $updated_at,
                n.media = $media
            
            // Remove old tags
            WITH n
            OPTIONAL MATCH (n)-[r:HAS_TAG]->(:Tag)
            DELETE r
            
            // Remove old journal relationship
            WITH n
            OPTIONAL MATCH (n)-[r:BELONGS_TO]->(:Journal)
            DELETE r
            """,
            {
                "username": username,
                "id": note["id"],
                "title": note["title"],
                "content": note["content"],
                "updated_at": datetime.datetime.now().isoformat(),
                "media": media_json
            }
        )
    else:
        # Create new note
        neo4j_graph.query(
            """
            MATCH (u:User {username: $username})
            CREATE (n:Note {
                id: $id,
                title: $title,
                content: $content,
                created_at: $created_at,
                updated_at: $updated_at,
                media: $media
            })
            CREATE (u)-[r:OWNS]->(n)
            """,
            {
                "username": username,
                "id": note["id"],
                "title": note["title"],
                "content": note["content"],
                "created_at": note.get("created_at", datetime.datetime.now().isoformat()),
                "updated_at": datetime.datetime.now().isoformat(),
                "media": media_json
            }
        )
    
    # Add tags
    for tag in note.get("tags", []):
        if tag:  # Skip empty tags
            neo4j_graph.query(
                """
                MATCH (n:Note {id: $id})
                MERGE (t:Tag {name: $tag})
                MERGE (n)-[r:HAS_TAG]->(t)
                """,
                {"id": note["id"], "tag": tag}
            )
    
    # Add journal relationship if exists
    if note.get("journal") is not None:
        neo4j_graph.query(
            """
            MATCH (n:Note {id: $id})
            MATCH (j:Journal {id: $journal_id})
            MERGE (n)-[r:BELONGS_TO]->(j)
            """,
            {"id": note["id"], "journal_id": note["journal"]}
        )

def delete_note_from_db(note_id, username):
    neo4j_graph.query(
        """
        MATCH (u:User {username: $username})-[r:OWNS]->(n:Note {id: $id})
        OPTIONAL MATCH (n)-[r1:HAS_TAG]->(:Tag)
        OPTIONAL MATCH (n)-[r2:BELONGS_TO]->(:Journal)
        DELETE r, r1, r2, n
        """,
        {"username": username, "id": note_id}
    )

def get_journal_by_id(journal_id, username):
    result = neo4j_graph.query(
        """
        MATCH (u:User {username: $username})-[r:OWNS]->(j:Journal {id: $id})
        OPTIONAL MATCH (n:Note)-[r2:BELONGS_TO]->(j)
        RETURN j, count(n) as note_count
        """,
        {"username": username, "id": journal_id}
    )
    
    if not result:
        return None
    
    record = result[0]
    journal = dict(record["j"])
    journal["note_count"] = record["note_count"]
    
    return journal

def save_journal_to_db(journal, username):
    if get_journal_by_id(journal["id"], username):
        # Update existing journal
        neo4j_graph.query(
            """
            MATCH (u:User {username: $username})-[r:OWNS]->(j:Journal {id: $id})
            SET j.name = $name,
                j.description = $description,
                j.template = $template
            """,
            {
                "username": username,
                "id": journal["id"],
                "name": journal["name"],
                "description": journal.get("description", ""),
                "template": journal.get("template", "")
            }
        )
    else:
        # Create new journal
        neo4j_graph.query(
            """
            MATCH (u:User {username: $username})
            CREATE (j:Journal {
                id: $id,
                name: $name,
                description: $description,
                template: $template,
                created_at: $created_at
            })
            CREATE (u)-[r:OWNS]->(j)
            """,
            {
                "username": username,
                "id": journal["id"],
                "name": journal["name"],
                "description": journal.get("description", ""),
                "template": journal.get("template", ""),
                "created_at": journal.get("created_at", datetime.datetime.now().isoformat())
            }
        )

def delete_journal_from_db(journal_id, username):
    # First, remove all relationships between notes and this journal
    neo4j_graph.query(
        """
        MATCH (n:Note)-[r:BELONGS_TO]->(j:Journal {id: $id})
        DELETE r
        """,
        {"id": journal_id}
    )
    
    # Then delete the journal
    neo4j_graph.query(
        """
        MATCH (u:User {username: $username})-[r:OWNS]->(j:Journal {id: $id})
        DELETE r, j
        """,
        {"username": username, "id": journal_id}
    )

# User authentication functions
def login():
    st.session_state.show_login = True
    st.session_state.show_register = False

def register():
    st.session_state.show_login = False
    st.session_state.show_register = True

def logout():
    st.session_state.current_user = None

def user_management():
    if st.session_state.current_user is None:
        # Use columns with appropriate widths
        col1, col2, col3 = st.columns([1, 1, 4])  # First two columns for buttons, third for spacing
        
        if 'show_login' not in st.session_state:
            st.session_state.show_login = True
        
        if 'show_register' not in st.session_state:
            st.session_state.show_register = False
        
        with col1:
            if st.button("Login", use_container_width=True):
                login()
        
        with col2:
            if st.button("Register", use_container_width=True):
                register()
        
        if st.session_state.show_login:
            with st.form("login_form"):
                st.subheader("Login")
                username = st.text_input("Username")
                password = st.text_input("Password", type="password")
                submit = st.form_submit_button("Login")
                
                if submit:
                    try:
                        if authenticate_user(username, password):
                            st.session_state.current_user = username
                            st.success(f"Welcome back, {username}!")
                            # Add a small delay before rerunning
                            time.sleep(0.5)
                            st.rerun()
                        else:
                            st.error("Invalid username or password")
                    except Exception as e:
                        st.error(f"Login error: {str(e)}")
                        logger.error(f"Login error: {str(e)}")
        
        if st.session_state.show_register:
            with st.form("register_form"):
                st.subheader("Register")
                new_username = st.text_input("Username")
                new_password = st.text_input("Password", type="password")
                confirm_password = st.text_input("Confirm Password", type="password")
                submit = st.form_submit_button("Register")
                
                if submit:
                    if user_exists(new_username):
                        st.error("Username already exists")
                    elif new_password != confirm_password:
                        st.error("Passwords do not match")
                    else:
                        create_user(new_username, new_password)
                        st.success("Registration successful! Please login.")
                        login()
    else:
        # User info layout
        col1, col2 = st.columns([1, 5])  # First column for button, second for spacing
        
        col1.write(f"Logged in as: {st.session_state.current_user}")
        if col1.button("Logout", use_container_width=True):
            logout()
            st.rerun()


# Note management functions
def create_new_note():
    if 'editing_note' not in st.session_state:
        st.session_state.editing_note = {
            "id": get_next_note_id(),
            "title": "",
            "content": "",
            "tags": [],
            "created_at": datetime.datetime.now().isoformat(),
            "updated_at": datetime.datetime.now().isoformat(),
            "journal": None,
            "media": []
        }
    
    st.session_state.note_editor = True


def save_note():
    user = st.session_state.current_user
    
    st.session_state.editing_note["updated_at"] = datetime.datetime.now().isoformat()
    
    save_note_to_db(st.session_state.editing_note, user)
    
    st.session_state.note_editor = False
    del st.session_state.editing_note


def cancel_note():
    st.session_state.note_editor = False
    if 'editing_note' in st.session_state:
        del st.session_state.editing_note


def edit_note(note):
    st.session_state.editing_note = note.copy()
    st.session_state.note_editor = True


def delete_note(note_id):
    user = st.session_state.current_user
    delete_note_from_db(note_id, user)


def add_image_to_note(image):
    if image is not None:
        img = Image.open(image)
        buffered = BytesIO()
        img.save(buffered, format="PNG")
        img_str = base64.b64encode(buffered.getvalue()).decode()
        
        st.session_state.editing_note["media"].append({
            "type": "image",
            "data": img_str,
            "created_at": datetime.datetime.now().isoformat()
        })


def add_audio_to_note(audio):
    if audio is not None:
        audio_bytes = audio.read()
        audio_str = base64.b64encode(audio_bytes).decode()
        
        st.session_state.editing_note["media"].append({
            "type": "audio",
            "data": audio_str,
            "created_at": datetime.datetime.now().isoformat()
        })


# AGNIS functions
def summarize_note(note_content):
    prompt = f"Please summarize the following note concisely:\n\n{note_content}"
    stream_handler = StreamHandler(st.empty())
    result = llm_chain({"question": prompt, "chat_history": []}, callbacks=[stream_handler])["answer"]
    return result


def create_structured_note(note_type):
    templates = {
        "List": "# List Title\n\n- Item 1\n- Item 2\n- Item 3\n\n## Notes\n\n",
        "Meeting": "# Meeting: [Title]\n\nDate: [Date]\nAttendees: [Names]\n\n## Agenda\n\n1. \n2. \n\n## Notes\n\n\n## Action Items\n\n- [ ] Task 1\n- [ ] Task 2\n",
        "Letter": "# Letter\n\n[Your Address]\n[City, State ZIP]\n[Date]\n\n[Recipient Name]\n[Recipient Address]\n[City, State ZIP]\n\nDear [Name],\n\n[Body of letter]\n\nSincerely,\n\n[Your Name]\n",
        "Journal": "# Journal Entry\n\nDate: [Date]\n\n## Today's Highlights\n\n\n## Reflection\n\n\n## Tomorrow's Goals\n\n"
    }
    
    return templates.get(note_type, "# New Note\n\n")


def extract_keywords(note_content):
    prompt = f"""Extract exactly 5 meaningful keywords or key phrases from the following note. 
These should be the most relevant tags that represent the main topics and concepts in the content.
Format your response as a comma-separated list of single words or short phrases.
Make sure your response ENDS with these 5 keywords/phrases separated by commas.

Note content:
{note_content}"""
    
    stream_handler = StreamHandler(st.empty())
    result = llm_chain({"question": prompt, "chat_history": []}, callbacks=[stream_handler])["answer"]
    
    # Extract the last 5 terms from the comma-separated list
    all_terms = [term.strip() for term in result.split(',')]
    
    # Get only the last 5 terms (or fewer if there aren't 5)
    keywords = all_terms[-5:] if len(all_terms) >= 5 else all_terms
    
    return keywords


# Journal management functions
def create_journal():
    if 'editing_journal' not in st.session_state:
        st.session_state.editing_journal = {
            "id": get_next_journal_id(),
            "name": "",
            "description": "",
            "template": "",
            "created_at": datetime.datetime.now().isoformat()
        }
    
    st.session_state.journal_editor = True


def save_journal():
    user = st.session_state.current_user
    
    save_journal_to_db(st.session_state.editing_journal, user)
    
    st.session_state.journal_editor = False
    del st.session_state.editing_journal


def cancel_journal():
    st.session_state.journal_editor = False
    if 'editing_journal' in st.session_state:
        del st.session_state.editing_journal


def edit_journal(journal):
    st.session_state.editing_journal = journal.copy()
    st.session_state.journal_editor = True


def delete_journal(journal_id):
    user = st.session_state.current_user
    delete_journal_from_db(journal_id, user)


# Main application
def main():
    st.title("Scribe Project - AGNIS")
    st.write("Artificial Generative Notation & Indexing System")
    
    # User authentication
    user_management()
    
    if st.session_state.current_user is not None:
        try:
            user = st.session_state.current_user
            
            # Sidebar - AGNIS functions
            with st.sidebar:
                st.header("AGNIS Assistant")
                
                agnis_option = st.radio(
                    "Select AGNIS function:",
                    ["Summarize Note", "Structured Note Creation", "Keyword Extraction"]
                )
                
                if agnis_option == "Summarize Note":
                    if st.session_state.get('note_editor', False) and st.session_state.get('editing_note'):
                        if st.button("Summarize Current Note"):
                            note_content = st.session_state.editing_note.get("content", "")
                            summary = summarize_note(note_content)
                            st.info("Summary:")
                            st.write(summary)
                    else:
                        st.info("Open a note to summarize its content")
                
                elif agnis_option == "Structured Note Creation":
                    note_type = st.selectbox(
                        "Select note template:",
                        ["List", "Meeting", "Letter", "Journal"]
                    )
                    
                    if st.button("Create Template"):
                        template = create_structured_note(note_type)
                        if not st.session_state.get('note_editor', False):
                            create_new_note()
                        st.session_state.editing_note["content"] = template
                        st.rerun()
                
                elif agnis_option == "Keyword Extraction":
                    if st.session_state.get('note_editor', False) and st.session_state.get('editing_note'):
                        col1, col2 = st.columns(2)
                        with col1:
                            if st.button("Extract Keywords"):
                                note_content = st.session_state.editing_note.get("content", "")
                                st.session_state['extracted_keywords'] = extract_keywords(note_content)
                                st.rerun()
                        
                        # Display extracted keywords if available
                        if 'extracted_keywords' in st.session_state and st.session_state['extracted_keywords']:
                            st.info("Suggested Keywords:")
                            st.write(", ".join(st.session_state['extracted_keywords']))
                            
                            with col2:
                                if st.button("Apply Keywords as Tags"):
                                    current_tags = st.session_state.editing_note.get("tags", [])
                                    # Merge tags and remove duplicates
                                    combined_tags = current_tags.copy()
                                    for keyword in st.session_state['extracted_keywords']:
                                        if keyword and keyword not in combined_tags:
                                            combined_tags.append(keyword)
                                    
                                    st.session_state.editing_note["tags"] = combined_tags
                                    # Save to database immediately to persist changes
                                    save_note_to_db(st.session_state.editing_note, st.session_state.current_user)
                                    st.success("Tags applied and saved to database!")
                                    # Clear the extracted keywords to refresh UI
                                    del st.session_state['extracted_keywords']
                                    st.rerun()
                    else:
                        st.info("Open a note to extract keywords")
            
            # Main content area
            if st.session_state.get('note_editor', False) and st.session_state.get('editing_note'):
                # Note editor
                st.header("Note Editor")
                
                note_title = st.text_input("Title", value=st.session_state.editing_note.get("title", ""))
                st.session_state.editing_note["title"] = note_title
                
                note_content = st.text_area(
                    "Content", 
                    value=st.session_state.editing_note.get("content", ""),
                    height=400
                )
                st.session_state.editing_note["content"] = note_content
                
                # Tags
                tags_input = st.text_input(
                    "Tags (comma separated)", 
                    value=", ".join(st.session_state.editing_note.get("tags", []))
                )
                st.session_state.editing_note["tags"] = [tag.strip() for tag in tags_input.split(",") if tag.strip()]
                
                # Journal selection
                journals = get_user_journals(user)
                journal_options = ["None"] + [journal["name"] for journal in journals]
                
                current_journal_id = st.session_state.editing_note.get("journal")
                current_journal_name = "None"
                
                if current_journal_id is not None:
                    for journal in journals:
                        if journal["id"] == current_journal_id:
                            current_journal_name = journal["name"]
                            break
                
                selected_journal = st.selectbox("Journal", options=journal_options, index=journal_options.index(current_journal_name) if current_journal_name in journal_options else 0)
                
                if selected_journal == "None":
                    st.session_state.editing_note["journal"] = None
                else:
                    for journal in journals:
                        if journal["name"] == selected_journal:
                            st.session_state.editing_note["journal"] = journal["id"]
                            break
                
                # Media uploads
                upload_option = st.radio("Add Media", ["None", "Image", "Audio"])
                
                if upload_option == "Image":
                    uploaded_image = st.file_uploader("Upload Image", type=["jpg", "jpeg", "png"])
                    if uploaded_image:
                        add_image_to_note(uploaded_image)
                        st.success("Image added to note")
                
                elif upload_option == "Audio":
                    uploaded_audio = st.file_uploader("Upload Audio", type=["mp3", "wav"])
                    if uploaded_audio:
                        add_audio_to_note(uploaded_audio)
                        st.success("Audio added to note")
                
                # Display existing media
                if st.session_state.editing_note.get("media"):
                    st.subheader("Media Attachments")
                    for i, media in enumerate(st.session_state.editing_note["media"]):
                        if media["type"] == "image":
                            image_data = base64.b64decode(media["data"])
                            st.image(Image.open(BytesIO(image_data)))
                        elif media["type"] == "audio":
                            audio_data = base64.b64decode(media["data"])
                            st.audio(audio_data)
                
                # Note editor buttons (save/cancel)
                col1, col2, col3 = st.columns([1, 1, 4])  # First two columns for buttons, third for spacing
                with col1:
                    if st.button("Save", use_container_width=True):
                        if note_title.strip():
                            save_note()
                            st.rerun()
                        else:
                            st.error("Title is required")
                with col2:
                    if st.button("Cancel", use_container_width=True):
                        cancel_note()
                        st.rerun()
            elif st.session_state.get('journal_editor', False) and st.session_state.get('editing_journal'):
                # Journal editor
                st.header("Journal Editor")
                
                journal_name = st.text_input("Name", value=st.session_state.editing_journal.get("name", ""))
                st.session_state.editing_journal["name"] = journal_name
                
                journal_description = st.text_area(
                    "Description", 
                    value=st.session_state.editing_journal.get("description", "")
                )
                st.session_state.editing_journal["description"] = journal_description
                
                journal_template = st.text_area(
                    "Default Template", 
                    value=st.session_state.editing_journal.get("template", "")
                )
                st.session_state.editing_journal["template"] = journal_template
                
                # Journal editor buttons
                col1, col2, col3 = st.columns([1, 1, 4])  # First two columns for buttons, third for spacing
                with col1:
                    if st.button("Save Journal", use_container_width=True):
                        if journal_name.strip():
                            save_journal()
                            st.rerun()
                        else:
                            st.error("Journal name is required")
                with col2:
                    if st.button("Cancel Journal", use_container_width=True):
                        cancel_journal()
                        st.rerun()
            else:
                # Display tabs for Notes, Journals, and Catalogs
                tab1, tab2, tab3 = st.tabs(["Notes", "Journals", "Catalogs"])
                
                with tab1:
                    st.header("My Notes")
                    if st.button("Create New Note"):
                        create_new_note()
                        st.rerun()
                    
                    user_notes = get_user_notes(user)
                    if user_notes:
                        for note in user_notes:
                            with st.expander(f"{note['title']} - {note.get('updated_at', '')[:10]}"):
                                st.markdown(note.get("content", ""))
                                
                                # Display tags
                                if note.get("tags"):
                                    st.write("Tags: " + ", ".join(note["tags"]))
                                
                                # Display media
                                for media in note.get("media", []):
                                    if media["type"] == "image":
                                        image_data = base64.b64decode(media["data"])
                                        st.image(Image.open(BytesIO(image_data)))
                                    elif media["type"] == "audio":
                                        audio_data = base64.b64decode(media["data"])
                                        st.audio(audio_data)
                                
                                col1, col2 = st.columns(2)
                                with col1:
                                    if st.button("Edit", key=f"edit_{note['id']}"):
                                        edit_note(note)
                                        st.rerun()
                                with col2:
                                    if st.button("Delete", key=f"delete_{note['id']}"):
                                        delete_note(note["id"])
                                        st.rerun()
                    else:
                        st.info("No notes found. Create your first note!")
                
                with tab2:
                    st.header("My Journals")
                    if st.button("Create New Journal"):
                        create_journal()
                        st.rerun()
                    
                    user_journals = get_user_journals(user)
                    if user_journals:
                        for journal in user_journals:
                            with st.expander(f"{journal['name']}"):
                                st.write(f"Description: {journal.get('description', '')}")
                                
                                # Display notes in this journal
                                journal_notes = [
                                    note for note in get_user_notes(user)
                                    if note.get("journal") == journal["id"]
                                ]
                                
                                if journal_notes:
                                    st.write(f"{len(journal_notes)} notes in this journal")
                                    for note in journal_notes:
                                        st.write(f"- {note['title']}")
                                else:
                                    st.info("No notes in this journal yet")
                                
                                col1, col2, col3 = st.columns(3)
                                with col1:
                                    if st.button("Edit", key=f"edit_j_{journal['id']}"):
                                        edit_journal(journal)
                                        st.rerun()
                                with col2:
                                    if st.button("Delete", key=f"delete_j_{journal['id']}"):
                                        delete_journal(journal["id"])
                                        st.rerun()
                                with col3:
                                    if st.button("New Note", key=f"new_note_j_{journal['id']}"):
                                        create_new_note()
                                        st.session_state.editing_note["journal"] = journal["id"]
                                        if journal.get("template"):
                                            st.session_state.editing_note["content"] = journal["template"]
                                        st.rerun()
                    else:
                        st.info("No journals found. Create your first journal!")
                
                with tab3:
                    st.header("Catalogs")
                    search_query = st.text_input("Search notes by keyword, tag, or content")
                    
                    if search_query:
                        # Search in database
                        result = neo4j_graph.query(
                            """
                            MATCH (u:User {username: $username})-[r:OWNS]->(n:Note)
                            WHERE toLower(n.title) CONTAINS toLower($query) OR
                                  toLower(n.content) CONTAINS toLower($query) OR
                                  EXISTS {
                                      MATCH (n)-[r2:HAS_TAG]->(t:Tag)
                                      WHERE toLower(t.name) CONTAINS toLower($query)
                                  }
                            OPTIONAL MATCH (n)-[r3:HAS_TAG]->(t:Tag)
                            RETURN n, collect(distinct t.name) as tags
                            """,
                            {"username": user, "query": search_query}
                        )
                        
                        search_results = []
                        for record in result:
                            note = dict(record["n"])
                            note["tags"] = record["tags"] if record["tags"] else []
                            
                            # Convert media from string to list
                            if "media" in note and isinstance(note["media"], str):
                                try:
                                    note["media"] = json.loads(note["media"])
                                except:
                                    note["media"] = []
                            elif "media" not in note:
                                note["media"] = []
                                
                            search_results.append(note)
                        
                        if search_results:
                            st.write(f"Found {len(search_results)} notes:")
                            for note in search_results:
                                with st.expander(f"{note['title']} - {note.get('updated_at', '')[:10]}"):
                                    st.markdown(note.get("content", ""))
                                    if note.get("tags"):
                                        st.write("Tags: " + ", ".join(note["tags"]))
                                    if st.button("Open", key=f"open_{note['id']}"):
                                        edit_note(note)
                                        st.rerun()
                        else:
                            st.info("No matching notes found")
        except Exception as e:
            st.error(f"Error loading content: {str(e)}")
            logger.error(f"Main UI error: {str(e)}")
            if st.button("Logout and Reset"):
                st.session_state.current_user = None
                st.rerun()


# Run the application
if __name__ == "__main__":
    main()
