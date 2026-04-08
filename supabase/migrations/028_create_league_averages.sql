-- Store live league shooting averages computed during sync-stats.
-- sync-career reads these to compute adjusted shooting (stat+) with up-to-date values.
create table if not exists league_averages (
  season text primary key,
  fg numeric(5,4) not null,
  fg2 numeric(5,4) not null,
  fg3 numeric(5,4) not null,
  efg numeric(5,4) not null,
  ft numeric(5,4) not null,
  ts numeric(5,4) not null,
  updated_at timestamptz not null default now()
);
