-- =============================================================================
-- Parley messenger: database schema
--
-- Security model
--   * Every table has Row Level Security enabled. A user can only ever read
--     conversations they are a member of, the messages inside them, and the
--     profiles of people they share a conversation with.
--   * Clients cannot write to conversations / conversation_members directly.
--     All membership changes go through SECURITY DEFINER functions that
--     validate the caller's role.
--   * Messages can only be inserted by members, as themselves. Only the body
--     (edit) and deleted_at (soft delete) of your own messages can be changed.
--   * Phone lookups are exact-match only and rate limited to stop scraping.
--   * Attachments live in a private storage bucket readable only by members
--     of the conversation; typing indicators use private Realtime channels.
-- =============================================================================

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- Tables
-- -----------------------------------------------------------------------------

create table public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  phone         text unique,
  display_name  text not null default '' check (char_length(display_name) <= 64),
  about         text not null default 'Hey there! I am using Parley.' check (char_length(about) <= 140),
  avatar_path   text check (avatar_path is null or char_length(avatar_path) <= 512),
  last_seen_at  timestamptz not null default now(),
  created_at    timestamptz not null default now()
);
comment on table public.profiles is 'Public profile for each authenticated user. Phone is copied from auth.users.';

create table public.conversations (
  id               uuid primary key default gen_random_uuid(),
  type             text not null check (type in ('direct', 'group')),
  title            text check (title is null or char_length(title) between 1 and 64),
  avatar_path      text check (avatar_path is null or char_length(avatar_path) <= 512),
  direct_key       text unique,
  created_by       uuid references public.profiles (id) on delete set null,
  created_at       timestamptz not null default now(),
  last_message_at  timestamptz not null default now(),
  constraint conversation_shape check (
    (type = 'direct' and direct_key is not null and title is null)
    or (type = 'group' and direct_key is null and title is not null)
  )
);
create index conversations_created_by_idx on public.conversations (created_by);

-- A surrogate primary key is used on purpose: Realtime DELETE events are not
-- filtered by RLS and only carry the primary key, so the key must not reveal
-- who is a member of which conversation.
create table public.conversation_members (
  id               uuid primary key default gen_random_uuid(),
  conversation_id  uuid not null references public.conversations (id) on delete cascade,
  user_id          uuid not null references public.profiles (id) on delete cascade,
  role             text not null default 'member' check (role in ('owner', 'admin', 'member')),
  joined_at        timestamptz not null default now(),
  last_read_at     timestamptz not null default now(),
  unique (conversation_id, user_id)
);
create index conversation_members_user_idx on public.conversation_members (user_id);

create table public.messages (
  id               uuid primary key default gen_random_uuid(),
  conversation_id  uuid not null references public.conversations (id) on delete cascade,
  sender_id        uuid references public.profiles (id) on delete set null default auth.uid(),
  body             text check (body is null or char_length(body) between 1 and 4000),
  attachment_path  text check (attachment_path is null or char_length(attachment_path) <= 512),
  attachment_name  text check (attachment_name is null or char_length(attachment_name) <= 255),
  attachment_mime  text check (attachment_mime is null or char_length(attachment_mime) <= 255),
  attachment_size  integer check (attachment_size is null or attachment_size between 0 and 20971520),
  reply_to_id      uuid references public.messages (id) on delete set null,
  created_at       timestamptz not null default now(),
  edited_at        timestamptz,
  deleted_at       timestamptz,
  constraint message_has_content check (
    deleted_at is not null or body is not null or attachment_path is not null
  )
);
create index messages_conversation_created_idx on public.messages (conversation_id, created_at desc);
create index messages_sender_idx on public.messages (sender_id);
create index messages_reply_to_idx on public.messages (reply_to_id);

-- Used to rate-limit phone number lookups (not exposed through the API).
create table private.phone_lookups (
  user_id       uuid not null,
  looked_up_at  timestamptz not null default now()
);
create index phone_lookups_user_time_idx on private.phone_lookups (user_id, looked_up_at desc);

-- -----------------------------------------------------------------------------
-- Helper functions used by RLS policies
-- (SECURITY DEFINER so policies on conversation_members do not recurse)
-- -----------------------------------------------------------------------------

