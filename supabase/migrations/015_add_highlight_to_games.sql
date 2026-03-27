-- Add highlight video ID column to games table
alter table public.games add column if not exists highlight_video_id text;
