SELECT cron.schedule(
  'process-performance-plan-jobs-every-minute',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://project--bab128fc-a4e7-452e-93f3-272c5eddd074.lovable.app/api/public/hooks/process-performance-plan-jobs',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || COALESCE((SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_hook_secret' LIMIT 1), '')
    ),
    body := '{}'::jsonb
  );
  $$
);