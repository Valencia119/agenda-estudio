-- =========================================================
-- Agenda Estudio · esquema inicial
-- =========================================================

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

-- ---------- utilidades ----------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ---------- clientes ----------
create table public.clients (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name        text not null check (length(trim(name)) > 0),
  phone       text,
  email       text,
  instagram   text,
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index clients_user_idx on public.clients (user_id, name);
create trigger clients_touch before update on public.clients
  for each row execute function public.touch_updated_at();

-- ---------- citas / sesiones / pendientes ----------
create table public.appointments (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  client_id     uuid references public.clients(id) on delete set null,
  title         text not null check (length(trim(title)) > 0),
  kind          text not null default 'sesion'
                check (kind in ('sesion', 'visita', 'salida', 'entrega', 'otro')),
  session_type  text,
  start_at      timestamptz not null,
  end_at        timestamptz,
  location      text,
  address       text,
  price         numeric(14, 2),
  paid          numeric(14, 2) not null default 0,
  status        text not null default 'pendiente'
                check (status in ('pendiente', 'confirmada', 'realizada', 'entregada', 'cancelada')),
  notes         text,
  reminders     integer[] not null default '{1440,120,30}',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index appointments_user_start_idx on public.appointments (user_id, start_at);
create index appointments_client_idx on public.appointments (client_id);
create trigger appointments_touch before update on public.appointments
  for each row execute function public.touch_updated_at();

-- ---------- ajustes por usuario ----------
create table public.settings (
  user_id            uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  timezone           text not null default 'America/Bogota',
  currency           text not null default 'COP',
  country_code       text not null default '57',
  morning_enabled    boolean not null default true,
  morning_time       time not null default '07:00',
  evening_enabled    boolean not null default true,
  evening_time       time not null default '20:00',
  default_reminders  integer[] not null default '{1440,120,30}',
  last_morning_date  date,
  last_evening_date  date,
  updated_at         timestamptz not null default now()
);
create trigger settings_touch before update on public.settings
  for each row execute function public.touch_updated_at();

-- ---------- suscripciones push (una por dispositivo) ----------
create table public.push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  endpoint    text not null unique,
  p256dh      text not null,
  auth        text not null,
  user_agent  text,
  created_at  timestamptz not null default now()
);
create index push_subscriptions_user_idx on public.push_subscriptions (user_id);

-- ---------- recordatorios programados (los genera el trigger) ----------
create table public.scheduled_reminders (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  appointment_id  uuid not null references public.appointments(id) on delete cascade,
  minutes_before  integer not null,
  fire_at         timestamptz not null,
  sent_at         timestamptz
);
create index scheduled_reminders_due_idx on public.scheduled_reminders (fire_at) where sent_at is null;
create index scheduled_reminders_appt_idx on public.scheduled_reminders (appointment_id);

create or replace function public.sync_appointment_reminders()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- borra los pendientes y vuelve a calcular según la hora y los avisos actuales
  delete from public.scheduled_reminders
   where appointment_id = new.id and sent_at is null;

  if new.status <> 'cancelada' then
    insert into public.scheduled_reminders (user_id, appointment_id, minutes_before, fire_at)
    select new.user_id, new.id, m, new.start_at - make_interval(mins => m)
      from (select distinct unnest(new.reminders) as m) r
     where m >= 0
       and new.start_at - make_interval(mins => m) > now() - interval '1 minute'
       and not exists (
         select 1 from public.scheduled_reminders s
          where s.appointment_id = new.id
            and s.minutes_before = r.m
            and s.fire_at = new.start_at - make_interval(mins => r.m)
            and s.sent_at is not null
       );
  end if;
  return new;
end $$;

create trigger appointments_reminders
  after insert or update of start_at, reminders, status on public.appointments
  for each row execute function public.sync_appointment_reminders();

-- ---------- clave interna para el cron (nunca sale de la base de datos) ----------
create table public.cron_config (
  id      boolean primary key default true check (id),
  secret  text not null default encode(extensions.gen_random_bytes(24), 'hex')
);
insert into public.cron_config default values;

-- =========================================================
-- Seguridad: cada usuaria solo ve y modifica lo suyo
-- =========================================================
alter table public.clients             enable row level security;
alter table public.appointments        enable row level security;
alter table public.settings            enable row level security;
alter table public.push_subscriptions  enable row level security;
alter table public.scheduled_reminders enable row level security;
alter table public.cron_config         enable row level security; -- sin políticas: nadie desde la API

create policy "clientes propios" on public.clients
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "citas propias" on public.appointments
  for all to authenticated using (user_id = auth.uid()) with check (
    user_id = auth.uid()
    and (client_id is null or exists (
      select 1 from public.clients c where c.id = client_id and c.user_id = auth.uid()))
  );

create policy "ajustes propios" on public.settings
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "suscripciones propias" on public.push_subscriptions
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "ver recordatorios propios" on public.scheduled_reminders
  for select to authenticated using (user_id = auth.uid());

-- sincronización en tiempo real entre iPhone y PC
alter publication supabase_realtime add table public.clients, public.appointments, public.settings;
