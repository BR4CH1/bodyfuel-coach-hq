-- First BodyFuel/Fuely exercise animation.
-- The animation itself lives in /public/training/fuely and is served as an
-- animated WebP. Keeping the URLs in coach_exercise_library means the same
-- media model works for future Fuely exercises without tracker-specific code.

UPDATE public.coach_exercise_library
SET
  thumbnail_url = '/training/fuely/bizeps-curls-kurzhantel-thumb.webp',
  animation_url = '/training/fuely/bizeps-curls-kurzhantel.webp',
  media_type = 'image',
  media_source = 'BodyFuel · Fuely Exercise Library',
  technique_hint = 'Ellbogen nah am Körper halten, Oberarme ruhig lassen und die Hanteln kontrolliert heben und senken.'
WHERE id = 'ac09653d-1784-4329-85da-16f099fda910';
