-- Hoopiz quizzes stored in database
create table if not exists quizzes (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  description text not null default '',
  mode text not null default 'unordered', -- 'unordered' or 'ordered'
  time_limit integer not null default 300, -- seconds
  entries jsonb not null default '[]', -- [{label: string, answers: string[]}]
  published boolean not null default false,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_quizzes_published on quizzes(published);

alter table quizzes enable row level security;
create policy "Allow public read published quizzes" on quizzes for select using (published = true);
create policy "Allow admin read all quizzes" on quizzes for select using (
  exists (select 1 from profiles where id = auth.uid() and is_admin = true)
);
create policy "Allow admin insert quizzes" on quizzes for insert with check (
  exists (select 1 from profiles where id = auth.uid() and is_admin = true)
);
create policy "Allow admin update quizzes" on quizzes for update using (
  exists (select 1 from profiles where id = auth.uid() and is_admin = true)
);
create policy "Allow admin delete quizzes" on quizzes for delete using (
  exists (select 1 from profiles where id = auth.uid() and is_admin = true)
);
