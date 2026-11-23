# SecureVote — REST API Specification

All authenticated endpoints require an `Authorization: Bearer <JWT_TOKEN>` header.
Standard error responses adhere to the RFC 7807 problem detail format `{"detail": "..."}`.

---

## 1. Authentication Endpoints

### 1.1 User Login
Authenticates students and election officers, enforcing brute-force rate limiting (maximum 5 failed attempts per roll number in a 10-minute sliding window).

- **Method**: `POST`
- **Route**: `/api/auth/login`
- **Auth**: None (Public)
- **Request Body**:
```json
{
  "roll_number": "STU001",
  "password": "Voter@123"
}
```
- **Responses**:
  - `200 OK`:
  ```json
  {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "token_type": "bearer",
    "user": {
      "roll_number": "STU001",
      "full_name": "Aarav Sharma",
      "user_id": 2,
      "role": "voter",
      "has_voted": false,
      "created_at": "2026-11-23T11:34:00"
    }
  }
  ```
  - `401 Unauthorized`:
  ```json
  {
    "detail": "Invalid roll number or password."
  }
  ```
  - `429 Too Many Requests`:
  ```json
  {
    "detail": "Zero-trust alert: Excessive failed login attempts for roll number 'STU001'. Account is temporarily throttled. Please try again after 10 minutes."
  }
  ```

---

### 1.2 Get Current Authenticated Profile
Resolves the currently signed-in user without exposing password hashes.

- **Method**: `GET`
- **Route**: `/api/auth/me`
- **Auth**: Bearer Token (All Roles)
- **Response**:
  - `200 OK`:
  ```json
  {
    "roll_number": "STU001",
    "full_name": "Aarav Sharma",
    "user_id": 2,
    "role": "voter",
    "has_voted": false,
    "created_at": "2026-11-23T11:34:00"
  }
  ```

---

## 2. Elections Endpoints

### 2.1 List All Elections
Returns all campus polls with live candidate counts and user-specific voting status.

- **Method**: `GET`
- **Route**: `/api/elections`
- **Auth**: Bearer Token (All Roles)
- **Response**:
  - `200 OK`:
  ```json
  [
    {
      "election_id": 1,
      "title": "Student Council 2026",
      "start_time": "2026-11-22T00:00:00",
      "end_time": "2026-11-30T23:59:59",
      "status": "open",
      "created_by": 1,
      "candidate_count": 3,
      "has_current_user_voted": false
    }
  ]
  ```

---

### 2.2 Get Election Detail
Retrieves detailed timeline and state for a single election.

- **Method**: `GET`
- **Route**: `/api/elections/{election_id}`
- **Auth**: Bearer Token (All Roles)
- **Response**:
  - `200 OK`:
  ```json
  {
    "election_id": 1,
    "title": "Student Council 2026",
    "start_time": "2026-11-22T00:00:00",
    "end_time": "2026-11-30T23:59:59",
    "status": "open",
    "created_by": 1,
    "candidate_count": 3,
    "has_current_user_voted": false
  }
  ```
  - `404 Not Found`:
  ```json
  {
    "detail": "Election ID 999 not found."
  }
  ```

---

## 3. Candidate Endpoints

### 3.1 Get Election Candidates
Lists nominated candidates for an election with position, slogan, and manifesto link.

- **Method**: `GET`
- **Route**: `/api/elections/{election_id}/candidates`
- **Auth**: Bearer Token (All Roles)
- **Response**:
  - `200 OK`:
  ```json
  [
    {
      "candidate_id": 1,
      "election_id": 1,
      "user_id": 2,
      "full_name": "Aarav Sharma",
      "roll_number": "STU001",
      "position": "Council President",
      "slogan": "Progress through Transparency and Student Empowerment",
      "manifesto_url": "/uploads/manifesto_aarav_sharma.pdf"
    }
  ]
  ```

---

