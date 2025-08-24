import { Hono } from 'hono';
import { conversationSessions, consumerProfiles, users } from '../db/schema.js';
import { eq, desc, and } from 'drizzle-orm';
import OpenAI from 'openai';

const interview = new Hono();

// Initialize OpenAI dynamically per request (for Cloudflare Workers)
function createOpenAIClient(env) {
  try {
    if (env.OPENAI_API_KEY) {
      return new OpenAI({
        apiKey: env.OPENAI_API_KEY
      });
    } else {
      console.warn('OPENAI_API_KEY not found. Interview functionality will be limited.');
      return null;
    }
  } catch (error) {
    console.error('Error initializing OpenAI:', error);
    return null;
  }
}

// AI Interviewer system prompt
const INTERVIEWER_PROMPT = `You are a friendly, conversational local business concierge helping someone discover amazing Arizona businesses that match their personal interests and lifestyle.

Your Goal: Have a natural conversation to build a rich profile covering:

PRIMARY FOCUS AREAS:
- Hobbies & interests (what they do for fun, passions, activities)
- Lifestyle & preferences (values, priorities, how they spend time)
- Gift-giving (who they buy gifts for, what those people like, occasions)
- Shopping habits & preferences (what they value: quality, price, uniqueness, convenience)
- Upcoming needs & anticipated purchases
- Special occasions or events they're planning for

CONVERSATION STYLE:
- Be warm, curious, and genuinely interested (like a friend who wants to recommend great local spots)
- Ask natural follow-up questions based on what they share
- Keep it conversational, not like a survey or interview
- Show enthusiasm about their interests
- Make connections between their interests and potential local business types

DISCOVERY STRATEGY:
- Start with broad interests, then get specific
- When they mention an interest, dig deeper: "What do you love most about that?"
- Ask about the people in their life: "Who do you usually shop for?" 
- Explore their preferences: "What draws you to places you love?"
- After 10-15 natural exchanges, you can suggest wrapping up but continue if they're engaged

Keep responses concise but warm. Focus on understanding them as a person so you can connect them with perfect local Arizona businesses.`;

// Start or get existing interview session
interview.get('/session', async (c) => {
  try {
    const userId = c.req.header('X-User-ID');
    if (!userId) {
      return c.json({ error: 'User ID required' }, 401);
    }

    const db = c.get('db');

    // Look for existing active session
    const existingSession = await db.select()
      .from(conversationSessions)
      .where(and(
        eq(conversationSessions.userId, userId),
        eq(conversationSessions.sessionStatus, 'active')
      ))
      .orderBy(desc(conversationSessions.lastActivity))
      .limit(1);

    if (existingSession.length > 0) {
      const session = existingSession[0];
      return c.json({
        sessionId: session.id,
        messages: JSON.parse(session.messages || '[]'),
        messageCount: session.messageCount,
        status: session.sessionStatus,
        lastActivity: session.lastActivity
      });
    }

    // Create new session with welcome message
    const sessionId = crypto.randomUUID();
    const welcomeMessage = {
      role: 'assistant',
      content: "Hi! I'm here to help you discover amazing local Arizona businesses that match your interests. Let's have a quick chat so I can get to know what you're into. What do you like to do in your free time?",
      timestamp: new Date().toISOString()
    };

    await db.insert(conversationSessions).values({
      id: sessionId,
      userId: userId,
      messages: JSON.stringify([welcomeMessage]),
      messageCount: 1,
      sessionStatus: 'active'
    });

    return c.json({
      sessionId: sessionId,
      messages: [welcomeMessage],
      messageCount: 1,
      status: 'active',
      isNew: true
    });

  } catch (error) {
    console.error('Error getting interview session:', error);
    // Return more detailed error in development
    const errorMessage = c.env?.NODE_ENV === 'production' 
      ? 'Failed to get session' 
      : `Failed to get session: ${error.message}`;
    return c.json({ error: errorMessage }, 500);
  }
});

