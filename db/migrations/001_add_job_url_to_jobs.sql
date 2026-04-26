ALTER TABLE jobs
ADD COLUMN job_url TEXT;

UPDATE jobs
SET job_url = '...'
WHERE job_url IS NULL;

ALTER TABLE jobs
ALTER COLUMN job_url SET NOT NULL;