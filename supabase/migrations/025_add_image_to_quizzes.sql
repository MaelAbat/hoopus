-- Add optional image URL to quizzes
alter table quizzes add column if not exists image_url text;
