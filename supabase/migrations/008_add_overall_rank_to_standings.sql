-- Add overall_rank and games_behind columns to standings
alter table standings add column if not exists overall_rank integer not null default 0;
alter table standings add column if not exists games_behind text not null default '-';
