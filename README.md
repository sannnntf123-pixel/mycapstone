This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

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

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

1. Create a hosted PostgreSQL database (for example Neon, Supabase or Railway) and copy its connection string.
2. In the Vercel project's **Settings › Environment Variables**, add for Production (and Preview if you use it):

   | Variable | Value |
   |---|---|
   | `DATABASE_URL` | The hosted database's connection string (never `localhost`) |
   | `JWT_SECRET` | A random string of 32+ characters (`openssl rand -base64 32`) |
   | `INSTRUCTOR_INVITE_CODE` | The code instructors need to sign up (8+ characters) |
   | `ANTHROPIC_API_KEY` | Optional: enables AI question generation |
   | `AI_FAKE` | Optional: `true` for sample AI drafts without a key |

3. Redeploy. The `vercel-build` script generates the Prisma client and runs `prisma migrate deploy`, so the database tables are created on every deploy.
4. Optional demo data: from your machine, run the seed against the hosted database (it uses `SEED_PASSWORD` from your local `.env`):

   ```bash
   read -rs "DB?Hosted DATABASE_URL: " && DATABASE_URL="$DB" npx prisma db seed; unset DB
   ```
