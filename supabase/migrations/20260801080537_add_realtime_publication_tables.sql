-- Real bug found and fixed: zero tables were in the supabase_realtime
-- publication on production, despite two features depending on it
-- (the feed's live inserts, and Direct Messages' real-time delivery).
-- Both channels connected successfully (SUBSCRIBED) and stayed healthy
-- indefinitely, while silently never receiving a single database
-- event — a project-level setting entirely separate from RLS or the
-- channel code itself, easy to miss since nothing surfaces as an error.

ALTER PUBLICATION supabase_realtime ADD TABLE spots;
ALTER PUBLICATION supabase_realtime ADD TABLE messages;