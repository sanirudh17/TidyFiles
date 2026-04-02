# TidyFiles

TidyFiles is an AI-powered file organization desktop assistant that helps you safely clean up messy folders and chaotic downloads. It uses advanced language models to categorize, rename, and intelligently move your files out of the chaos without blindly making changes—everything is structured with a "review-first" safety philosophy.

## Features

- **Generative AI Organization**: Analyzes your files using Gemini 3 Pro Preview to suggest intelligent folder structures (e.g., grouping by project, date, or category).
- **Review-First Philosophy**: No files are moved or altered without your explicit approval. You review the planned changes before they are executed.
- **Desktop Dashboard Experience**: An intuitive, clean dashboard interface that runs locally, giving you total control and visibility over your file system.
- **Supabase Authentication**: Secure user authentication (Sign Up / Sign In) powered natively by Supabase, isolating the dashboard safely.
- **Advanced File Insights**: Get deep insights into your disk usage, duplicates, and quickly identify space-wasting cache or temp files.

## Tech Stack

- **Framework**: Next.js (App Router)
- **Styling**: Tailwind CSS & Modern Web Aesthetics (Glassmorphism, Dark/Light palettes)
- **Authentication**: Supabase (`@supabase/supabase-js`)
- **AI Integration**: Google Generative AI (`@google/generative-ai`) mapping for complex logical sorting.

## Getting Started

1. Set up your local `.env.local`:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```
2. Disable Email Confirmations in Supabase (Dashboard -> Authentication -> Providers -> Email -> Toggle "Confirm email" OFF) if you want instant login after sign up.
3. Install dependencies:
   ```bash
   npm install
   ```
4. Run the development server:
   ```bash
   npm run dev
   ```
5. Navigate to `http://localhost:3000` to preview the Landing Page, then sign in to access the Dashboard.
