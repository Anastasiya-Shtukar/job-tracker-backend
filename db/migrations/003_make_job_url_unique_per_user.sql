ALTER TABLE jobs
DROP CONSTRAINT IF EXISTS jobs_job_url_unique;

ALTER TABLE jobs
ADD CONSTRAINT jobs_user_id_job_url_key
UNIQUE (user_id, job_url);