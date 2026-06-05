import { serve } from 'inngest/next';
import { inngest } from '@/inngest/client';
import { generateMenuFn } from '@/inngest/functions/generateMenu';

// Vercel Hobby allows up to 60 seconds per serverless function.
// Menu generation (OpenAI gpt-4.1-mini, 7-day plan) takes 15–25 s — fits comfortably.
export const maxDuration = 60;

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [generateMenuFn],
});
