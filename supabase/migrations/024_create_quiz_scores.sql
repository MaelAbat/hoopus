-- Quiz scores: one row per user per quiz
create table if not exists quiz_scores (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references auth.users(id),
  quiz_id uuid not null references quizzes(id) on delete cascade,
  display_name text not null default '',
  found_count integer not null,
  total_count integer not null,
  time_seconds integer not null,
  won boolean not null default false,
  created_at timestamptz not null default now(),
  unique(user_id, quiz_id)
);

create index if not exists idx_quiz_scores_quiz on quiz_scores(quiz_id);

alter table quiz_scores enable row level security;
create policy "Allow public read on quiz_scores" on quiz_scores for select using (true);
create policy "Allow authenticated insert on quiz_scores" on quiz_scores for insert with check (auth.uid() = user_id);
create policy "Allow user update own quiz scores" on quiz_scores for update using (auth.uid() = user_id);
