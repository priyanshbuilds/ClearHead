# 🧠 ClearHead

> **Your brain is full. Let's sort it.**

ClearHead is a minimal, AI-powered web application designed to help you instantly offload your unstructured thoughts. Dump your thoughts in 60 seconds, and ClearHead automatically organizes them into actionable **Tasks, Ideas, Worries, and Reminders** using AI—so you don't have to.

![ClearHead Preview](https://github.com/priyanshbuilds/ClearHead/assets/placeholder) <!-- Replace with an actual screenshot later -->

## 🚀 Features

- **Instant Brain Dumps**: A distraction-free textarea to get your thoughts out quickly.
- **AI Auto-Categorization**: Uses Anthropic's Claude to parse your messy text into neat categories:
  - 📝 **Tasks**: Actionable items with checkboxes.
  - 💡 **Ideas**: Creative thoughts saved for later.
  - 💭 **Worries**: Anxieties you need to acknowledge and process.
  - 📌 **Reminders**: Quick things to remember.
- **Morning Cards**: An optional daily email sent via Resend that recaps your incomplete tasks so you start your day focused.
- **Authentication**: Seamless secure login using Email/Password or Google OAuth, powered by Supabase.
- **Premium Design**: A highly polished, calming dark mode aesthetic with custom gradients and micro-interactions.

## 🛠 Tech Stack

- **Framework**: [Next.js 14](https://nextjs.org/) (App Router)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **Database & Auth**: [Supabase](https://supabase.com/)
- **AI Processing**: [Anthropic Claude 3 Haiku](https://www.anthropic.com/)
- **Email Delivery**: [Resend](https://resend.com/)

## 🏃‍♂️ Getting Started Locally

1. **Clone the repository:**
   ```bash
   git clone https://github.com/priyanshbuilds/ClearHead.git
   cd ClearHead/clearhead-app
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up Environment Variables:**
   Create a `.env.local` file in the root directory and add your API keys:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
   ANTHROPIC_API_KEY=your_anthropic_api_key
   RESEND_API_KEY=your_resend_api_key
   CRON_SECRET=your_secret_for_cron_jobs
   NEXT_PUBLIC_SITE_URL=http://localhost:3000
   ```

4. **Run the development server:**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

## 📦 Deployment

The easiest way to deploy ClearHead is using [Vercel](https://vercel.com).
Ensure you have added all the environment variables from your `.env.local` file to your Vercel project settings. For the daily morning card emails to work, you can set up a Vercel Cron Job using the `CRON_SECRET` variable.

---

*Built with focus and calm.*
