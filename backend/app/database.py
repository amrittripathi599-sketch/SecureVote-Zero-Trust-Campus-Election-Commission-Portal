import logging
from sqlalchemy import create_engine, event, text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import declarative_base, sessionmaker

from app.config import settings

logger = logging.getLogger(__name__)

# Configure DB Engine with dialect-specific options
connect_args = {}
engine_kwargs = {}

if settings.DATABASE_URL.startswith("sqlite"):
    connect_args = {"check_same_thread": False}
else:
    engine_kwargs = {"pool_pre_ping": True}

engine = create_engine(
    settings.DATABASE_URL,
    connect_args=connect_args,
    **engine_kwargs
)

# Enable Foreign Key enforcement for SQLite (disabled by default in SQLite)
@event.listens_for(Engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    if settings.DATABASE_URL.startswith("sqlite"):
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


def init_db():
    """Initializes tables and registers triggers."""
    Base.metadata.create_all(bind=engine)
    install_db_triggers(engine)
