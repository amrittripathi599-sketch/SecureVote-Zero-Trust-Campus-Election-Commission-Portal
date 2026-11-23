# SecureVote — Entity-Relationship (ER) Diagram

The following Mermaid ER Diagram models the 5 primary Third Normal Form (3NF) relational tables and the `election_participation` entity, illustrating primary keys (PK), foreign keys (FK), unique constraints, and the zero-trust ballot secrecy decoupling.

```mermaid
erDiagram
    users ||--o{ elections : "creates"
    users ||--o{ candidates : "runs as"
    users ||--o{ election_participation : "participates in"
    users ||--o{ audit_logs : "associated with"

    elections ||--o{ candidates : "has nominated"
    elections ||--o{ election_participation : "records participation"
    elections ||--o{ votes_ledger : "accumulates"

    candidates ||--o{ votes_ledger : "receives"

    users {
        int user_id PK "autoincrement"
        string roll_number UK "institutional roll (e.g. STU001, ADMIN001)"
        string password_hash "bcrypt hashed work factor 12"
        string role "enum: admin, voter"
        boolean has_voted "default false (UI helper flag)"
        string full_name "student or administrator name"
        datetime created_at "creation timestamp"
    }

    elections {
        int election_id PK "autoincrement"
        string title "election title"
        datetime start_time "polling opening"
        datetime end_time "polling deadline"
        string status "enum: draft, open, closed"
        int created_by FK "references users(user_id)"
    }

    candidates {
        int candidate_id PK "autoincrement"
        int election_id FK "references elections(election_id)"
        int user_id FK "references users(user_id)"
        string position "office (e.g. Council President)"
        string slogan "campaign slogan"
        string manifesto_url "cloud/local PDF path"
    }

    votes_ledger {
        int vote_id PK "autoincrement"
        int election_id FK "references elections(election_id)"
        int candidate_id FK "references candidates(candidate_id)"
        datetime timestamp "immutable ballot commit time"
    }

    election_participation {
        int user_id PK, FK "references users(user_id)"
        int election_id PK, FK "references elections(election_id)"
        datetime voted_at "participation timestamp"
    }

    audit_logs {
        int log_id PK "autoincrement"
        int user_id FK "references users(user_id) nullable"
        string action "security event (e.g. auth.login, vote.cast)"
        string status "success or failure"
        datetime timestamp "event timestamp"
        string ip_address "origin IP"
        text details "detailed audit context"
    }
```

---

## Architectural & Zero-Trust Highlights

1. **Strict 3NF Compliance**:
   - Every non-key column depends solely on the primary key, the whole key, and nothing but the key.
   - All foreign keys are indexed for high-performance join resolution.

2. **Decoupled Ballot Secrecy**:
   - `votes_ledger` explicitly omits `user_id`. It is mathematically and relationally impossible to query or reverse-engineer which voter cast a specific ballot.

3. **Multi-Election Participation**:
   - `election_participation` utilizes a composite primary key `(user_id, election_id)` ensuring a student can cast exactly one vote per election while preserving the ability to vote in subsequent elections.

4. **Append-Only Immutability**:
   - `votes_ledger` and `audit_logs` are protected by database engine triggers that raise exceptions on any `UPDATE` or `DELETE` statements.
