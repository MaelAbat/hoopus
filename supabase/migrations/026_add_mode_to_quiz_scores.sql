-- Add mode column to quiz_scores for separate leaderboards per mode
alter table quiz_scores add column if not exists mode text not null default 'unordered';

-- Update unique constraint: one score per user per quiz per mode
alter table quiz_scores drop constraint if exists quiz_scores_user_id_quiz_id_key;
alter table quiz_scores add constraint quiz_scores_user_id_quiz_id_mode_key unique(user_id, quiz_id, mode);