create function public.is_conversation_member(p_conversation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.conversation_members m
    where m.conversation_id = p_conversation_id
      and m.user_id = (select auth.uid())
  );
$$;

-- Same as above but accepts untrusted text (storage folder names, realtime topics).
create function public.is_conversation_member_text(p_conversation_id text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_conversation_id is null
     or p_conversation_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return false;
  end if;
  return public.is_conversation_member(p_conversation_id::uuid);
end;
$$;

create function public.shares_conversation_with(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.conversation_members mine
    join public.conversation_members theirs
      on theirs.conversation_id = mine.conversation_id
    where mine.user_id = (select auth.uid())
      and theirs.user_id = p_user_id
  );
$$;

create function public.conversation_role(p_conversation_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select m.role
  from public.conversation_members m
  where m.conversation_id = p_conversation_id
    and m.user_id = (select auth.uid());
$$;

-- -----------------------------------------------------------------------------
-- Triggers
-- -----------------------------------------------------------------------------

-- Parley accounts can only be created with a phone number. This holds even if
-- another auth provider (email, OAuth, anonymous) is accidentally enabled.
create function public.enforce_phone_signup()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(new.phone, '') = '' then
    raise exception 'Accounts must be created with a phone number' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger enforce_phone_signup
  before insert on auth.users
  for each row execute function public.enforce_phone_signup();

-- Create a profile whenever a user signs up with their phone number.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, phone)
  values (
    new.id,
    case when coalesce(new.phone, '') <> ''
      then '+' || regexp_replace(new.phone, '\D', '', 'g')
    end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Keep the profile phone in sync if the auth phone changes.
create function public.handle_user_phone_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles
  set phone = case when coalesce(new.phone, '') <> ''
                then '+' || regexp_replace(new.phone, '\D', '', 'g')
              end
  where id = new.id;
  return new;
end;
$$;

create trigger on_auth_user_phone_changed
  after update of phone on auth.users
  for each row
  when (old.phone is distinct from new.phone)
  execute function public.handle_user_phone_change();

-- Validate profile edits.
create function public.profiles_before_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.display_name := btrim(new.display_name, E' \t\r\n');
  new.about := btrim(new.about, E' \t\r\n');
  if new.avatar_path is not null and split_part(new.avatar_path, '/', 1) <> new.id::text then
    raise exception 'Avatar must be stored in your own folder' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger profiles_before_update
  before update on public.profiles
  for each row execute function public.profiles_before_update();

-- Normalise and validate new messages.
create function public.messages_before_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.sender_id := coalesce(auth.uid(), new.sender_id);
  new.created_at := now();
  new.edited_at := null;
  new.deleted_at := null;

  if new.body is not null then
    new.body := nullif(btrim(new.body, E' \t\r\n'), '');
  end if;

  if new.attachment_path is null then
    new.attachment_name := null;
    new.attachment_mime := null;
    new.attachment_size := null;
  elsif split_part(new.attachment_path, '/', 1) <> new.conversation_id::text
        or split_part(new.attachment_path, '/', 2) <> new.sender_id::text then
    raise exception 'Invalid attachment path' using errcode = '42501';
  end if;

  if new.reply_to_id is not null and not exists (
    select 1 from public.messages m
    where m.id = new.reply_to_id and m.conversation_id = new.conversation_id
  ) then
    raise exception 'Reply target is not in this conversation' using errcode = '22023';
  end if;

  return new;
end;
$$;

create trigger messages_before_insert
  before insert on public.messages
  for each row execute function public.messages_before_insert();

-- Bump the conversation and mark the sender's own message as read.
create function public.messages_after_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.conversations
  set last_message_at = new.created_at
  where id = new.conversation_id;

  update public.conversation_members
  set last_read_at = greatest(last_read_at, new.created_at)
  where conversation_id = new.conversation_id
    and user_id = new.sender_id;

  return new;
end;
$$;

create trigger messages_after_insert
  after insert on public.messages
  for each row execute function public.messages_after_insert();

-- Edits and soft deletes.
create function public.messages_before_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.deleted_at is not null then
    raise exception 'This message was deleted' using errcode = '22023';
  end if;

  -- Immutable columns (column privileges already block these for clients).
  new.id := old.id;
  new.conversation_id := old.conversation_id;
  new.sender_id := old.sender_id;
  new.created_at := old.created_at;
  new.reply_to_id := old.reply_to_id;

  if new.deleted_at is not null then
    new.deleted_at := now();
    new.edited_at := old.edited_at;
    new.body := null;
    new.attachment_path := null;
    new.attachment_name := null;
    new.attachment_mime := null;
    new.attachment_size := null;
  else
    new.attachment_path := old.attachment_path;
    new.attachment_name := old.attachment_name;
    new.attachment_mime := old.attachment_mime;
    new.attachment_size := old.attachment_size;
    if new.body is distinct from old.body then
      new.body := nullif(btrim(coalesce(new.body, ''), E' \t\r\n'), '');
      if new.body is null and new.attachment_path is null then
        raise exception 'Message cannot be empty' using errcode = '22023';
      end if;
      new.edited_at := now();
    else
      new.edited_at := old.edited_at;
    end if;
  end if;

  return new;
end;
$$;

create trigger messages_before_update
  before update on public.messages
  for each row execute function public.messages_before_update();

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;

-- Profiles: yourself, plus anyone you share a conversation with.
create policy "profiles: read self and contacts"
  on public.profiles for select
  to authenticated
  using (id = (select auth.uid()) or public.shares_conversation_with(id));

create policy "profiles: update self"
  on public.profiles for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Conversations & members: members only. Writes go through RPCs below.
create policy "conversations: members read"
  on public.conversations for select
  to authenticated
  using (public.is_conversation_member(id));

create policy "conversation_members: members read"
  on public.conversation_members for select
  to authenticated
  using (public.is_conversation_member(conversation_id));

-- Messages.
create policy "messages: members read"
  on public.messages for select
  to authenticated
  using (public.is_conversation_member(conversation_id));

create policy "messages: members send as themselves"
  on public.messages for insert
  to authenticated
  with check (
    sender_id = (select auth.uid())
    and public.is_conversation_member(conversation_id)
  );

create policy "messages: senders edit own"
  on public.messages for update
  to authenticated
  using (sender_id = (select auth.uid()) and public.is_conversation_member(conversation_id))
  with check (sender_id = (select auth.uid()));

-- Table and column privileges (defence in depth on top of RLS).
revoke all on public.profiles, public.conversations, public.conversation_members, public.messages from anon;
revoke insert, update, delete, truncate, references, trigger on public.profiles from authenticated;
revoke insert, update, delete, truncate, references, trigger on public.conversations from authenticated;
revoke insert, update, delete, truncate, references, trigger on public.conversation_members from authenticated;
revoke insert, update, delete, truncate, references, trigger on public.messages from authenticated;

grant select on public.profiles, public.conversations, public.conversation_members, public.messages to authenticated;
grant update (display_name, about, avatar_path) on public.profiles to authenticated;
grant insert (id, conversation_id, body, attachment_path, attachment_name, attachment_mime, attachment_size, reply_to_id)
  on public.messages to authenticated;
grant update (body, deleted_at) on public.messages to authenticated;

-- -----------------------------------------------------------------------------
-- RPCs (called from the client with supabase.rpc)
-- -----------------------------------------------------------------------------

-- Find a registered user by their exact phone number. Rate limited.
create function public.find_user_by_phone(p_phone text)
returns table (id uuid, phone text, display_name text, about text, avatar_path text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := auth.uid();
  v_digits text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
begin
  if v_me is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  if (select count(*) from private.phone_lookups l
      where l.user_id = v_me and l.looked_up_at > now() - interval '10 minutes') >= 30 then
    raise exception 'Too many lookups. Please wait a few minutes and try again.' using errcode = 'P0001';
  end if;

  delete from private.phone_lookups l where l.user_id = v_me and l.looked_up_at < now() - interval '1 day';
  insert into private.phone_lookups (user_id) values (v_me);

  if char_length(v_digits) < 7 or char_length(v_digits) > 15 then
    return;
  end if;

  return query
    select p.id, p.phone, p.display_name, p.about, p.avatar_path
    from public.profiles p
    where p.phone = '+' || v_digits
      and p.id <> v_me
      and p.display_name <> '';
end;
$$;

-- Get (or create) the one-to-one conversation with another user.
create function public.create_direct_conversation(p_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := auth.uid();
  v_key text;
  v_id uuid;
begin
  if v_me is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;
  if p_user_id is null or p_user_id = v_me then
    raise exception 'You cannot start a chat with yourself' using errcode = '22023';
  end if;
  if not exists (select 1 from public.profiles p where p.id = p_user_id) then
    raise exception 'User not found' using errcode = '22023';
  end if;

  v_key := least(v_me::text, p_user_id::text) || ':' || greatest(v_me::text, p_user_id::text);

  select c.id into v_id from public.conversations c where c.direct_key = v_key;
  if v_id is not null then
    return v_id;
  end if;

  insert into public.conversations (type, direct_key, created_by)
  values ('direct', v_key, v_me)
  on conflict (direct_key) do nothing
  returning conversations.id into v_id;

  if v_id is null then
    select c.id into v_id from public.conversations c where c.direct_key = v_key;
    return v_id;
  end if;

  insert into public.conversation_members (conversation_id, user_id, role)
  values (v_id, v_me, 'member'), (v_id, p_user_id, 'member');

  return v_id;
end;
$$;

-- Create a group with the caller as owner.
create function public.create_group_conversation(p_title text, p_member_ids uuid[])
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := auth.uid();
  v_title text := btrim(coalesce(p_title, ''), E' \t\r\n');
  v_members uuid[];
  v_id uuid;
begin
  if v_me is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;
  if char_length(v_title) < 1 or char_length(v_title) > 64 then
    raise exception 'Group name must be 1-64 characters' using errcode = '22023';
  end if;

  select coalesce(array_agg(distinct p.id), '{}')
  into v_members
  from public.profiles p
  where p.id = any (coalesce(p_member_ids, '{}'))
    and p.id <> v_me;

  if cardinality(v_members) < 1 then
    raise exception 'Add at least one member' using errcode = '22023';
  end if;
  if cardinality(v_members) > 199 then
    raise exception 'Groups are limited to 200 members' using errcode = '22023';
  end if;

  insert into public.conversations (type, title, created_by)
  values ('group', v_title, v_me)
  returning conversations.id into v_id;

  insert into public.conversation_members (conversation_id, user_id, role)
  values (v_id, v_me, 'owner');

  insert into public.conversation_members (conversation_id, user_id, role)
  select v_id, unnest(v_members), 'member';

  return v_id;
end;
$$;

-- Add members to a group (owners and admins only).
create function public.add_group_members(p_conversation_id uuid, p_member_ids uuid[])
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := auth.uid();
  v_role text;
  v_added integer;
begin
  if v_me is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;
  if not exists (select 1 from public.conversations c where c.id = p_conversation_id and c.type = 'group') then
    raise exception 'Group not found' using errcode = '22023';
  end if;

  v_role := public.conversation_role(p_conversation_id);
  if v_role is null or v_role not in ('owner', 'admin') then
    raise exception 'Only group admins can add members' using errcode = '42501';
  end if;

  insert into public.conversation_members (conversation_id, user_id, role)
  select p_conversation_id, p.id, 'member'
  from public.profiles p
  where p.id = any (coalesce(p_member_ids, '{}'))
  on conflict (conversation_id, user_id) do nothing;
  get diagnostics v_added = row_count;

  if (select count(*) from public.conversation_members m where m.conversation_id = p_conversation_id) > 200 then
    raise exception 'Groups are limited to 200 members' using errcode = '22023';
  end if;

  return v_added;
end;
$$;

-- Remove a member, or leave the group when p_user_id is yourself.
create function public.remove_group_member(p_conversation_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := auth.uid();
  v_my_role text;
  v_target_role text;
  v_next uuid;
begin
  if v_me is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;
  if not exists (select 1 from public.conversations c where c.id = p_conversation_id and c.type = 'group') then
    raise exception 'Group not found' using errcode = '22023';
  end if;

  v_my_role := public.conversation_role(p_conversation_id);
  if v_my_role is null then
    raise exception 'You are not a member of this group' using errcode = '42501';
  end if;

  select m.role into v_target_role
  from public.conversation_members m
  where m.conversation_id = p_conversation_id and m.user_id = p_user_id;
  if v_target_role is null then
    return;
  end if;

  if p_user_id <> v_me then
    if v_my_role = 'member'
       or v_target_role = 'owner'
       or (v_my_role = 'admin' and v_target_role = 'admin') then
      raise exception 'You do not have permission to remove this member' using errcode = '42501';
    end if;
  end if;

  delete from public.conversation_members m
  where m.conversation_id = p_conversation_id and m.user_id = p_user_id;

  -- Hand over ownership if the owner left.
  if v_target_role = 'owner' then
    select m.user_id into v_next
    from public.conversation_members m
    where m.conversation_id = p_conversation_id
    order by (m.role = 'admin') desc, m.joined_at asc
    limit 1;

    if v_next is null then
      delete from public.conversations c where c.id = p_conversation_id;
    else
      update public.conversation_members m
      set role = 'owner'
      where m.conversation_id = p_conversation_id and m.user_id = v_next;
    end if;
  end if;
end;
$$;

-- Promote/demote admins (owner only).
create function public.set_member_role(p_conversation_id uuid, p_user_id uuid, p_role text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;
  if p_role not in ('admin', 'member') then
    raise exception 'Invalid role' using errcode = '22023';
  end if;
  if coalesce(public.conversation_role(p_conversation_id), '') <> 'owner' then
    raise exception 'Only the group owner can change roles' using errcode = '42501';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'You cannot change your own role' using errcode = '22023';
  end if;

  update public.conversation_members m
  set role = p_role
  where m.conversation_id = p_conversation_id and m.user_id = p_user_id;
end;
$$;

-- Rename a group / change its avatar (owners and admins only).
create function public.update_group(
  p_conversation_id uuid,
  p_title text default null,
  p_avatar_path text default null,
  p_clear_avatar boolean default false
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_title text := nullif(btrim(coalesce(p_title, ''), E' \t\r\n'), '');
begin
  if auth.uid() is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;
  if coalesce(public.conversation_role(p_conversation_id), '') not in ('owner', 'admin') then
    raise exception 'Only group admins can edit the group' using errcode = '42501';
  end if;
  if v_title is not null and char_length(v_title) > 64 then
    raise exception 'Group name must be 1-64 characters' using errcode = '22023';
  end if;
  if p_avatar_path is not null and split_part(p_avatar_path, '/', 1) <> auth.uid()::text then
    raise exception 'Avatar must be stored in your own folder' using errcode = '42501';
  end if;

  update public.conversations c
  set title = coalesce(v_title, c.title),
      avatar_path = case
        when p_clear_avatar then null
        when p_avatar_path is not null then p_avatar_path
        else c.avatar_path
      end
  where c.id = p_conversation_id and c.type = 'group';
end;
$$;

-- Mark everything in a conversation as read.
create function public.mark_conversation_read(p_conversation_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.conversation_members m
  set last_read_at = now()
  where m.conversation_id = p_conversation_id
    and m.user_id = (select auth.uid())
    and m.last_read_at < now();
$$;

-- Heartbeat for "online" / "last seen". Throttled server-side.
create function public.touch_last_seen()
returns void
language sql
security definer
set search_path = ''
as $$
  update public.profiles p
  set last_seen_at = now()
  where p.id = (select auth.uid())
    and p.last_seen_at < now() - interval '20 seconds';
$$;

-- Chat list for the current user, newest first.
create function public.get_my_conversations()
returns table (
  id               uuid,
  type             text,
  title            text,
  avatar_path      text,
  created_at       timestamptz,
  last_message_at  timestamptz,
  my_role          text,
  last_read_at     timestamptz,
  unread_count     bigint,
  member_count     bigint,
  last_message     jsonb,
  peer             jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    c.id,
    c.type,
    c.title,
    c.avatar_path,
    c.created_at,
    c.last_message_at,
    me.role,
    me.last_read_at,
    (
      select count(*)
      from public.messages m
      where m.conversation_id = c.id
        and m.created_at > me.last_read_at
        and m.sender_id is distinct from me.user_id
        and m.deleted_at is null
    ),
    (select count(*) from public.conversation_members cm where cm.conversation_id = c.id),
    (
      select to_jsonb(lm)
      from (
        select m.id, m.body, m.sender_id, m.created_at, m.attachment_mime, m.attachment_name,
               m.deleted_at, sp.display_name as sender_name
        from public.messages m
        left join public.profiles sp on sp.id = m.sender_id
        where m.conversation_id = c.id
        order by m.created_at desc
        limit 1
      ) lm
    ),
    case when c.type = 'direct' then (
      select to_jsonb(pp)
      from (
        select p.id, p.phone, p.display_name, p.about, p.avatar_path, p.last_seen_at
        from public.conversation_members om
        join public.profiles p on p.id = om.user_id
        where om.conversation_id = c.id and om.user_id <> me.user_id
        limit 1
      ) pp
    ) end
  from public.conversation_members me
  join public.conversations c on c.id = me.conversation_id
  where me.user_id = (select auth.uid())
  order by c.last_message_at desc;
$$;

-- Lock down function execution: authenticated users only.
do $$
declare
  f text;
begin
  foreach f in array array[
    'public.is_conversation_member(uuid)',
    'public.is_conversation_member_text(text)',
    'public.shares_conversation_with(uuid)',
    'public.conversation_role(uuid)',
    'public.find_user_by_phone(text)',
    'public.create_direct_conversation(uuid)',
    'public.create_group_conversation(text, uuid[])',
    'public.add_group_members(uuid, uuid[])',
    'public.remove_group_member(uuid, uuid)',
    'public.set_member_role(uuid, uuid, text)',
    'public.update_group(uuid, text, text, boolean)',
    'public.mark_conversation_read(uuid)',
    'public.touch_last_seen()',
    'public.get_my_conversations()'
  ] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;

  foreach f in array array[
    'public.enforce_phone_signup()',
    'public.handle_new_user()',
    'public.handle_user_phone_change()',
    'public.profiles_before_update()',
    'public.messages_before_insert()',
    'public.messages_after_insert()',
    'public.messages_before_update()'
  ] loop
    execute format('revoke execute on function %s from public, anon, authenticated', f);
  end loop;
end;
$$;

-- -----------------------------------------------------------------------------
-- Storage
-- -----------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('avatars', 'avatars', true, 5242880, array['image/png', 'image/jpeg', 'image/webp', 'image/gif']),
  ('attachments', 'attachments', false, 20971520, null)
on conflict (id) do nothing;

-- Avatars: public to read (via public URL), writable only inside your own folder.
create policy "avatars: upload to own folder"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "avatars: read own folder"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "avatars: delete own"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- Attachments: <conversation_id>/<uploader_id>/<file>. Members read, uploader deletes.
create policy "attachments: members read"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'attachments' and public.is_conversation_member_text((storage.foldername(name))[1]));

create policy "attachments: members upload to own folder"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'attachments'
    and (storage.foldername(name))[2] = (select auth.uid())::text
    and public.is_conversation_member_text((storage.foldername(name))[1])
  );

create policy "attachments: uploader deletes"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'attachments' and (storage.foldername(name))[2] = (select auth.uid())::text);

-- -----------------------------------------------------------------------------
-- Realtime
-- -----------------------------------------------------------------------------

-- Postgres Changes (new messages, edits, read receipts, profile updates).
-- Each event is checked against the RLS policies above before delivery.
alter publication supabase_realtime add table
  public.messages,
  public.conversation_members,
  public.conversations,
  public.profiles;

-- Private broadcast/presence channels named "conversation:<id>" (typing indicators).
create policy "realtime: members receive conversation events"
  on realtime.messages for select
  to authenticated
  using (
    realtime.messages.extension in ('broadcast', 'presence')
    and (select realtime.topic()) like 'conversation:%'
    and public.is_conversation_member_text(split_part((select realtime.topic()), ':', 2))
  );

create policy "realtime: members send conversation events"
  on realtime.messages for insert
  to authenticated
  with check (
    realtime.messages.extension in ('broadcast', 'presence')
    and (select realtime.topic()) like 'conversation:%'
    and public.is_conversation_member_text(split_part((select realtime.topic()), ':', 2))
  );
