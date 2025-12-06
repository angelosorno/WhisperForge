"""Database manager for WhisperForge using SQLite."""
import sqlite3
import json
from datetime import datetime
from pathlib import Path
from typing import Optional, List, Dict, Any
from contextlib import contextmanager

from core.config import settings


class DatabaseManager:
    """Manages SQLite database for job history and metadata."""
    
    def __init__(self, db_path: Optional[Path] = None):
        if db_path is None:
            # Store database in project root (parent of backend/)
            backend_dir = Path(__file__).parent.parent
            db_path = backend_dir.parent / "whisperforge.db"
        
        self.db_path = db_path
        
        # Ensure parent directory exists
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        
        self._init_database()
    
    @contextmanager
    def get_connection(self):
        """Context manager for database connections."""
        conn = sqlite3.connect(str(self.db_path))
        conn.row_factory = sqlite3.Row  # Return rows as dictionaries
        try:
            yield conn
            conn.commit()
        except Exception as e:
            conn.rollback()
            raise
        finally:
            conn.close()
    
    def _init_database(self):
        """Initialize database schema."""
        with self.get_connection() as conn:
            conn.executescript("""
                -- Jobs table
                CREATE TABLE IF NOT EXISTS jobs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    job_id TEXT UNIQUE NOT NULL,
                    filename TEXT NOT NULL,
                    file_path TEXT NOT NULL,
                    status TEXT NOT NULL,
                    created_at TIMESTAMP NOT NULL,
                    updated_at TIMESTAMP NOT NULL,
                    completed_at TIMESTAMP,
                    
                    -- Configuration
                    model TEXT NOT NULL,
                    language TEXT NOT NULL,
                    temperature REAL,
                    beam_size INTEGER,
                    normalize_audio BOOLEAN,
                    initial_prompt TEXT,
                    
                    -- Audio metadata
                    audio_duration_sec REAL,
                    audio_duration_hms TEXT,
                    file_size_bytes INTEGER,
                    
                    -- Processing metadata
                    device TEXT,
                    fp16 BOOLEAN,
                    elapsed_sec REAL,
                    elapsed_hms TEXT,
                    rtf REAL,
                    
                    -- Results
                    transcript_path TEXT,
                    transcript_preview TEXT,
                    word_count INTEGER,
                    char_count INTEGER,
                    segment_count INTEGER,
                    
                    -- Error info
                    error_message TEXT,
                    error_traceback TEXT,
                    
                    -- Client info
                    client_ip TEXT,
                    user_agent TEXT
                );
                
                CREATE INDEX IF NOT EXISTS idx_jobs_job_id ON jobs(job_id);
                CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
                CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON jobs(created_at);
                CREATE INDEX IF NOT EXISTS idx_jobs_model ON jobs(model);
                
                -- Translations table
                CREATE TABLE IF NOT EXISTS translations (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    job_id TEXT NOT NULL,
                    target_language TEXT NOT NULL,
                    created_at TIMESTAMP NOT NULL,
                    completed_at TIMESTAMP,
                    
                    -- Files
                    translated_file_path TEXT,
                    comparison_file_path TEXT,
                    bilingual_srt_path TEXT,
                    
                    -- Metadata
                    source_word_count INTEGER,
                    translated_word_count INTEGER,
                    translation_time_sec REAL,
                    translated_preview TEXT,
                    
                    -- Edits
                    edited BOOLEAN DEFAULT 0,
                    last_edited_at TIMESTAMP,
                    edit_count INTEGER DEFAULT 0,
                    
                    FOREIGN KEY (job_id) REFERENCES jobs(job_id),
                    UNIQUE(job_id, target_language)
                );
                
                CREATE INDEX IF NOT EXISTS idx_translations_job_id ON translations(job_id);
                CREATE INDEX IF NOT EXISTS idx_translations_language ON translations(target_language);
                
                -- Progress logs table
                CREATE TABLE IF NOT EXISTS progress_logs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    job_id TEXT NOT NULL,
                    timestamp TIMESTAMP NOT NULL,
                    progress REAL NOT NULL,
                    message TEXT,
                    stage TEXT,
                    
                    FOREIGN KEY (job_id) REFERENCES jobs(job_id)
                );
                
                CREATE INDEX IF NOT EXISTS idx_progress_logs_job_id ON progress_logs(job_id);
                CREATE INDEX IF NOT EXISTS idx_progress_logs_timestamp ON progress_logs(timestamp);
                
                -- System stats table
                CREATE TABLE IF NOT EXISTS system_stats (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    timestamp TIMESTAMP NOT NULL,
                    total_jobs INTEGER,
                    completed_jobs INTEGER,
                    failed_jobs INTEGER,
                    total_translations INTEGER,
                    total_audio_minutes REAL,
                    total_processing_minutes REAL,
                    average_rtf REAL,
                    models_used TEXT,
                    languages_used TEXT
                );
                
                CREATE INDEX IF NOT EXISTS idx_system_stats_timestamp ON system_stats(timestamp);
            """)
        
        print(f"✓ Database initialized at {self.db_path}")
    
    # Job methods
    def create_job(self, job_data: Dict[str, Any]) -> int:
        """Insert new job record."""
        with self.get_connection() as conn:
            cursor = conn.execute("""
                INSERT INTO jobs (
                    job_id, filename, file_path, status, created_at, updated_at,
                    model, language, temperature, beam_size, normalize_audio,
                    initial_prompt, client_ip, user_agent
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                job_data['job_id'],
                job_data['filename'],
                job_data['file_path'],
                job_data['status'],
                job_data['created_at'],
                job_data['updated_at'],
                job_data.get('model'),
                job_data.get('language'),
                job_data.get('temperature'),
                job_data.get('beam_size'),
                job_data.get('normalize_audio'),
                job_data.get('initial_prompt'),
                job_data.get('client_ip'),
                job_data.get('user_agent')
            ))
            return cursor.lastrowid
    
    def update_job(self, job_id: str, updates: Dict[str, Any]):
        """Update job record."""
        if not updates:
            return
        
        # Build dynamic UPDATE query
        set_clause = ", ".join([f"{key} = ?" for key in updates.keys()])
        values = list(updates.values()) + [job_id]
        
        with self.get_connection() as conn:
            conn.execute(
                f"UPDATE jobs SET {set_clause} WHERE job_id = ?",
                values
            )
    
    def get_job(self, job_id: str) -> Optional[Dict]:
        """Get job by ID."""
        with self.get_connection() as conn:
            cursor = conn.execute(
                "SELECT * FROM jobs WHERE job_id = ?",
                (job_id,)
            )
            row = cursor.fetchone()
            return dict(row) if row else None
    
    def list_jobs(self, limit: int = 100, offset: int = 0,
                  status: Optional[str] = None,
                  order_by: str = "created_at DESC") -> List[Dict]:
        """List jobs with pagination and filtering."""
        query = "SELECT * FROM jobs"
        params = []
        
        if status:
            query += " WHERE status = ?"
            params.append(status)
        
        query += f" ORDER BY {order_by} LIMIT ? OFFSET ?"
        params.extend([limit, offset])
        
        with self.get_connection() as conn:
            cursor = conn.execute(query, params)
            return [dict(row) for row in cursor.fetchall()]
    
    def count_jobs(self, status: Optional[str] = None) -> int:
        """Count total jobs."""
        query = "SELECT COUNT(*) FROM jobs"
        params = []
        
        if status:
            query += " WHERE status = ?"
            params.append(status)
        
        with self.get_connection() as conn:
            cursor = conn.execute(query, params)
            return cursor.fetchone()[0]
    
    # Translation methods
    def create_translation(self, translation_data: Dict[str, Any]) -> int:
        """Insert translation record."""
        with self.get_connection() as conn:
            cursor = conn.execute("""
                INSERT INTO translations (
                    job_id, target_language, created_at,
                    translated_file_path, comparison_file_path, bilingual_srt_path,
                    source_word_count, translated_word_count, translation_time_sec,
                    translated_preview
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                translation_data['job_id'],
                translation_data['target_language'],
                translation_data['created_at'],
                translation_data.get('translated_file_path'),
                translation_data.get('comparison_file_path'),
                translation_data.get('bilingual_srt_path'),
                translation_data.get('source_word_count'),
                translation_data.get('translated_word_count'),
                translation_data.get('translation_time_sec'),
                translation_data.get('translated_preview')
            ))
            return cursor.lastrowid
    
    def update_translation(self, job_id: str, language: str, updates: Dict[str, Any]):
        """Update translation record."""
        if not updates:
            return
        
        set_clause = ", ".join([f"{key} = ?" for key in updates.keys()])
        values = list(updates.values()) + [job_id, language]
        
        with self.get_connection() as conn:
            conn.execute(
                f"UPDATE translations SET {set_clause} WHERE job_id = ? AND target_language = ?",
                values
            )
    
    def get_translations(self, job_id: str) -> List[Dict]:
        """Get all translations for a job."""
        with self.get_connection() as conn:
            cursor = conn.execute(
                "SELECT * FROM translations WHERE job_id = ?",
                (job_id,)
            )
            return [dict(row) for row in cursor.fetchall()]
    
    # Progress logging
    def log_progress(self, job_id: str, progress: float, message: str, stage: str):
        """Log progress update."""
        with self.get_connection() as conn:
            conn.execute("""
                INSERT INTO progress_logs (job_id, timestamp, progress, message, stage)
                VALUES (?, ?, ?, ?, ?)
            """, (job_id, datetime.now(), progress, message, stage))
    
    def get_progress_logs(self, job_id: str, limit: int = 100) -> List[Dict]:
        """Get progress logs for a job."""
        with self.get_connection() as conn:
            cursor = conn.execute("""
                SELECT * FROM progress_logs
                WHERE job_id = ?
                ORDER BY timestamp DESC
                LIMIT ?
            """, (job_id, limit))
            return [dict(row) for row in cursor.fetchall()]
    
    # Analytics
    def get_stats(self) -> Dict[str, Any]:
        """Get system statistics."""
        with self.get_connection() as conn:
            # Basic counts
            total_jobs = conn.execute("SELECT COUNT(*) FROM jobs").fetchone()[0]
            completed = conn.execute(
                "SELECT COUNT(*) FROM jobs WHERE status = 'completed'"
            ).fetchone()[0]
            failed = conn.execute(
                "SELECT COUNT(*) FROM jobs WHERE status = 'failed'"
            ).fetchone()[0]
            processing = conn.execute(
                "SELECT COUNT(*) FROM jobs WHERE status = 'processing'"
            ).fetchone()[0]
            total_translations = conn.execute("SELECT COUNT(*) FROM translations").fetchone()[0]
            
            # Audio and processing time
            audio_time = conn.execute(
                "SELECT SUM(audio_duration_sec) FROM jobs WHERE audio_duration_sec IS NOT NULL"
            ).fetchone()[0] or 0
            
            processing_time = conn.execute(
                "SELECT SUM(elapsed_sec) FROM jobs WHERE elapsed_sec IS NOT NULL"
            ).fetchone()[0] or 0
            
            # Average RTF
            avg_rtf = conn.execute(
                "SELECT AVG(rtf) FROM jobs WHERE rtf IS NOT NULL"
            ).fetchone()[0] or 0
            
            # Models distribution
            models = conn.execute("""
                SELECT model, COUNT(*) as count
                FROM jobs
                WHERE model IS NOT NULL
                GROUP BY model
            """).fetchall()
            
            # Languages distribution
            languages = conn.execute("""
                SELECT target_language, COUNT(*) as count
                FROM translations
                GROUP BY target_language
            """).fetchall()
            
            # Jobs by day (last 30 days)
            jobs_by_day = conn.execute("""
                SELECT DATE(created_at) as date, COUNT(*) as count
                FROM jobs
                WHERE created_at >= datetime('now', '-30 days')
                GROUP BY DATE(created_at)
                ORDER BY date DESC
            """).fetchall()
            
            return {
                'total_jobs': total_jobs,
                'completed_jobs': completed,
                'failed_jobs': failed,
                'processing_jobs': processing,
                'total_translations': total_translations,
                'total_audio_minutes': round(audio_time / 60, 2),
                'total_processing_minutes': round(processing_time / 60, 2),
                'average_rtf': round(avg_rtf, 3),
                'models_distribution': [{'model': row[0], 'count': row[1]} for row in models],
                'languages_distribution': [{'language': row[0], 'count': row[1]} for row in languages],
                'jobs_by_day': [{'date': row[0], 'count': row[1]} for row in jobs_by_day]
            }
    
    # Migration
    def migrate_from_json(self, json_path: Path):
        """Migrate existing jobs from jobs_state.json."""
        if not json_path.exists():
            print("ℹ️  No JSON file to migrate")
            return
        
        try:
            with open(json_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            migrated = 0
            for job_data in data.get('jobs', []):
                try:
                    # Check if job already exists
                    existing = self.get_job(job_data['job_id'])
                    if existing:
                        continue
                    
                    # Prepare job data
                    job_dict = {
                        'job_id': job_data['job_id'],
                        'filename': job_data['filename'],
                        'file_path': job_data['file_path'],
                        'status': job_data['status'],
                        'created_at': job_data['created_at'],
                        'updated_at': job_data['updated_at'],
                        'model': job_data['config'].get('model'),
                        'language': job_data['config'].get('language'),
                        'temperature': job_data['config'].get('temperature'),
                        'beam_size': job_data['config'].get('beam_size'),
                        'normalize_audio': job_data['config'].get('normalize_audio'),
                        'initial_prompt': job_data['config'].get('initial_prompt'),
                    }
                    
                    # Add metadata if available
                    if job_data.get('metadata'):
                        meta = job_data['metadata']
                        job_dict.update({
                            'audio_duration_sec': meta.get('audio_duration_sec'),
                            'audio_duration_hms': meta.get('audio_duration_hms'),
                            'device': meta.get('device'),
                            'fp16': meta.get('fp16'),
                            'elapsed_sec': meta.get('elapsed_sec'),
                            'elapsed_hms': meta.get('elapsed_hms'),
                            'rtf': meta.get('rtf'),
                            'word_count': meta.get('words'),
                            'char_count': meta.get('chars'),
                            'segment_count': meta.get('segments'),
                        })
                    
                    # Add error if failed
                    if job_data.get('error'):
                        job_dict['error_message'] = job_data['error']
                    
                    self.create_job(job_dict)
                    migrated += 1
                    
                except Exception as e:
                    print(f"⚠️  Error migrating job {job_data.get('job_id')}: {e}")
                    continue
            
            if migrated > 0:
                print(f"✓ Migrated {migrated} job(s) from JSON to database")
                
                # Backup JSON file
                backup_path = json_path.with_suffix('.json.migrated')
                import shutil
                shutil.copy(json_path, backup_path)
                print(f"📦 Backed up JSON to {backup_path}")
                
        except Exception as e:
            print(f"⚠️  Migration failed: {e}")


# Global database instance
db_manager = DatabaseManager()
