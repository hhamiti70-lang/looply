-- =====================================================================
-- LOOPLY: database schema and security policies (Supabase / PostgreSQL)
--
-- HOW TO USE (on your phone, in the Supabase website):
--   SQL Editor → "+ New query" → paste this whole file → press RUN.
-- Run it once on a new project.
--
-- SECURITY MODEL
--   * Every table has Row Level Security (RLS) turned ON.
--   * Only logged-in users ("authenticated") can read or write anything.
--   * Users can only change their OWN rows.
--   * Length and format limits are enforced by the database itself.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. PROFILES  (one per account, created automatically at sign-up)
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  username      text not null unique check (username ~ '^[a-z0-9_]{3,20}$'),
  display_name  text not null default '' check (char_length(display_name) <= 40),
  bio           text not null default '' check (char_length(bio) <= 300),
  location      text not null default '' check (char_length(location) <= 60),
  interests     text[] not null default '{}' check (cardinality(interests) <= 15),
  skills_offer  text[] not null default '{}' check (cardinality(skills_offer) <= 15),
  skills_seek   text[] not null default '{}' check (cardinality(skills_seek) <= 15),
  created_at    timestamptz not null default now()
);

-- Creates a profile automatically whenever someone signs up.
-- Runs with elevated rights, but only copies the username and display name
-- supplied during sign-up. Email addresses are never copied into profiles.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    lower(coalesce(new.raw_user_meta_data->>'username', 'user_' || substr(new.id::text, 1, 8))),
    coalesce(new.raw_user_meta_data->>'display_name', '')
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- ---------------------------------------------------------------------
-- 2. POSTS and LIKES  (Stage 1)
-- ---------------------------------------------------------------------
create table if not exists public.posts (
  id          uuid primary key default gen_random_uuid(),
  author_id   uuid not null references public.profiles(id) on delete cascade,
  body        text not null check (char_length(trim(body)) between 1 and 500),
  created_at  timestamptz not null default now()
);

