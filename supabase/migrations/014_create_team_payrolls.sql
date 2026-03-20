create table if not exists team_payrolls (
  id uuid default gen_random_uuid() primary key,
  season text not null,
  team_tricode text not null,
  payroll bigint not null default 0,
  updated_at timestamptz not null default now(),
  unique(season, team_tricode)
);

alter table team_payrolls enable row level security;

create policy "Allow public read on team_payrolls"
  on team_payrolls for select using (true);

create policy "Allow public insert on team_payrolls"
  on team_payrolls for insert with check (true);

create policy "Allow public update on team_payrolls"
  on team_payrolls for update using (true);

create policy "Allow public delete on team_payrolls"
  on team_payrolls for delete using (true);
