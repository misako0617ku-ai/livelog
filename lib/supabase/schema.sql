-- Artists table
create table if not exists artists (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  image_url text,
  bandsintown_id text unique,
  created_at timestamptz default now()
);

-- Events table
create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  artist_id uuid references artists(id) on delete cascade not null,
  title text not null,
  venue text,
  location text,
  start_date timestamptz not null,
  end_date timestamptz,
  url text,
  description text,
  source text check (source in ('manual', 'bandsintown')) default 'manual',
  created_at timestamptz default now()
);

-- User follows (which artists a user follows)
create table if not exists user_artists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  artist_id uuid references artists(id) on delete cascade not null,
  created_at timestamptz default now(),
  unique (user_id, artist_id)
);

-- RLS Policies
alter table artists enable row level security;
alter table events enable row level security;
alter table user_artists enable row level security;

-- Artists: anyone can read, only authenticated users can insert
create policy "Anyone can view artists" on artists for select using (true);
create policy "Authenticated users can insert artists" on artists for insert with check (auth.role() = 'authenticated');

-- Events: anyone can read, authenticated users can insert/update/delete their own
create policy "Anyone can view events" on events for select using (true);
create policy "Authenticated users can insert events" on events for insert with check (auth.role() = 'authenticated');
create policy "Authenticated users can update events" on events for update using (auth.role() = 'authenticated');
create policy "Authenticated users can delete events" on events for delete using (auth.role() = 'authenticated');

-- User artists: users can only manage their own follows
create policy "Users can view their own follows" on user_artists for select using (auth.uid() = user_id);
create policy "Users can insert their own follows" on user_artists for insert with check (auth.uid() = user_id);
create policy "Users can delete their own follows" on user_artists for delete using (auth.uid() = user_id);
