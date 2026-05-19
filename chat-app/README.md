# Realtime Chat App (React + Supabase)

This project implements all requested phases:

- Authentication (signup, login, logout)
- Session handling and protected routes
- Supabase messages table with CRUD actions
- Fetching and rendering ordered messages
- Realtime INSERT/UPDATE/DELETE sync
- Typing indicator and online users via Presence
- Chat bubble alignment, timestamp, scroll-to-bottom
- Loader, error states, and empty state

## 1. Install

From this folder:

1. npm install
2. npm install @supabase/supabase-js react-router-dom

## 2. Configure Supabase

1. Create a Supabase project.
2. Copy Project URL and anon key from Settings -> API.
3. Create a local env file from the example:

- Copy .env.example to .env
- Fill values:
	- VITE_SUPABASE_URL
	- VITE_SUPABASE_ANON_KEY

## 3. Create DB table + RLS

Run the SQL from supabase/setup.sql in Supabase SQL editor.

It creates:

- messages table
- indexes
- update timestamp trigger
- RLS policies for authenticated users
- publication entry for realtime

## 4. Run app

1. npm run dev
2. Open shown localhost URL
3. Sign up, login, and start chatting in real time

## Notes

- Delete and edit operations are restricted to your own messages.
- Typing indicator and online users use a presence channel.
- If email confirmation is enabled in Supabase, signup asks the user to verify email first.