## 4. Voting Endpoints (Zero-Trust Ballot Secrecy)

### 4.1 Cast Ballot (Voters Only)
Executes the atomic vote transaction. Locks user row, checks timeline, inserts anonymous vote, updates participation, and records audit row in one transaction.

- **Method**: `POST`
- **Route**: `/api/votes`
- **Auth**: Bearer Token (`role: "voter"` only)
- **Request Body**:
```json
{
  "election_id": 1,
  "candidate_id": 1
}
```
- **Responses**:
  - `200 OK`: (Zero voter or candidate metadata leaked)
  ```json
  {
    "success": true,
    "message": "Your vote has been securely, anonymously, and immutably recorded.",
    "timestamp": "2026-11-23T11:45:00.123456"
  }
  ```
  - `403 Forbidden`: (If called by an administrator)
  ```json
  {
    "detail": "Only registered voters may cast ballots."
  }
  ```
  - `409 Conflict`: (If student already participated)
  ```json
  {
    "detail": "Zero-Trust Enforced: You have already participated and cast a ballot in this election."
  }
  ```
  - `400 Bad Request`: (If election is closed or outside timeline)
  ```json
  {
    "detail": "Election is not currently open for voting (current status: 'closed')."
  }
  ```

---

### 4.2 Check Voting Participation Status
Returns whether the caller has cast a ballot in the specified election.

- **Method**: `GET`
- **Route**: `/api/votes/status/{election_id}`
- **Auth**: Bearer Token (All Roles)
- **Response**:
  - `200 OK`: (Reveals ONLY a boolean status, NEVER the candidate chosen)
  ```json
  {
    "election_id": 1,
    "has_voted": true
  }
  ```

---

## 5. Administrative Endpoints (RBAC Enforced)

All endpoints in this section strictly require `role: "admin"`. Non-admin requests receive `403 Forbidden`.

### 5.1 Create Election
- **Method**: `POST`
- **Route**: `/api/admin/elections`
- **Request Body**:
```json
{
  "title": "Computer Science Faculty Senate 2026",
  "start_time": "2026-12-01T09:00:00Z",
  "end_time": "2026-12-05T17:00:00Z",
  "status": "draft"
}
```
- **Response**: `200 OK`

---

### 5.2 Update Election Status or Timeline
- **Method**: `PATCH`
- **Route**: `/api/admin/elections/{election_id}`
- **Request Body**:
```json
{
  "status": "open"
}
```
- **Response**: `200 OK`

---

### 5.3 Add Candidate
- **Method**: `POST`
- **Route**: `/api/admin/candidates`
- **Request Body**:
```json
{
  "election_id": 1,
  "user_id": 4,
  "position": "Treasurer",
  "slogan": "Fiscal Integrity & Club Grants"
}
```
- **Response**: `200 OK`
- **Errors**: `409 Conflict` if candidate is already nominated in this election.

---

### 5.4 Upload Candidate Manifesto PDF
Uploads manifesto to Azure Blob Storage (or local storage). Enforces 5 MB limit, `.pdf` extension, and `%PDF-` magic byte inspection.

- **Method**: `POST`
- **Route**: `/api/admin/candidates/{candidate_id}/manifesto`
- **Content-Type**: `multipart/form-data`
- **Form Field**: `file` (Binary PDF document)
- **Responses**:
  - `200 OK`:
  ```json
  {
    "candidate_id": 1,
    "election_id": 1,
    "user_id": 2,
    "full_name": "Aarav Sharma",
    "roll_number": "STU001",
    "position": "Council President",
    "slogan": "Progress through Transparency",
    "manifesto_url": "/uploads/manifesto_3a91b2c4_Aarav_Manifesto.pdf"
  }
  ```
  - `400 Bad Request`: (If magic byte check fails)
  ```json
  {
    "detail": "Content inspection failed: File header does not match genuine PDF magic signature (%PDF-)."
  }
  ```
  - `413 Payload Too Large`: (If file exceeds 5 MB)

