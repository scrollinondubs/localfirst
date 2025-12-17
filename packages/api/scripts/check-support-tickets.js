#!/usr/bin/env node

/**
 * Script to check support tickets and feedback in the database
 * Usage: node scripts/check-support-tickets.js [options]
 * Options:
 *   --all        Show all tickets (default: last 20)
 *   --bug        Show only bug reports
 *   --feedback   Show only feedback
 *   --count      Show only count
 */

import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { supportTickets } from '../src/db/schema.js';
import { desc, eq } from 'drizzle-orm';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const args = process.argv.slice(2);
const showAll = args.includes('--all');
const showBugOnly = args.includes('--bug');
const showFeedbackOnly = args.includes('--feedback');
const showCountOnly = args.includes('--count');

// Connect to database (path relative to packages/api directory)
const dbPath = join(__dirname, '..', 'local.db');
const client = createClient({
  url: `file:${dbPath}`,
});

const db = drizzle(client);

async function checkTickets() {
  try {
    let query = db.select().from(supportTickets);

    // Apply filters
    if (showBugOnly) {
      query = query.where(eq(supportTickets.type, 'bug-report'));
    } else if (showFeedbackOnly) {
      query = query.where(eq(supportTickets.type, 'general-feedback'));
    }

    // Order by created date, newest first
    query = query.orderBy(desc(supportTickets.createdAt));

    // Limit if not showing all
    if (!showAll) {
      query = query.limit(20);
    }

    const tickets = await query;

    if (showCountOnly) {
      const bugCount = tickets.filter(t => t.type === 'bug-report').length;
      const feedbackCount = tickets.filter(t => t.type === 'general-feedback').length;
      console.log('\n📊 Support Tickets Summary');
      console.log('='.repeat(50));
      console.log(`🐛 Bug Reports:     ${bugCount}`);
      console.log(`💬 Feedback:        ${feedbackCount}`);
      console.log(`📝 Total:           ${tickets.length}`);
      console.log('='.repeat(50));
      return;
    }

    if (tickets.length === 0) {
      console.log('\n📭 No tickets found in the database.\n');
      return;
    }

    console.log('\n📋 Support Tickets & Feedback');
    console.log('='.repeat(100));
    console.log('');

    tickets.forEach((ticket, index) => {
      const typeIcon = ticket.type === 'bug-report' ? '🐛' : '💬';
      const typeLabel = ticket.type === 'bug-report' ? 'Bug Report' : 'Feedback';
      
      console.log(`${index + 1}. ${typeIcon} ${typeLabel}`);
      console.log(`   Ticket #: ${ticket.ticketNumber}`);
      console.log(`   Email:    ${ticket.email}`);
      console.log(`   Status:   ${ticket.status}`);
      console.log(`   Created:  ${new Date(ticket.createdAt).toLocaleString()}`);
      console.log(`   Description: ${ticket.description.substring(0, 80)}${ticket.description.length > 80 ? '...' : ''}`);
      
      if (ticket.adminResponse) {
        console.log(`   Admin Response: ${ticket.adminResponse.substring(0, 80)}${ticket.adminResponse.length > 80 ? '...' : ''}`);
      }
      
      console.log('');
    });

    console.log('='.repeat(100));
    console.log(`\nTotal: ${tickets.length} ticket(s)\n`);

  } catch (error) {
    console.error('❌ Error checking tickets:', error);
    process.exit(1);
  }
}

checkTickets();

