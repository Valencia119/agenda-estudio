-- Evita estudios duplicados si la app llama dos veces al mismo tiempo:
-- cada usuaria ejecuta ensure_studio / join_studio de a una.
create or replace function public.ensure_studio()
returns uuid language plpgsql security definer set search_path = public as $$
declare sid uuid; uname text;
begin
  if auth.uid() is null then raise exception 'Sin sesión'; end if;
  perform pg_advisory_xact_lock(hashtext('studio:' || auth.uid()::text));
  select studio_id into sid from public.studio_members where user_id = auth.uid();
  if sid is not null then return sid; end if;
  uname := public.member_name_for(auth.uid());
  insert into public.studios (name, created_by) values ('Estudio de ' || uname, auth.uid()) returning id into sid;
  insert into public.studio_members (studio_id, user_id, display_name, role, color)
    values (sid, auth.uid(), uname, 'owner', '#b5523b');
  return sid;
end $$;

create or replace function public.join_studio(code text)
returns json language plpgsql security definer set search_path = public as $$
declare target uuid; target_name text; old uuid;
begin
  if auth.uid() is null then raise exception 'Sin sesión'; end if;
  perform pg_advisory_xact_lock(hashtext('studio:' || auth.uid()::text));
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
