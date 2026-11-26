-- =========================================================
-- Estudio compartido: varias fotógrafas usan la misma agenda
-- =========================================================

create table public.studios (
  id           uuid primary key default gen_random_uuid(),
  name         text not null default 'Mi estudio',
  invite_code  text not null unique default upper(encode(extensions.gen_random_bytes(5), 'hex')),
  created_by   uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now()
);

create table public.studio_members (
  studio_id     uuid not null references public.studios(id) on delete cascade,
  user_id       uuid not null unique references auth.users(id) on delete cascade, -- una fotógrafa = un estudio
  display_name  text not null,
  color         text not null default '#b5523b',
  role          text not null default 'member' check (role in ('owner', 'member')),
  joined_at     timestamptz not null default now(),
  primary key (studio_id, user_id)
);

-- estudio de la usuaria actual (lo usan las políticas de seguridad)
create or replace function public.my_studio_id()
returns uuid language sql stable security definer set search_path = public as $$
  select studio_id from public.studio_members where user_id = auth.uid()
$$;

create or replace function public.member_name_for(uid uuid)
returns text language sql stable security definer set search_path = public as $$
  select coalesce(
    nullif(trim(raw_user_meta_data ->> 'name'), ''),
    initcap(split_part(email, '@', 1))
  ) from auth.users where id = uid
$$;

create or replace function public.next_member_color(sid uuid)
returns text language sql stable set search_path = public as $$
  select (array['#b5523b', '#4c72a0', '#5b8a72', '#8f5c8a', '#c27c37', '#3f7f86'])
         [1 + (select count(*) from public.studio_members where studio_id = sid)::int % 6]
$$;

-- ---------- columnas nuevas ----------
alter table public.clients add column studio_id uuid references public.studios(id) on delete cascade;
alter table public.appointments add column studio_id uuid references public.studios(id) on delete cascade;
alter table public.appointments add column assigned_to uuid references auth.users(id) on delete set null; -- null = ambas

-- ---------- cada cuenta existente recibe su estudio ----------
do $$
declare u record; sid uuid; uname text;
begin
  for u in select id from auth.users loop
    uname := public.member_name_for(u.id);
    insert into public.studios (name, created_by) values ('Estudio de ' || uname, u.id) returning id into sid;
    insert into public.studio_members (studio_id, user_id, display_name, role, color)
      values (sid, u.id, uname, 'owner', '#b5523b');
  end loop;
end $$;

update public.clients c set studio_id = m.studio_id from public.studio_members m where m.user_id = c.user_id;
update public.appointments a set studio_id = m.studio_id, assigned_to = a.user_id
  from public.studio_members m where m.user_id = a.user_id;

alter table public.clients alter column studio_id set not null;
alter table public.clients alter column studio_id set default public.my_studio_id();
alter table public.appointments alter column studio_id set not null;
alter table public.appointments alter column studio_id set default public.my_studio_id();
create index clients_studio_idx on public.clients (studio_id, name);
create index appointments_studio_start_idx on public.appointments (studio_id, start_at);

-- ---------- seguridad: se comparte todo dentro del estudio ----------
alter table public.studios        enable row level security;
alter table public.studio_members enable row level security;

create policy "ver mi estudio" on public.studios
  for select to authenticated using (id = public.my_studio_id());
create policy "la dueña edita el estudio" on public.studios
  for update to authenticated
  using (id = public.my_studio_id() and exists (
    select 1 from public.studio_members m where m.studio_id = id and m.user_id = auth.uid() and m.role = 'owner'))
  with check (id = public.my_studio_id());

create policy "ver compañeras" on public.studio_members
  for select to authenticated using (studio_id = public.my_studio_id());
create policy "editar mi perfil" on public.studio_members
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
-- solo se puede cambiar el nombre y el color propios (no el rol ni el estudio)
revoke insert, update, delete on public.studio_members from anon, authenticated;
grant update (display_name, color) on public.studio_members to authenticated;
revoke insert, delete on public.studios from anon, authenticated;
revoke update on public.studios from anon, authenticated;
grant update (name) on public.studios to authenticated;

