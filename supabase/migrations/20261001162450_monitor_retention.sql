create extension if not exists pg_cron;
select cron.schedule('monitor-retention', '17 3 * * *', $$delete from public.monitor_events where created_at < now() - interval '30 days'$$);
