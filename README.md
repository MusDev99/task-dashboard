# WorkForce Management

A resource-management system for small and medium teams: plan work capacity from the roster and assign tasks by availability. Built with Next.js and Tailwind CSS; Google Sheets is the database (one tab per table). The original gamified leaderboard is still available under Leaderboard / Completions.

## Google Sheets setup

1. Create a Google Cloud service account, enable the **Google Sheets API**, and download a JSON key.
2. Create a spreadsheet and share it with the service account email as **Editor**.
3. Copy `.env.example` to `.env` and set `GOOGLE_SHEET_ID` and `GOOGLE_SHEET_PATH` (path to the JSON key). Where files aren't available, set `GOOGLE_SERVICE_ACCOUNT_EMAIL` + `GOOGLE_PRIVATE_KEY` instead.
4. Seed the sheet from `json/` (creates/overwrites the `users` and `tasks` tabs): `npm run migrate:sheets`

Tabs are `users`, `tasks` and `roster` (created automatically on first roster edit); row 1 is the header (see `lib/schema.ts`). Edit rows in the sheet and refresh the site (reads are cached for ~15s).

## Features

- 📋 Task Management System
- 📚 Documentation Section
- 🎨 Modern UI with Tailwind CSS
- ⚡ Fast and Responsive Design
- 🔄 Real-time Updates
- 📱 Mobile-First Approach

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Project Structure

- `/app` - Main application code
  - `/task` - Task management features
  - `/docs` - Documentation section
  - `page.tsx` - Landing page
  - `layout.tsx` - Root layout
  - `globals.css` - Global styles

## Tech Stack

- [Next.js 13+](https://nextjs.org) - React framework
- [Tailwind CSS](https://tailwindcss.com) - Utility-first CSS framework
- [TypeScript](https://www.typescriptlang.org) - Type safety
- [Geist Font](https://vercel.com/font) - Modern typography

## Learn More

To learn more about the technologies used in this project:

- [Next.js Documentation](https://nextjs.org/docs)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [TypeScript Documentation](https://www.typescriptlang.org/docs)

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Roster

`/roster` shows every active user's shifts and leave for a month. Click or drag cells to assign a shift or leave (PH / AL / MC), use `+` above a date to assign everyone, **Clear schedule** to bulk-remove, and **Export / Upload CSV** (`email` or `employeeId`, `date`, `code`). Records are stored in the `roster` tab, one row per user per day. Shift and leave codes (hours, colours) are configured in `json/shifts.json`.

## Dashboard: Daily Whereabouts

The dashboard opens with a read-only **Daily Whereabouts** view for any day (`?date=YYYY-MM-DD`): who is on which shift, who is on leave (PH / AL / MC) and who has no roster entry yet, with a filter and a **Copy chat text** button that produces a plain-text summary for chat.

## Task Management

`/tasks` plans and assigns work in **List Tree**, **Kanban** (drag between To Do / In Progress / Completed / Closed) or **Calendar** views. Each task has a generated code (`TSK-0001`), status, story points with complexity (XS–XXL), one assignee, labels, optional start/due dates, links (Jira, GitLab merge requests, GitHub or any URL) and one level of subtasks with their own assignee and points. The assignee picker shows each person's roster availability for the task's dates and their open story points; unavailable people get a warning but can still be assigned. Statuses and the point scale are configured in `json/task-config.json`; data is stored in the `work_tasks` tab.
