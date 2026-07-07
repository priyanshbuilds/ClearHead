import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
// import { Resend } from 'resend';
import sgMail from '@sendgrid/mail';

// const resend = new Resend(process.env.RESEND_API_KEY);
sgMail.setApiKey(process.env.SENDGRID_API_KEY!);

// Use the service role key to securely query user data without needing an active session
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  // 1. Check CRON_SECRET authorization
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { userId } = body;

    if (!userId) {
      return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
    }

    // 2. Fetch the user's email using Supabase Admin API
    const { data: { user }, error: userError } = await supabaseAdmin.auth.admin.getUserById(userId);

    if (userError || !user?.email) {
      console.error('Failed to fetch user:', userError);
      return NextResponse.json({ error: 'User not found or has no email' }, { status: 404 });
    }
    
    console.log("1. Found user email:", user.email);

    // 3. Query ALL incomplete tasks first to log them
    const { data: allTasks, error: tasksError } = await supabaseAdmin
      .from('dump_items')
      .select(`
        id,
        text,
        created_at,
        last_nudged_at,
        estimated_minutes,
        dumps!inner(user_id)
      `)
      .eq('dumps.user_id', userId)
      .eq('category', 'TASK')
      .is('parent_item_id', null)
      .eq('is_completed', false)
      .order('created_at', { ascending: false });

    if (tasksError) {
      console.error('Failed to fetch tasks:', tasksError);
      return NextResponse.json({ error: 'Failed to fetch tasks' }, { status: 500 });
    }

    console.log(`2. Total incomplete tasks found: ${allTasks?.length || 0}`);
    if (allTasks && allTasks.length > 0) {
      console.log("   Tasks text:", allTasks.map(t => t.text));
    }

    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    console.log("3. Checking last_nudged_at cooldown logic...");
    const tasks = allTasks?.filter(t => {
      // TEMPORARILY DISABLED: const isOldEnough = new Date(t.created_at) <= threeDaysAgo;
      // TEMPORARILY DISABLED: const passesCooldown = !t.last_nudged_at || new Date(t.last_nudged_at) < threeDaysAgo;
      // TEMPORARILY DISABLED: const passed = isOldEnough && passesCooldown;
      const passed = true; // Temporary bypass for testing
      console.log(`   Task "${t.text}" - passed: ${passed}`);
      return passed;
    }).slice(0, 3) || [];

    if (!tasks || tasks.length === 0) {
      console.log("   EARLY RETURN: No tasks passed cooldown filter. Returning 200.");
      return NextResponse.json({ message: 'No incomplete tasks to send' }, { status: 200 });
    }

    // 4. Send email via Resend
    
    const greetings = [
      "Good morning. Here's what's worth your attention today.",
      "Morning - a few things that matter today, nothing more.",
      "Hey. Here's a gentle nudge, not a to-do list demand."
    ];
    const greeting = greetings[Math.floor(Math.random() * greetings.length)];

    const tasksHtml = tasks.map(task => {
      const isVeryOld = new Date(task.created_at) < sevenDaysAgo;
      const oldNote = isVeryOld ? `<tr><td style="padding-bottom: 6px; font-size: 13px; color: #8E8BA8; font-style: italic;">This one's been waiting a while - still worth doing?</td></tr>` : "";
      const timeBadge = task.estimated_minutes ? `<span style="font-size: 13px; color: #8E8BA8; font-weight: normal; margin-left: 8px;">(~${task.estimated_minutes} min)</span>` : "";

      return `
        <tr>
          <td style="padding-bottom: 16px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              ${oldNote}
              <tr>
                <td style="background-color: #13121F; border-radius: 12px; border-left: 4px solid #7B6EF6; padding: 16px;">
                  <span style="font-size: 15px; color: #F0EFF8; font-weight: bold;">${task.text}</span>
                  ${timeBadge}
                </td>
              </tr>
            </table>
          </td>
        </tr>
      `;
    }).join('');

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

    const htmlBody = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; background-color: #050508; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #050508; padding: 40px 20px;">
          <tr>
            <td align="center">
              <!-- Main Card -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px;">
                <!-- Header -->
                <tr>
                  <td style="padding-bottom: 32px;">
                    <img src="https://clear-head-theta.vercel.app/clearhead-wordmark.svg" width="140" height="auto" alt="ClearHead" style="display: block; border: 0;" />
                  </td>
                </tr>
                <!-- Greeting -->
                <tr>
                  <td style="padding-bottom: 32px; font-size: 18px; color: #F0EFF8; font-weight: 500;">
                    ${greeting}
                  </td>
                </tr>
                <!-- Tasks -->
                <tr>
                  <td>
                    <table width="100%" cellpadding="0" cellspacing="0" border="0">
                      ${tasksHtml}
                    </table>
                  </td>
                </tr>
                <!-- Closing Message -->
                <tr>
                  <td style="padding-top: 16px; padding-bottom: 32px; font-size: 15px; color: #F0EFF8; line-height: 1.6;">
                    You don't have to do all of this today. Even one thing counts. Take it one step at a time.
                  </td>
                </tr>
                <!-- CTA -->
                <tr>
                  <td style="padding-bottom: 40px;" align="center">
                    <a href="${siteUrl}/app/dump" style="display: inline-block; background-color: #7B6EF6; background: linear-gradient(135deg, #7B6EF6, #2DD4BF); color: #ffffff; font-size: 15px; font-weight: bold; text-decoration: none; padding: 14px 28px; border-radius: 8px;">
                      Open ClearHead
                    </a>
                  </td>
                </tr>
                <!-- Sign-off -->
                <tr>
                  <td style="padding-top: 32px; border-top: 1px solid rgba(255,255,255,0.08); font-size: 15px; color: #8E8BA8; line-height: 1.6;">
                    - ClearHead
                  </td>
                </tr>
              </table>
              
              <!-- Footer -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; padding-top: 24px;">
                <tr>
                  <td align="center" style="font-size: 12px; color: #8E8BA8; line-height: 1.5;">
                    You're getting this because your daily card is turned on.<br>
                    <a href="${siteUrl}/app/settings" style="color: #8E8BA8; text-decoration: underline;">Manage this anytime in Settings</a>.
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    // const { data: emailData, error: emailError } = await resend.emails.send({
    //   from: 'ClearHead <onboarding@resend.dev>',
    //   to: user.email,
    //   subject: 'Your 3 things for today — ClearHead',
    //   html: htmlBody,
    // });
    
    let emailData;
    console.log(`4. About to send SendGrid email to: ${user.email}`);
    try {
      const response = await sgMail.send({
        to: user.email,
        from: 'opuchapuchik@gmail.com',
        subject: 'Your 3 things for today — ClearHead',
        html: htmlBody,
      });
      emailData = { id: response[0].headers['x-message-id'] };
      console.log("5. SendGrid email sent successfully, response headers:", JSON.stringify(response[0].headers));
    } catch (emailError) {
      console.error('5. Failed to send SendGrid email:', emailError);
      return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
    }

    // 5. Update last_nudged_at timestamp for these tasks
    const taskIds = tasks.map(t => t.id);
    const { error: updateError } = await supabaseAdmin
      .from('dump_items')
      .update({ last_nudged_at: new Date().toISOString() })
      .in('id', taskIds);

    if (updateError) {
      console.error('Failed to update last_nudged_at:', updateError);
      // We don't fail the request since the email was already sent
    }

    return NextResponse.json({ success: true, message: 'Email sent', id: emailData?.id }, { status: 200 });

  } catch (error) {
    console.error('Unexpected error in morning-card route:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
