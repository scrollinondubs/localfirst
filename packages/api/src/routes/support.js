import { Hono } from 'hono';
import { supportTickets } from '../db/schema.js';
import { eq } from 'drizzle-orm';

const support = new Hono();

// Generate 6-digit ticket number
function generateTicketNumber() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Send email using Cloudflare Workers MailChannels API
async function sendEmail(to, subject, htmlBody, env) {
  try {
    // In local development, just log the email instead of sending
    if (env.NODE_ENV === 'development' || !env.SUPPORT_EMAIL) {
      console.log('📧 Email would be sent (local dev mode):');
      console.log('To:', to);
      console.log('Subject:', subject);
      console.log('Body:', htmlBody);
      // In local dev, we'll simulate success
      return true;
    }

    // For Cloudflare Workers production, use MailChannels API
    // This requires MailChannels to be configured in Cloudflare
    const emailResponse = await fetch('https://api.mailchannels.net/tx/v1/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [
          {
            to: [{ email: to }],
          },
        ],
        from: {
          email: env.SUPPORT_EMAIL || 'noreply@localfirst.site',
          name: 'Local First Arizona',
        },
        subject: subject,
        content: [
          {
            type: 'text/html',
            value: htmlBody,
          },
        ],
      }),
    });

    if (!emailResponse.ok) {
      const errorText = await emailResponse.text();
      console.error('Email sending failed:', errorText);
      // Don't throw - email failure shouldn't block ticket creation
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error sending email:', error);
    // Don't throw - email failure shouldn't block ticket creation
    return false;
  }
}

