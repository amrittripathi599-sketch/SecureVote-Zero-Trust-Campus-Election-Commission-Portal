# SecureVote — System Architecture & Zero-Trust Design

## 1. Executive Summary & Zero-Trust Philosophy
**SecureVote** is a production-grade campus election and audit portal designed for modern institutional governance. Traditional voting applications rely on implicit perimeter trust, where internal application components or database tables maintain direct links between a voter's identity and their ballot. SecureVote fundamentally rejects this model by enforcing **Zero-Trust Principles**:

1. **Verify Explicitly**: Every API request is authenticated and authorized via cryptographically signed JWT access tokens with short lifetimes (60 minutes).
2. **Least-Privilege Role-Based Access Control (RBAC)**: Voters are strictly prohibited from administrative operations, receiving HTTP 403 Forbidden.
3. **Assume Breach & Preserve Privacy**: The database schema physically decouples identity from election choice in Third Normal Form (3NF).
4. **Append-Only Immutability**: Critical data tables (`votes_ledger` and `audit_logs`) are protected by native database engine triggers that abort `UPDATE` and `DELETE` queries at the database kernel level.

---

## 2. Third Normal Form (3NF) Database Architecture

The relational schema is decomposed into 5 primary entities plus an election-scoped participation mapping, achieving strict 3NF compliance (every non-key attribute is non-transitively dependent on the primary key alone):

```
+-----------------------------------------------------------------------------------+
|                                  SCHEMA ENTITIES                                  |
+-----------------------------------------------------------------------------------+
|  1. users: Authentication, institutional roll numbers, roles, and UI status      |
|  2. elections: Poll timelines, status lifecycle (draft/open/closed), and creators|
|  3. candidates: Nominated students, offices, slogans, and certified manifestos   |
|  4. votes_ledger: Anonymized immutable ballots (NO user_id column)               |
|  5. audit_logs: Tamper-evident trail of all logins, submissions, and anomalies    |
|  6. election_participation: Scope-specific multi-election participation record   |
+-----------------------------------------------------------------------------------+
```

### Why the `election_participation` Table is Essential
The legacy `users.has_voted` column represents a singular global boolean. While sufficient for single-election campus demonstrations, relying on a global column in multi-election academic institutions violates relational integrity:
- A student who voted in the "Student Council 2026" election would be permanently blocked from voting in a subsequent "Engineering Senate 2026" or "Hostel Mess Committee" election.
- Storing multiple booleans on the `users` table would violate First Normal Form (repeating groups) and Second Normal Form.

To preserve strict multi-election correctness while upholding ballot secrecy, SecureVote implements the `election_participation` table:
```sql
CREATE TABLE election_participation (
    user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
    election_id INTEGER NOT NULL REFERENCES elections(election_id) ON DELETE RESTRICT,
    voted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, election_id)
);
```
- **Source of Truth**: `election_participation` serves as the cryptographic source of truth for one-person-one-vote enforcement across multiple concurrent or sequential elections.
- **UI Backward Compatibility**: `users.has_voted` is synchronized during the vote transaction for quick demo UI status indicators, but all transactional validations query `election_participation`.

---

## 3. Cryptographic Ballot Secrecy (Zero-Trust Severing)

Traditional systems often store `votes(user_id, candidate_id)`. Even if an application promises not to display `user_id`, a database administrator, compromised service account, or SQL injection vulnerability could deanonymize votes.

### SecureVote Solution:
The `votes_ledger` table explicitly contains **NO `user_id` column**:
```sql
CREATE TABLE votes_ledger (
    vote_id INTEGER PRIMARY KEY AUTOINCREMENT,
    election_id INTEGER NOT NULL REFERENCES elections(election_id),
    candidate_id INTEGER NOT NULL REFERENCES candidates(candidate_id),
    timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```
- **Physical Decoupling**: Voter identity is severed from candidate choice at the relational algebra level.
- **Participation vs Choice**: The system records **THAT** a student voted (in `election_participation`), but **NOT WHO** they voted for (in `votes_ledger`).
- **Anonymity Preserved in Transit & Storage**: Confirmation responses never return candidate metadata, ensuring browser screens, network proxies, and server logs leak zero voter intent.

---

## 4. The Atomic Cast-Vote Transaction (`services/voting.py`)

A vote submission must satisfy ACID guarantees (Atomicity, Consistency, Isolation, Durability) to eliminate TOCTOU (Time-of-Check to Time-of-Use) race conditions and prevent partial writes.

