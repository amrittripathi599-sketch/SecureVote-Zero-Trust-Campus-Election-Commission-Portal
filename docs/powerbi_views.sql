-- =============================================================================
-- SecureVote — Power BI Analytical SQL Views
-- Designed for direct connection from Power BI, Tableau, or Metabase
-- Compatible with both PostgreSQL and SQLite
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. VIEW: Turnout Summary by Election
-- Summarizes overall turnout metrics, total eligible voters, and completion rate
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_turnout_by_election AS
SELECT
    e.election_id,
    e.title AS election_title,
    e.status AS election_status,
    e.start_time,
    e.end_time,
    (SELECT COUNT(*) FROM users u WHERE u.role = 'voter') AS total_eligible_voters,
    COUNT(ep.user_id) AS total_ballots_cast,
    ROUND(
        (COUNT(ep.user_id) * 100.0) / 
        NULLIF((SELECT COUNT(*) FROM users u WHERE u.role = 'voter'), 0),
        2
    ) AS turnout_percentage
FROM
    elections e
LEFT JOIN
    election_participation ep ON e.election_id = ep.election_id
GROUP BY
    e.election_id,
    e.title,
    e.status,
    e.start_time,
    e.end_time;


-- -----------------------------------------------------------------------------
-- 2. VIEW: Certified Votes Tally by Candidate
-- Anonymous aggregate tally of votes cast per candidate.
-- ZERO-TRUST PRIVACY: Queries votes_ledger without exposing any voter identities.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_votes_by_candidate AS
SELECT
    e.election_id,
    e.title AS election_title,
    c.candidate_id,
    u.full_name AS candidate_name,
    u.roll_number AS candidate_roll_number,
    c.position,
    c.slogan,
    COUNT(v.vote_id) AS total_votes_received,
    ROUND(
        (COUNT(v.vote_id) * 100.0) / 
        NULLIF((SELECT COUNT(*) FROM votes_ledger vl WHERE vl.election_id = e.election_id), 0),
        2
    ) AS vote_share_percentage
FROM
    candidates c
JOIN
    elections e ON c.election_id = e.election_id
JOIN
    users u ON c.user_id = u.user_id
LEFT JOIN
    votes_ledger v ON c.candidate_id = v.candidate_id AND c.election_id = v.election_id
GROUP BY
    e.election_id,
    e.title,
    c.candidate_id,
    u.full_name,
    u.roll_number,
    c.position,
    c.slogan;


-- -----------------------------------------------------------------------------
-- 3. VIEW: Security & Audit Event Summary
-- Aggregates security events by action and outcome for compliance dashboards
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_security_audit_summary AS
SELECT
    a.action,
    a.status,
    COUNT(a.log_id) AS total_events,
    MIN(a.timestamp) AS first_event_time,
    MAX(a.timestamp) AS latest_event_time,
    COUNT(DISTINCT a.ip_address) AS distinct_ip_sources
FROM
    audit_logs a
GROUP BY
    a.action,
    a.status;


-- -----------------------------------------------------------------------------
-- 4. VIEW: Student Voter Participation Status
-- Shows which registered students have fulfilled their civic voting duty
-- ZERO-TRUST PRIVACY: Displays participation flag ONLY; NO candidate information is revealed.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_voter_participation_status AS
SELECT
    u.user_id,
    u.roll_number,
    u.full_name,
    e.election_id,
    e.title AS election_title,
    CASE 
        WHEN ep.user_id IS NOT NULL THEN 'Voted'
        ELSE 'Not Voted'
    END AS participation_status,
    ep.voted_at AS timestamp_recorded
FROM
    users u
CROSS JOIN
    elections e
LEFT JOIN
    election_participation ep ON u.user_id = ep.user_id AND e.election_id = ep.election_id
WHERE
    u.role = 'voter';