create table if not exists public.likes (
  post_id     uuid not null references public.posts(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (post_id, user_id)
);


-- ---------------------------------------------------------------------
-- 3. COMMUNITIES  (tables ready for Stage 2)
-- ---------------------------------------------------------------------
create table if not exists public.communities (
  id           uuid primary key default gen_random_uuid(),
  name         text not null unique check (char_length(name) between 3 and 40),
  description  text not null default '' check (char_length(description) <= 300),
  created_by   uuid not null references public.profiles(id) on delete cascade,
  created_at   timestamptz not null default now()
);

create table if not exists public.community_members (
  community_id  uuid not null references public.communities(id) on delete cascade,
  user_id       uuid not null references public.profiles(id) on delete cascade,
  joined_at     timestamptz not null default now(),
  primary key (community_id, user_id)
);


-- ---------------------------------------------------------------------
-- 4. PRIVATE MESSAGES  (tables ready for Stage 2)
-- ---------------------------------------------------------------------
create table if not exists public.conversations (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now()
);

create table if not exists public.conversation_members (
  conversation_id  uuid not null references public.conversations(id) on delete cascade,
  user_id          uuid not null references public.profiles(id) on delete cascade,
  primary key (conversation_id, user_id)
);

create table if not exists public.messages (
  id               uuid primary key default gen_random_uuid(),
  conversation_id  uuid not null references public.conversations(id) on delete cascade,
  sender_id        uuid not null references public.profiles(id) on delete cascade,
  body             text not null check (char_length(trim(body)) between 1 and 1000),
  created_at       timestamptz not null default now()
);


-- ---------------------------------------------------------------------
-- 5. SKILL EXCHANGES  (tables ready for Stage 2)
-- ---------------------------------------------------------------------
create table if not exists public.skill_exchanges (
  id            uuid primary key default gen_random_uuid(),
  requester_id  uuid not null references public.profiles(id) on delete cascade,
  partner_id    uuid not null references public.profiles(id) on delete cascade,
  skill         text not null check (char_length(skill) between 2 and 40),
  status        text not null default 'requested'
                check (status in ('requested', 'accepted', 'declined', 'completed')),
  created_at    timestamptz not null default now(),
  check (requester_id <> partner_id)
);


-- ---------------------------------------------------------------------
-- 6. HELPER FUNCTIONS
-- ---------------------------------------------------------------------

-- True when the logged-in user belongs to a conversation.
-- "security definer" avoids policy recursion on conversation_members.
create or replace function public.is_conversation_member(conv uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.conversation_members
    where conversation_id = conv and user_id = auth.uid()
  );
$$;

-- Opens (or reuses) a one-to-one conversation with another member.
create or replace function public.start_direct_conversation(partner uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  conv uuid;
begin
  if auth.uid() is null then raise exception 'You must be logged in'; end if;
  if partner = auth.uid() then raise exception 'You cannot message yourself'; end if;

  select cm1.conversation_id into conv
  from public.conversation_members cm1
  join public.conversation_members cm2 on cm1.conversation_id = cm2.conversation_id
  where cm1.user_id = auth.uid() and cm2.user_id = partner
  limit 1;

  if conv is not null then return conv; end if;

  insert into public.conversations default values returning id into conv;
  insert into public.conversation_members (conversation_id, user_id)
    values (conv, auth.uid()), (conv, partner);
  return conv;
end;
$$;

-- Only logged-in users may call the function.
revoke execute on function public.start_direct_conversation(uuid) from public, anon;
grant execute on function public.start_direct_conversation(uuid) to authenticated;


-- ---------------------------------------------------------------------
-- 7. ROW LEVEL SECURITY: switch it on for every table
-- ---------------------------------------------------------------------
alter table public.profiles             enable row level security;
alter table public.posts                enable row level security;
alter table public.likes                enable row level security;
alter table public.communities          enable row level security;
alter table public.community_members    enable row level security;
alter table public.conversations        enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages             enable row level security;
alter table public.skill_exchanges      enable row level security;


-- ---------------------------------------------------------------------
-- 8. POLICIES
-- ---------------------------------------------------------------------

-- PROFILES: any logged-in member can view profiles; only the owner can edit.
create policy "profiles: members can read"
  on public.profiles for select to authenticated
  using (true);

create policy "profiles: owner can update"
  on public.profiles for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- Users may edit only these columns. Username and id are locked.
revoke update on public.profiles from authenticated;
grant update (display_name, bio, location, interests, skills_offer, skills_seek)
  on public.profiles to authenticated;

-- POSTS: members read all posts; authors create and delete their own.
create policy "posts: members can read"
  on public.posts for select to authenticated
  using (true);

create policy "posts: author can create"
  on public.posts for insert to authenticated
  with check (author_id = auth.uid());

create policy "posts: author can delete"
  on public.posts for delete to authenticated
  using (author_id = auth.uid());

-- LIKES: members read all likes; each person adds and removes only their own.
create policy "likes: members can read"
  on public.likes for select to authenticated
  using (true);

create policy "likes: user can like"
  on public.likes for insert to authenticated
  with check (user_id = auth.uid());

create policy "likes: user can unlike"
  on public.likes for delete to authenticated
  using (user_id = auth.uid());

-- COMMUNITIES: anyone logged in can see and create; only the creator can delete.
create policy "communities: members can read"
  on public.communities for select to authenticated
  using (true);

create policy "communities: user can create"
  on public.communities for insert to authenticated
  with check (created_by = auth.uid());

create policy "communities: creator can delete"
  on public.communities for delete to authenticated
  using (created_by = auth.uid());

-- COMMUNITY MEMBERS: anyone can read the list; users join and leave themselves.
create policy "community_members: members can read"
  on public.community_members for select to authenticated
  using (true);

create policy "community_members: user can join"
  on public.community_members for insert to authenticated
  with check (user_id = auth.uid());

create policy "community_members: user can leave"
  on public.community_members for delete to authenticated
  using (user_id = auth.uid());

-- CONVERSATIONS: only participants can see a conversation.
create policy "conversations: participants can read"
  on public.conversations for select to authenticated
  using (public.is_conversation_member(id));

-- CONVERSATION MEMBERS: participants see who is in their conversations.
-- New conversations are created only through start_direct_conversation().
create policy "conversation_members: participants can read"
  on public.conversation_members for select to authenticated
  using (public.is_conversation_member(conversation_id));

-- MESSAGES: only participants can read and send messages, and only as themselves.
create policy "messages: participants can read"
  on public.messages for select to authenticated
  using (public.is_conversation_member(conversation_id));

create policy "messages: participants can send"
  on public.messages for insert to authenticated
  with check (sender_id = auth.uid() and public.is_conversation_member(conversation_id));

create policy "messages: sender can delete"
  on public.messages for delete to authenticated
  using (sender_id = auth.uid());

-- SKILL EXCHANGES: only the two people involved can see a request.
-- Only the requester creates it; only the partner accepts or declines it.
create policy "skill_exchanges: involved people can read"
  on public.skill_exchanges for select to authenticated
  using (requester_id = auth.uid() or partner_id = auth.uid());

create policy "skill_exchanges: requester can create"
  on public.skill_exchanges for insert to authenticated
  with check (requester_id = auth.uid());

create policy "skill_exchanges: partner can respond"
  on public.skill_exchanges for update to authenticated
  using (partner_id = auth.uid())
  with check (partner_id = auth.uid());

create policy "skill_exchanges: requester can withdraw"
  on public.skill_exchanges for delete to authenticated
  using (requester_id = auth.uid());


-- ---------------------------------------------------------------------
-- 9. REAL-TIME (for Stage 2 messaging). Run this later, when messaging
--    is built. Uncomment the line and run it:
-- ---------------------------------------------------------------------
-- alter publication supabase_realtime add table public.messages;
