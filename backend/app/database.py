import logging
from sqlalchemy import create_engine, event, text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import declarative_base, sessionmaker

from app.config import settings

logger = logging.getLogger(__name__)

# Normalize database URL for SQLAlchemy 2.0 (e.g. postgres:// -> postgresql://)
db_url = settings.DATABASE_URL
if db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql://", 1)

# Configure DB Engine with dialect-specific options
connect_args = {}
engine_kwargs = {}

if db_url.startswith("sqlite"):
    connect_args = {"check_same_thread": False}
else:
    engine_kwargs = {
        "pool_pre_ping": True,
        "pool_size": 10,
        "max_overflow": 20,
    }

engine = create_engine(
    db_url,
    connect_args=connect_args,
    **engine_kwargs
)

# Enable Foreign Key enforcement for SQLite (disabled by default in SQLite)
@event.listens_for(Engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    if db_url.startswith("sqlite"):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    """Dependency yield for database session with automatic closure."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def install_db_triggers(target_engine=None):
    """
    Installs zero-trust immutability triggers on votes_ledger and audit_logs.
    Supports both SQLite and PostgreSQL dialects cleanly.
    """
    eng = target_engine or engine
    dialect = eng.dialect.name

    with eng.connect() as conn:
        if dialect == "sqlite":
            logger.info("Installing SQLite immutability triggers for votes_ledger and audit_logs...")
            conn.execute(text("""
                CREATE TRIGGER IF NOT EXISTS trg_votes_ledger_no_update
                BEFORE UPDATE ON votes_ledger
                BEGIN
                    SELECT RAISE(ABORT, 'ZERO-TRUST VIOLATION: votes_ledger is immutable. UPDATE is forbidden.');
                END;
            """))
            conn.execute(text("""
                CREATE TRIGGER IF NOT EXISTS trg_votes_ledger_no_delete
                BEFORE DELETE ON votes_ledger
                BEGIN
                    SELECT RAISE(ABORT, 'ZERO-TRUST VIOLATION: votes_ledger is immutable. DELETE is forbidden.');
                END;
            """))
            conn.execute(text("""
                CREATE TRIGGER IF NOT EXISTS trg_audit_logs_no_update
                BEFORE UPDATE ON audit_logs
                BEGIN
                    SELECT RAISE(ABORT, 'ZERO-TRUST VIOLATION: audit_logs is immutable. UPDATE is forbidden.');
                END;
            """))
            conn.execute(text("""
                CREATE TRIGGER IF NOT EXISTS trg_audit_logs_no_delete
                BEFORE DELETE ON audit_logs
                BEGIN
                    SELECT RAISE(ABORT, 'ZERO-TRUST VIOLATION: audit_logs is immutable. DELETE is forbidden.');
                END;
            """))
            conn.commit()

        elif dialect == "postgresql":
            logger.info("Installing PostgreSQL immutability function and triggers...")
            conn.execute(text("""
                CREATE OR REPLACE FUNCTION prevent_immutable_table_modification()
                RETURNS TRIGGER AS $$
                BEGIN
                    RAISE EXCEPTION 'ZERO-TRUST VIOLATION: Table % is append-only and strictly immutable. % operation forbidden.', TG_TABLE_NAME, TG_OP;
                END;
                $$ LANGUAGE plpgsql;
            """))
            conn.execute(text("""
                DROP TRIGGER IF EXISTS trg_votes_ledger_immutable ON votes_ledger;
                CREATE TRIGGER trg_votes_ledger_immutable
                BEFORE UPDATE OR DELETE ON votes_ledger
                FOR EACH ROW EXECUTE FUNCTION prevent_immutable_table_modification();
            """))
            conn.execute(text("""
                DROP TRIGGER IF EXISTS trg_audit_logs_immutable ON audit_logs;
                CREATE TRIGGER trg_audit_logs_immutable
                BEFORE UPDATE OR DELETE ON audit_logs
                FOR EACH ROW EXECUTE FUNCTION prevent_immutable_table_modification();
            """))
            conn.commit()


def check_and_migrate_db(target_engine=None):
    """
    Applies schema migrations dynamically for SQLite and PostgreSQL.
    Ensures 'declared_at' and 'winner_candidate_id' columns exist on 'elections'.
    """
    eng = target_engine or engine
    dialect = eng.dialect.name
    with eng.connect() as conn:
        if dialect == "sqlite":
            res = conn.execute(text("PRAGMA table_info(elections)")).fetchall()
            col_names = [r[1] for r in res]
            if col_names:  # table exists
                if "declared_at" not in col_names:
                    logger.info("Migrating SQLite: Adding declared_at to elections")
                    conn.execute(text("ALTER TABLE elections ADD COLUMN declared_at DATETIME"))
                if "winner_candidate_id" not in col_names:
                    logger.info("Migrating SQLite: Adding winner_candidate_id to elections")
                    conn.execute(text("ALTER TABLE elections ADD COLUMN winner_candidate_id INTEGER REFERENCES candidates(candidate_id)"))
                conn.commit()
        elif dialect == "postgresql":
            conn.execute(text("ALTER TABLE elections ADD COLUMN IF NOT EXISTS declared_at TIMESTAMP"))
            conn.execute(text("ALTER TABLE elections ADD COLUMN IF NOT EXISTS winner_candidate_id INTEGER REFERENCES candidates(candidate_id)"))
            conn.commit()


def init_db(target_engine=None):
    """Initializes tables, performs schema migrations, and registers triggers."""
    eng = target_engine or engine
    Base.metadata.create_all(bind=eng)
    check_and_migrate_db(eng)
    install_db_triggers(eng)
