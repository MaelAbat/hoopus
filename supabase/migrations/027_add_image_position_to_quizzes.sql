-- Add image focal position to quizzes (top, center, bottom)
alter table quizzes add column if not exists image_position text not null default 'center';