drop policy "clientes propios" on public.clients;
create policy "clientes del estudio" on public.clients
  for all to authenticated
  using (studio_id = public.my_studio_id())
  with check (studio_id = public.my_studio_id());

drop policy "citas propias" on public.appointments;
create policy "citas del estudio" on public.appointments
  for all to authenticated
  using (studio_id = public.my_studio_id())
  with check (
    studio_id = public.my_studio_id()
    and (client_id is null or exists (
      select 1 from public.clients c where c.id = client_id and c.studio_id = public.my_studio_id()))
    and (assigned_to is null or exists (
      select 1 from public.studio_members m where m.user_id = assigned_to and m.studio_id = public.my_studio_id()))
  );

drop policy "ver recordatorios propios" on public.scheduled_reminders;
create policy "ver recordatorios del estudio" on public.scheduled_reminders
  for select to authenticated using (exists (
    select 1 from public.appointments a where a.id = appointment_id and a.studio_id = public.my_studio_id()));

-- ---------- funciones que llama la app ----------
-- crea el estudio la primera vez que entra una cuenta nueva
create or replace function public.ensure_studio()
returns uuid language plpgsql security definer set search_path = public as $$
declare sid uuid; uname text;
begin
  if auth.uid() is null then raise exception 'Sin sesión'; end if;
  select studio_id into sid from public.studio_members where user_id = auth.uid();
  if sid is not null then return sid; end if;
  uname := public.member_name_for(auth.uid());
  insert into public.studios (name, created_by) values ('Estudio de ' || uname, auth.uid()) returning id into sid;
  insert into public.studio_members (studio_id, user_id, display_name, role, color)
    values (sid, auth.uid(), uname, 'owner', '#b5523b');
  return sid;
end $$;

-- unirse con el código de invitación (se lleva sus citas y clientes)
create or replace function public.join_studio(code text)
returns json language plpgsql security definer set search_path = public as $$
declare target uuid; target_name text; old uuid;
begin
  if auth.uid() is null then raise exception 'Sin sesión'; end if;
  select id, name into target, target_name from public.studios where invite_code = upper(trim(code));
  if target is null then raise exception 'El código de invitación no es válido'; end if;
  select studio_id into old from public.studio_members where user_id = auth.uid();
  if old = target then return json_build_object('studio_id', target, 'name', target_name, 'already', true); end if;
  if old is not null then
    update public.clients set studio_id = target where studio_id = old and user_id = auth.uid();
    update public.appointments set studio_id = target where studio_id = old and user_id = auth.uid();
    delete from public.studio_members where user_id = auth.uid();
    if not exists (select 1 from public.studio_members where studio_id = old) then
      delete from public.studios where id = old;
    end if;
  end if;
  insert into public.studio_members (studio_id, user_id, display_name, role, color)
    values (target, auth.uid(), public.member_name_for(auth.uid()), 'member', public.next_member_color(target));
  return json_build_object('studio_id', target, 'name', target_name, 'already', false);
end $$;

-- la dueña puede cambiar el link de invitación (el anterior deja de servir)
create or replace function public.new_invite_code()
returns text language plpgsql security definer set search_path = public as $$
declare code text;
begin
  if not exists (select 1 from public.studio_members where user_id = auth.uid() and role = 'owner') then
    raise exception 'Solo la dueña del estudio puede cambiar el link';
  end if;
  code := upper(encode(extensions.gen_random_bytes(5), 'hex'));
  update public.studios set invite_code = code where id = public.my_studio_id();
  return code;
end $$;

revoke execute on function public.ensure_studio(), public.join_studio(text), public.new_invite_code() from anon, public;
grant execute on function public.ensure_studio(), public.join_studio(text), public.new_invite_code() to authenticated;
revoke execute on function public.member_name_for(uuid) from anon, public, authenticated;

alter publication supabase_realtime add table public.studios, public.studio_members;
