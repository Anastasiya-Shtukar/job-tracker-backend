CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

INSERT INTO users (email, password_hash)
VALUES ('test@example.com', 'temporary_hash_for_existing_jobs');

ALTER TABLE jobs
ADD COLUMN user_id INTEGER REFERENCES users(id);

UPDATE jobs
SET user_id = (
  SELECT id FROM users WHERE email = 'test@example.com'
)
WHERE user_id IS NULL;

ALTER TABLE jobs
ALTER COLUMN user_id SET NOT NULL;