// Process user message and get AI response
interview.post('/message', async (c) => {
  try {
    const { sessionId, message } = await c.req.json();
    const userId = c.req.header('X-User-ID');

    if (!sessionId || !message || !userId) {
      return c.json({ error: 'Session ID, message, and user ID required' }, 400);
    }

    const db = c.get('db');

    // Get current session
    const session = await db.select()
      .from(conversationSessions)
      .where(and(
        eq(conversationSessions.id, sessionId),
        eq(conversationSessions.userId, userId)
      ))
      .limit(1);

    if (session.length === 0) {
      return c.json({ error: 'Session not found' }, 404);
    }

    const currentSession = session[0];
    const messages = JSON.parse(currentSession.messages || '[]');

    // Add user message
    const userMessage = {
      role: 'user',
      content: message.trim(),
      timestamp: new Date().toISOString()
    };
    messages.push(userMessage);

    // Prepare conversation context for OpenAI (last 10 messages to keep context manageable)
    const contextMessages = messages.slice(-10).map(msg => ({
      role: msg.role,
      content: msg.content
    }));

    // Get AI response
    let aiResponse;
    const openai = createOpenAIClient(c.env);
    if (openai) {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          { role: 'system', content: INTERVIEWER_PROMPT },
          ...contextMessages
        ],
        temperature: 0.7,
        max_tokens: 300
      });
      aiResponse = completion.choices[0].message.content.trim();
    } else {
      // Fallback response when OpenAI is not available
      const fallbackResponses = [
        "That's really interesting! Can you tell me more about that?",
        "I'd love to hear more about what you enjoy doing in your free time.",
        "What kinds of places do you like to shop or visit?",
        "Are there any special occasions coming up that you're planning for?",
        "What do you value most when choosing where to spend your money?"
      ];
      aiResponse = fallbackResponses[Math.floor(Math.random() * fallbackResponses.length)];
    }

    // Add AI response to messages
    const assistantMessage = {
      role: 'assistant',
      content: aiResponse,
      timestamp: new Date().toISOString()
    };
    messages.push(assistantMessage);

    // Calculate profile completeness based on conversation length and depth
    const profileCompleteness = Math.min(100, Math.floor((messages.length / 2) * 5)); // Rough estimate

    // Update session
    await db.update(conversationSessions)
      .set({
        messages: JSON.stringify(messages),
        messageCount: messages.length,
        lastActivity: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      })
      .where(eq(conversationSessions.id, sessionId));

    // Update user profile completeness every few messages
    if (messages.length % 6 === 0) { // Every 3 exchanges
      await updateProfileCompleteness(db, userId, messages, profileCompleteness);
    }

    return c.json({
      aiResponse: aiResponse,
      messageCount: messages.length,
      profileCompleteness: profileCompleteness
    });

  } catch (error) {
    console.error('Error processing message:', error);
    // Return more detailed error in development
    const errorMessage = c.env?.NODE_ENV === 'production' 
      ? 'Failed to process message' 
      : `Failed to process message: ${error.message}`;
    return c.json({ error: errorMessage }, 500);
  }
});

// Complete interview and extract final profile insights
interview.post('/complete', async (c) => {
  try {
    const { sessionId } = await c.req.json();
    const userId = c.req.header('X-User-ID');

    if (!sessionId || !userId) {
      return c.json({ error: 'Session ID and user ID required' }, 400);
    }

    const db = c.get('db');

    // Get session
    const session = await db.select()
      .from(conversationSessions)
      .where(and(
        eq(conversationSessions.id, sessionId),
        eq(conversationSessions.userId, userId)
      ))
      .limit(1);

    if (session.length === 0) {
      return c.json({ error: 'Session not found' }, 404);
    }

    const currentSession = session[0];
    const messages = JSON.parse(currentSession.messages || '[]');

    // Extract insights from full conversation
    const insights = await extractProfileInsights(messages, c.env);
    
    // Generate summary
    const summary = await generateProfileSummary(messages, c.env);

    const profileCompleteness = Math.min(100, Math.floor((messages.length / 2) * 6));

    // Update session as completed
    await db.update(conversationSessions)
      .set({
        sessionStatus: 'completed',
        sessionEnd: new Date().toISOString(),
        extractedTopics: JSON.stringify(insights),
        updatedAt: new Date().toISOString()
      })
      .where(eq(conversationSessions.id, sessionId));

    // Update user profile with full transcript and insights
    await updateProfileCompleteness(db, userId, messages, profileCompleteness, summary, insights);

    return c.json({
      status: 'completed',
      profileCompleteness: profileCompleteness,
      insights: insights,
      summary: summary
    });

  } catch (error) {
    console.error('Error completing interview:', error);
    return c.json({ error: 'Failed to complete interview' }, 500);
  }
});

