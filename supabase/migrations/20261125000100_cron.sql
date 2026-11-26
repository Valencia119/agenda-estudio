-- Cada minuto llama a la función que envía recordatorios y resúmenes.
-- La clave del cron se lee de public.cron_config (generada dentro de la base, nunca sale de ella).
select cron.schedule(
  'send-reminders',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://cydmzsfgtskamhikhwxx.supabase.co/functions/v1/send-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-key', (select secret from public.cron_config limit 1)
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 25000
  );
  $$
);

-- limpieza semanal de recordatorios ya enviados y del historial del cron
select cron.schedule(
  'cleanup-reminders',
  '15 4 * * 0',
  $$
  delete from public.scheduled_reminders where sent_at < now() - interval '30 days';
  delete from cron.job_run_details where end_time < now() - interval '7 days';
  $$
);
