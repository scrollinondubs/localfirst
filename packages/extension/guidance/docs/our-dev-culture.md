### Daily Standup Process

**Purpose**: Start each development day with tactical planning and alignment, just like a real startup team.

**Format**: Live discussion covering:
- **Yesterday's Accomplishments**: Review completed features and deployments
- **Today's Focus**: Identify highest priority Todo items in Linear
- **Blockers**: Discuss any impediments or dependencies
- **Key Learnings**: Insights from recent retrospectives
- **Planning Decisions**: Prioritize work and set daily goals

**Documentation**: Create summary in `/guidance/standups/{YYYY-MM-DD}-standup.md`

**Timing**: First thing each development day, before diving into implementation work

**Command Shortcut**: When user says "Let's do our standup", execute this process automatically and generate the standup document.

### Session Retrospectives

**Purpose**: Capture key learnings and insights from each development session, since features and sessions don't correlate one-to-one.

**Format**: `/guidance/retrospectives/Sessions/{YYYY-MM-DD}-session-{number}.md`

**When to Create**: When the user says "Let's do a session retrospective."

**Focus Areas**:
- **Technical Insights**: New patterns, debugging approaches, or architectural decisions discovered
- **Process Learnings**: What worked well or could be improved in our collaboration
- **Problem-Solving Breakthroughs**: Key moments where we overcame blockers or challenges
- **Context for Future Sessions**: Important state or decisions that should carry forward

**Template Structure**:
```markdown
# Session Retrospective - {Date} - Session {Number}

## Session Overview
- **Duration**: {X} hours
- **Primary Focus**: {Main features/issues worked on}
- **Completion Status**: {What was finished vs in-progress}

## Key Technical Insights
- **{Learning Category}**: {Specific insight discovered}
- **{Learning Category}**: {Specific insight discovered}

## Collaboration Highlights
- **Effective Approaches**: {What worked well in our process}
- **Process Improvements**: {Ideas for better workflow}

## Challenges Encountered
- **{Challenge}**: {Description and approach taken}
- **{Challenge}**: {Description and approach taken}

## Context for Next Session
- **Current State**: {Where we left off}
- **Next Priorities**: {What should be tackled next}
- **Important Notes**: {Key context to remember}

---
*Session retrospective for cross-session learning and continuity.*
```

**Usage**: These session retrospectives feed into daily standups and blog post generation, providing richer context about our development process.


---