// Helper function to update profile completeness
async function updateProfileCompleteness(db, userId, messages, completeness, summary = null, insights = null) {
  try {
    // Check if profile exists
    const existingProfile = await db.select()
      .from(consumerProfiles)
      .where(eq(consumerProfiles.userId, userId))
      .limit(1);

    const updateData = {
      profileCompleteness: completeness,
      lastInterviewDate: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    if (summary) updateData.interviewSummary = summary;
    if (insights) updateData.interviewInsights = JSON.stringify(insights);
    if (messages) updateData.interviewTranscript = JSON.stringify(messages);

    if (existingProfile.length > 0) {
      await db.update(consumerProfiles)
        .set(updateData)
        .where(eq(consumerProfiles.userId, userId));
    } else {
      await db.insert(consumerProfiles).values({
        id: crypto.randomUUID(),
        userId: userId,
        ...updateData
      });
    }
  } catch (error) {
    console.error('Error updating profile completeness:', error);
  }
}

// Extract structured insights from conversation
async function extractProfileInsights(messages, env) {
  try {
    const openai = createOpenAIClient(env);
    if (!openai) {
      // Simple keyword extraction when OpenAI is not available
      const conversation = messages
        .filter(msg => msg.role === 'user')
        .map(msg => msg.content.toLowerCase())
        .join(' ');
      
      const keywords = conversation.split(/\s+/).filter(word => word.length > 3);
      return {
        interests: keywords.slice(0, 5),
        upcomingNeeds: [],
        values: [],
        giftGiving: [],
        businessTypes: [],
        budgetStyle: 'unknown',
        shoppingStyle: 'unknown'
      };
    }

    const conversation = messages
      .filter(msg => msg.role === 'user')
      .map(msg => msg.content)
      .join('\n');

    const extractionPrompt = `Analyze this conversation and extract specific interests, needs, and preferences that would be useful for recommending local businesses. Return a JSON object with these categories:

Conversation:
${conversation}

Extract and return JSON in this format:
{
  "interests": ["specific hobby 1", "specific hobby 2"],
  "upcomingNeeds": ["specific purchase need", "upcoming event need"],
  "values": ["environmental consciousness", "supporting local"],
  "giftGiving": ["anniversary gifts", "gifts for parents"],
  "businessTypes": ["coffee shops", "vintage stores", "auto repair"],
  "budgetStyle": "value-conscious", 
  "shoppingStyle": "prefers unique finds"
}

Only include specific, actionable insights. Return valid JSON only.`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: 'You are a data extraction expert. Return only valid JSON.' },
        { role: 'user', content: extractionPrompt }
      ],
      temperature: 0.3,
      max_tokens: 500
    });

    const result = response.choices[0].message.content.trim();
    return JSON.parse(result);
  } catch (error) {
    console.error('Error extracting insights:', error);
    return {
      interests: [],
      upcomingNeeds: [],
      values: [],
      giftGiving: [],
      businessTypes: [],
      budgetStyle: 'unknown',
      shoppingStyle: 'unknown'
    };
  }
}

// Generate readable summary of user profile
async function generateProfileSummary(messages, env) {
  try {
    const openai = createOpenAIClient(env);
    if (!openai) {
      // Simple summary when OpenAI is not available
      const userMessages = messages
        .filter(msg => msg.role === 'user')
        .map(msg => msg.content)
        .slice(0, 3);
      
      if (userMessages.length === 0) {
        return 'User profile is being developed through conversation.';
      }
      
      return `User has shared information about: ${userMessages.join(', ').substring(0, 200)}...`;
    }

    const conversation = messages.map(msg => 
      `${msg.role}: ${msg.content}`
    ).join('\n');

    const summaryPrompt = `Based on this conversation, write a 2-3 sentence summary of this person's interests and preferences that would help recommend local businesses to them:

${conversation}

Focus on specific interests, lifestyle, values, and needs that emerged from the conversation.`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: 'You are a profile summarization expert. Write clear, concise summaries.' },
        { role: 'user', content: summaryPrompt }
      ],
      temperature: 0.5,
      max_tokens: 200
    });

    return response.choices[0].message.content.trim();
  } catch (error) {
    console.error('Error generating summary:', error);
    return 'Profile summary unavailable.';
  }
}

export { interview };