### Step-by-Step Transaction Pipeline
1. **Concurrency Control & Locking**:
   - On **PostgreSQL**, the student's user row is locked using `SELECT ... FOR UPDATE` to serialize concurrent requests from identical student accounts.
   - On **SQLite**, the session utilizes immediate exclusive locking boundaries.
2. **Timeline & State Guard**:
   - Verifies the election exists, status is `open`, and current timestamp satisfies `start_time <= now <= end_time`.
3. **Double-Vote Defense (409 Conflict)**:
   - Queries `election_participation` for `(user_id, election_id)`. If present, immediately rejects with HTTP 409 Conflict.
4. **Candidate Certification**:
   - Confirms that the target candidate ID is legitimately registered in the specified election ID.
5. **Ledger Commit (Anonymous)**:
   - Inserts `(election_id, candidate_id, timestamp)` into `votes_ledger` with zero user identification.
6. **Participation & Flag Update**:
   - Inserts `(user_id, election_id, voted_at)` into `election_participation` and sets `users.has_voted = true`.
7. **Success Audit Logging**:
   - Records a successful `vote.cast` event in `audit_logs`.
8. **Atomic Commit or Autonomous Rollback**:
   - Steps 5, 6, and 7 are committed together.
   - If any step fails or an unexpected exception occurs, `db.rollback()` guarantees zero phantom votes or corrupted user states remain.
   - An isolated autonomous transaction logs a `failure` audit log with the failure reason and client IP address.

---

## 5. Kernel-Level Ledger Immutability (Database Triggers)

Zero-trust architecture mandates that even administrative database users cannot tamper with historical voting ledgers or audit logs without detection. SecureVote enforces immutability via database engine triggers:

### PostgreSQL Triggers:
```sql
CREATE OR REPLACE FUNCTION prevent_immutable_table_modification()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'ZERO-TRUST VIOLATION: Table % is append-only and strictly immutable. % operation forbidden.', TG_TABLE_NAME, TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_votes_ledger_immutable
BEFORE UPDATE OR DELETE ON votes_ledger
FOR EACH ROW EXECUTE FUNCTION prevent_immutable_table_modification();

CREATE TRIGGER trg_audit_logs_immutable
BEFORE UPDATE OR DELETE ON audit_logs
FOR EACH ROW EXECUTE FUNCTION prevent_immutable_table_modification();
```

### SQLite Triggers:
```sql
CREATE TRIGGER IF NOT EXISTS trg_votes_ledger_no_update
BEFORE UPDATE ON votes_ledger
BEGIN
    SELECT RAISE(ABORT, 'ZERO-TRUST VIOLATION: votes_ledger is immutable. UPDATE is forbidden.');
END;

CREATE TRIGGER IF NOT EXISTS trg_votes_ledger_no_delete
BEFORE DELETE ON votes_ledger
BEGIN
    SELECT RAISE(ABORT, 'ZERO-TRUST VIOLATION: votes_ledger is immutable. DELETE is forbidden.');
END;

CREATE TRIGGER IF NOT EXISTS trg_audit_logs_no_update
BEFORE UPDATE ON audit_logs
BEGIN
    SELECT RAISE(ABORT, 'ZERO-TRUST VIOLATION: audit_logs is immutable. UPDATE is forbidden.');
END;

CREATE TRIGGER IF NOT EXISTS trg_audit_logs_no_delete
BEFORE DELETE ON audit_logs
BEGIN
    SELECT RAISE(ABORT, 'ZERO-TRUST VIOLATION: audit_logs is immutable. DELETE is forbidden.');
END;
```

---

## 6. Storage Service Architecture (Cloud & Local Fallback)

Candidate PDF manifestos are managed through the abstract interface `StorageService` (`app/services/storage.py`):
```
                      +----------------------+
                      |    StorageService    |
                      +----------------------+
                                 |
                 +---------------+---------------+
                 |                               |
                 v                               v
    +------------------------+      +-------------------------+
    | AzureBlobStorageService |      |   LocalStorageService   |
    | (azure-storage-blob)   |      |  (Offline /dev sandbox) |
    +------------------------+      +-------------------------+
```

### Zero-Trust File Upload Verification:
1. **File Size Check**: Uploads strictly capped at 5 MB (HTTP 413 if exceeded).
2. **File Extension Check**: Restricted to `.pdf`.
3. **Magic Byte Signature Inspection**: Inspects the binary payload header to confirm it starts with the valid PDF magic byte signature (`%PDF-`). Malicious executables or polyglot files disguised as `.pdf` are rejected with HTTP 400.
