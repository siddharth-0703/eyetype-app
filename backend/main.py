from fastapi import FastAPI, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import sqlite3
import os
import hashlib
from typing import Optional

# Groq is incredibly fast, allowing real-time LLM prediction
try:
    from groq import Groq
    GROQ_CLIENT = Groq(api_key=os.environ.get("GROQ_API_KEY", "DEMO_KEY"))
except:
    GROQ_CLIENT = None

app = FastAPI(title="EyeType Dynamic AI Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

DATABASE_URL = os.environ.get("DATABASE_URL", "")
DB_FILE = "eyetype_ai.db"

def run_sql(query, params=(), fetch_all=False, fetch_one=False):
    # Ensure Supabase gets SSL if using cloud URL
    uri = DATABASE_URL
    if uri and "sslmode=" not in uri:
        uri += ("&" if "?" in uri else "?") + "sslmode=require"

    try:
        if uri:
            import psycopg2
            conn = psycopg2.connect(uri)
            query = query.replace("?", "%s")
        else:
            conn = sqlite3.connect(DB_FILE)
            
        cursor = conn.cursor()
        cursor.execute(query, params)
        
        result = None
        if fetch_all:
            result = cursor.fetchall()
        elif fetch_one:
            result = cursor.fetchone()
        else:
            conn.commit()
            
        conn.close()
        return result
    except Exception as e:
        print(f"--- DATABASE ERROR ---")
        print(f"Query: {query}")
        print(f"Error: {str(e)}")
        print(f"----------------------")
        return None

def init_db():
    print("Initialising Database...")
    run_sql('''
        CREATE TABLE IF NOT EXISTS users (
            username TEXT PRIMARY KEY,
            password_hash TEXT
        )
    ''')
    
    user_count = run_sql("SELECT COUNT(*) FROM users", fetch_one=True)
    if user_count and user_count[0] == 0:
        run_sql("INSERT INTO users (username, password_hash) VALUES (?, ?)", 
                ("admin", hashlib.sha256("password".encode()).hexdigest()))

    run_sql('''
        CREATE TABLE IF NOT EXISTS ngram_model (
            prev_word TEXT, current_word TEXT, count INTEGER DEFAULT 1,
            PRIMARY KEY (prev_word, current_word)
        )
    ''')
    print("Database Ready.")

@app.on_event("startup")
async def startup_event():
    init_db()

# --- Auth Models ---
class UserLogin(BaseModel):
    username: str
    password: str

@app.post("/login")
def login(data: UserLogin):
    """Verifies user credentials and unlocks Premium tier."""
    if data.username.upper() == "GUEST":
        return {"status": "success", "tier": "GUEST", "token": "GUEST"}

    row = run_sql("SELECT password_hash FROM users WHERE username = ?", (data.username,), fetch_one=True)

    if row and row[0] == hashlib.sha256(data.password.encode()).hexdigest():
        # In a real app we'd use JWTs, for local we just pass back username as token
        return {"status": "success", "tier": "REGISTERED", "token": data.username}
    
    raise HTTPException(status_code=401, detail="Invalid Credentials")

# --- Groq Meta Llama Chatbot ---
class ChatQuery(BaseModel):
    text: str
    token: str

@app.post("/chat_ai")
def ask_ai(query: ChatQuery):
    """Sends the user's typed sentence to Groq for extremely fast processing."""
    if query.token == "GUEST":
        return {"response": "AI Chat is a Premium feature."}
    
    if not GROQ_CLIENT:
        return {"response": "Groq SDK missing on backend. Run pip install groq."}
    
    if os.environ.get("GROQ_API_KEY", "DEMO_KEY") == "DEMO_KEY":
        return {"response": "Waiting for Groq API Key to be configured in your python terminal!"}

    try:
        completion = GROQ_CLIENT.chat.completions.create(
            model="llama3-8b-8192",
            messages=[
                {"role": "system", "content": "You are a helpful, super concise voice assistant. Give extremely short 1-sentence answers because the response will be read aloud via text-to-speech to the user."},
                {"role": "user", "content": query.text}
            ],
            temperature=0.7,
            max_tokens=50,
        )
        return {"response": completion.choices[0].message.content}
    except Exception as e:
        return {"response": f"API Error: {str(e)}"}

# --- Basic N-Gram Engine (Fallback/Guest) ---
class TypedWord(BaseModel):
    prev_word: str
    current_word: str

@app.post("/log")
def log_word(data: TypedWord):
    prev = data.prev_word.strip().upper() or "START"
    curr = data.current_word.strip().upper()
    if not curr: return {"status": "ignored"}
    
    run_sql('''
        INSERT INTO ngram_model (prev_word, current_word, count) 
        VALUES (?, ?, 1) ON CONFLICT(prev_word, current_word) DO UPDATE SET count = ngram_model.count + 1
    ''', (prev, curr))
    return {"status": "trained"}

@app.get("/predict")
def predict_word(prev_word: str = "", prefix: str = "", use_ai: bool = False, token: str = "GUEST"):
    """
    If Premium and use_ai is true, we route to Groq Llama3 for semantic perfection.
    Otherwise we hit local SQLite N-Grams for speed.
    """
    prefix = prefix.strip().upper()
    
    # In a full production we'd do Async Groq API requests here for prediction,
    # but to ensure UI typing speed doesn't lag (if ping > 500ms), 
    # we'll stick to SQLite N-grams for primary typing prediction, reserving Groq for full Chats.
    
    prev_word = prev_word.strip().upper() or "START"
    query_results = run_sql('''
        SELECT current_word FROM ngram_model 
        WHERE prev_word = ? AND current_word LIKE ?
        ORDER BY count DESC LIMIT 3
    ''', (prev_word, prefix + '%'), fetch_all=True)
    
    results = [row[0] for row in query_results]
    
    if len(results) < 3:
        needed = 3 - len(results)
        placeholders = ','.join(['?']*len(results))
        query = f'''
            SELECT current_word FROM ngram_model 
            WHERE current_word LIKE ? {f"AND current_word NOT IN ({placeholders})" if results else ""}
            GROUP BY current_word ORDER BY SUM(count) DESC LIMIT ?
        '''
        params = [prefix + '%'] + results + [needed]
        query_results = run_sql(query, params, fetch_all=True)
        results.extend([row[0] for row in query_results])
    return {"suggestions": results}