---

### 5.5 List Audit Logs (Paginated & Filterable)
- **Method**: `GET`
- **Route**: `/api/admin/audit-logs?page=1&page_size=20&action=vote.cast&status=success`
- **Response**:
  - `200 OK`:
  ```json
  {
    "total": 42,
    "page": 1,
    "page_size": 20,
    "items": [
      {
        "log_id": 105,
        "user_id": 2,
        "roll_number": "STU001",
        "action": "vote.cast",
        "status": "success",
        "timestamp": "2026-11-23T11:45:00",
        "ip_address": "127.0.0.1",
        "details": "Ballot successfully cast in election_id=1"
      }
    ]
  }
  ```

---

### 5.6 List Registered Users
- **Method**: `GET`
- **Route**: `/api/admin/users`
- **Response**:
  - `200 OK`: (Confirms `password_hash` is stripped)
  ```json
  [
    {
      "roll_number": "ADMIN001",
      "full_name": "Mr. Amrit Tripathi",
      "user_id": 1,
      "role": "admin",
      "has_voted": false,
      "created_at": "2026-11-23T11:34:00"
    }
  ]
  ```

---

### 5.7 Declare Election Result
Finalizes the election, closes voting permanently in an atomic database transaction, tallies candidate votes from the anonymous `votes_ledger`, persists certified results (`declared_at`, `winner_candidate_id`), and logs an immutable audit event (`declare_result`).

- **Method**: `POST`
- **Route**: `/api/admin/elections/{election_id}/declare-result`
- **Auth**: Bearer Token (`role: "admin"` only)
- **Responses**:
  - `200 OK`:
  ```json
  {
    "election_id": 1,
    "title": "Student Council 2026",
    "status": "closed",
    "declared_at": "2026-11-23T12:00:00",
    "winner": {
      "candidate_id": 1,
      "candidate_name": "Aarav Sharma",
      "position": "Council President",
      "votes_count": 2
    },
    "candidate_tallies": [
      {
        "candidate_id": 1,
        "candidate_name": "Aarav Sharma",
        "roll_number": "STU001",
        "position": "Council President",
        "slogan": "Progress through Transparency",
        "votes_count": 2
      },
      {
        "candidate_id": 2,
        "candidate_name": "Bhavna Patel",
        "roll_number": "STU002",
        "position": "Vice President",
        "slogan": "Innovation and Inclusivity",
        "votes_count": 1
      }
    ],
    "total_eligible_voters": 5,
    "total_voted": 3,
    "turnout_percentage": 60.0
  }
  ```
  - `403 Forbidden`: If called by a voter or unauthenticated caller.
  - `404 Not Found`: If `election_id` does not exist.
  - `409 Conflict`: If results have already been declared (`{"detail": "Result already declared."}`).

---

## 6. Analytics Endpoints

### 6.1 Get Turnout & Aggregate Candidate Tallies
- **Method**: `GET`
- **Route**: `/api/analytics/turnout/{election_id}`
- **Auth**: Bearer Token (`role: "admin"` only)
- **Response**:
  - `200 OK`:
  ```json
  {
    "election_id": 1,
    "election_title": "Student Council 2026",
    "status": "open",
    "total_eligible_voters": 5,
    "total_voted": 3,
    "turnout_percentage": 60.0,
    "candidate_tallies": [
      {
        "candidate_id": 1,
        "candidate_name": "Aarav Sharma",
        "roll_number": "STU001",
        "position": "Council President",
        "slogan": "Progress through Transparency",
        "votes_count": 2
      },
      {
        "candidate_id": 2,
        "candidate_name": "Bhavna Patel",
        "roll_number": "STU002",
        "position": "Vice President",
        "slogan": "Innovation and Inclusivity",
        "votes_count": 1
      }
    ]
  }
  ```
