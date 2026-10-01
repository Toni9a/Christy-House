/**
 * Christy's House database schema. Safe to run repeatedly: the app runs it once
 * when it first connects, so a brand-new Neon database sets itself up.
 */
export const SCHEMA = `
create table if not exists rooms (
  id          text primary key,
  name        text not null,
  kind        text not null default 'other',
  dims        jsonb not null default '{"width":null,"depth":null,"height":null}',
  notes       text not null default '',
  scan_file   text,
  created_at  timestamptz not null default now()
);

create table if not exists items (
  id          text primary key,
  room_id     text references rooms(id) on delete set null,
  title       text not null,
  status      text not null default 'idea' check (status in ('idea','to-buy','ordered','have')),
  price       numeric,
  currency    text not null default 'GBP',
  url         text not null default '',
  source      text not null default '',
  image_url   text,
  width_cm    numeric,
  depth_cm    numeric,
  height_cm   numeric,
  condition   text not null default 'unknown',
  match_score numeric not null default 0,
  why         text not null default '',
  notes       text not null default '',
  added_by    text,
  added_at    timestamptz not null default now()
);
create index if not exists items_room_idx on items(room_id);

create table if not exists room_photos (
  id          text primary key,
  room_id     text not null references rooms(id) on delete cascade,
  file        text not null,
  caption     text not null default '',
  added_by    text,
  added_at    timestamptz not null default now()
);
create index if not exists room_photos_room_idx on room_photos(room_id);
alter table room_photos add column if not exists kind text not null default 'now';

create table if not exists meter_readings (
  id          text primary key,
  meter       text not null,
  label       text not null default '',
  reading     text not null,
  unit        text not null default '',
  photo       text,
  taken_on    date not null default current_date,
  notes       text not null default '',
  added_by    text,
  added_at    timestamptz not null default now()
);

create table if not exists comments (
  id          text primary key,
  item_id     text not null references items(id) on delete cascade,
  author      text not null,
  body        text not null,
  created_at  timestamptz not null default now()
);
create index if not exists comments_item_idx on comments(item_id);

-- One reaction per person per item.
create table if not exists reactions (
  item_id     text not null references items(id) on delete cascade,
  person      text not null,
  value       text not null check (value in ('love','nope')),
  created_at  timestamptz not null default now(),
  primary key (item_id, person)
);

-- Product searches (web and SMS). Results are kept as one JSON document.
create table if not exists searches (
  id          text primary key,
  created_at  timestamptz not null default now(),
  data        jsonb not null
);

create table if not exists meta (key text primary key, value text not null);
`;