// Submit bug report
support.post('/bug-report', async (c) => {
  try {
    console.log('[SUPPORT] Bug report submission received');
    const db = c.get('db');
    
    if (!db) {
      console.error('[SUPPORT] Database not available');
      return c.json({ error: 'Database not available' }, 500);
    }

    const body = await c.req.json();
    console.log('[SUPPORT] Request body:', body);
    const { email, description, userId } = body;

    if (!email || !description) {
      console.log('[SUPPORT] Missing required fields');
      return c.json({ error: 'Email and description are required' }, 400);
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return c.json({ error: 'Invalid email format' }, 400);
    }

    // Generate unique ticket number
    let ticketNumber;
    let isUnique = false;
    let attempts = 0;
    while (!isUnique && attempts < 10) {
      ticketNumber = generateTicketNumber();
      const existing = await db
        .select()
        .from(supportTickets)
        .where(eq(supportTickets.ticketNumber, ticketNumber))
        .limit(1);
      if (existing.length === 0) {
        isUnique = true;
      }
      attempts++;
    }

    if (!isUnique) {
      return c.json({ error: 'Failed to generate unique ticket number' }, 500);
    }

    // Create ticket
    const ticketId = crypto.randomUUID();
    console.log('[SUPPORT] Creating ticket with ID:', ticketId, 'Ticket number:', ticketNumber);
    
    await db.insert(supportTickets).values({
      id: ticketId,
      ticketNumber: ticketNumber,
      type: 'bug-report',
      userId: userId || null, // Link to user account if provided
      email: email,
      description: description,
      status: 'open',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    console.log('[SUPPORT] Ticket created successfully');

    // Send confirmation email
    const emailSubject = `Bug Report Received - Ticket #${ticketNumber}`;
    const emailBody = `
      <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #3182ce;">Thank You for Reporting a Bug</h2>
            <p>We have received your bug report and have created a ticket for tracking.</p>
            <div style="background-color: #f7fafc; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 0;"><strong>Ticket Number:</strong> <span style="font-size: 18px; color: #3182ce; font-weight: bold;">${ticketNumber}</span></p>
            </div>
            <p>Please save this ticket number to track the status of your report. Our team is working on it and will update you as soon as possible.</p>
            <p>If you have any additional information, please reply to this email with your ticket number.</p>
            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;">
            <p style="color: #666; font-size: 12px;">This is an automated message. Please do not reply directly to this email.</p>
          </div>
        </body>
      </html>
    `;

    const emailSent = await sendEmail(email, emailSubject, emailBody, c.env);
    console.log('[SUPPORT] Email sent:', emailSent);

    console.log('[SUPPORT] Returning success response');
    return c.json({
      success: true,
      ticketNumber: ticketNumber,
      message: 'Bug report submitted successfully',
    });
  } catch (error) {
    console.error('[SUPPORT] Error submitting bug report:', error);
    console.error('[SUPPORT] Error stack:', error.stack);
    return c.json({ error: 'Failed to submit bug report: ' + error.message }, 500);
  }
});

// Submit general feedback
support.post('/feedback', async (c) => {
  try {
    console.log('[SUPPORT] Feedback submission received');
    const db = c.get('db');
    
    if (!db) {
      console.error('[SUPPORT] Database not available');
      return c.json({ error: 'Database not available' }, 500);
    }

    const body = await c.req.json();
    console.log('[SUPPORT] Request body:', body);
    const { email, description, userId } = body;

    if (!description) {
      console.log('[SUPPORT] Missing description');
      return c.json({ error: 'Feedback description is required' }, 400);
    }

    // Email is optional for feedback, but if provided, validate it
    if (email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return c.json({ error: 'Invalid email format' }, 400);
      }
    }

    // Create feedback entry (no ticket number for general feedback)
    const feedbackId = crypto.randomUUID();
    const ticketNumber = `FB-${Date.now()}`;
    console.log('[SUPPORT] Creating feedback with ID:', feedbackId, 'Ticket number:', ticketNumber);
    
    await db.insert(supportTickets).values({
      id: feedbackId,
      ticketNumber: ticketNumber,
      type: 'general-feedback',
      userId: userId || null, // Link to user account if provided
      email: email || 'anonymous',
      description: description,
      status: 'open',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    console.log('[SUPPORT] Feedback created successfully');

    // Send confirmation email only if email is provided
    if (email) {
      const emailSubject = 'Thank You for Your Feedback';
      const emailBody = `
        <html>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
              <h2 style="color: #3182ce;">Thank You for Your Feedback</h2>
              <p>We have received your feedback and truly appreciate you taking the time to help us improve.</p>
              <p>Your input is valuable to us and will be reviewed by our team. We use feedback like yours to make Local First Arizona better for everyone.</p>
              <p>If you have any questions or additional feedback, please don't hesitate to reach out.</p>
              <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;">
              <p style="color: #666; font-size: 12px;">This is an automated message. Please do not reply directly to this email.</p>
            </div>
          </body>
        </html>
      `;

      const emailSent = await sendEmail(email, emailSubject, emailBody, c.env);
      console.log('[SUPPORT] Email sent:', emailSent);
    }

    console.log('[SUPPORT] Returning success response');
    return c.json({
      success: true,
      message: 'Feedback submitted successfully',
    });
  } catch (error) {
    console.error('[SUPPORT] Error submitting feedback:', error);
    console.error('[SUPPORT] Error stack:', error.stack);
    return c.json({ error: 'Failed to submit feedback: ' + error.message }, 500);
  }
});

// Get ticket status (for users to check their ticket)
support.get('/ticket/:ticketNumber', async (c) => {
  try {
    const db = c.get('db');
    const ticketNumber = c.req.param('ticketNumber');

    const ticket = await db
      .select()
      .from(supportTickets)
      .where(eq(supportTickets.ticketNumber, ticketNumber))
      .limit(1);

    if (ticket.length === 0) {
      return c.json({ error: 'Ticket not found' }, 404);
    }

    return c.json({
      ticket: {
        ticketNumber: ticket[0].ticketNumber,
        type: ticket[0].type,
        status: ticket[0].status,
        description: ticket[0].description,
        createdAt: ticket[0].createdAt,
        updatedAt: ticket[0].updatedAt,
        adminResponse: ticket[0].adminResponse,
        respondedAt: ticket[0].respondedAt,
      },
    });
  } catch (error) {
    console.error('Error fetching ticket:', error);
    return c.json({ error: 'Failed to fetch ticket' }, 500);
  }
});

export default support;

