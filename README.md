# Pizzatime

A React + TypeScript web app powered by Vite.

## Getting Started

Install dependencies:

```sh
npm install
```

If PowerShell blocks `npm`, use `npm.cmd install`.

## Connect Supabase

Copy `.env.example` to `.env.local`. In your Supabase dashboard, open your project and use the **Connect** panel to find the Project URL and publishable key. Replace the example values in `.env.local` with those values, then restart the development server.

The app's shared Supabase client is exported from `src/lib/supabase.ts`:

```ts
import { supabase } from './lib/supabase';
```

Use the publishable key in this browser app. Never put a Supabase secret key or service role key in a `VITE_` variable. Browser access to database tables depends on your Row Level Security policies.

Start the development server:

```sh
npm run dev
```

Build for production:

```sh
npm run build
```
