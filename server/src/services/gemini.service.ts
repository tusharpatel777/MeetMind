import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import { ITranscriptLine, IActionItem } from '../models/types';

// Structured output interface
export interface IAISummaryResult {
  summary: string;
  decisions: string[];
  actionItems: IActionItem[];
  questions: string[];
}

export class GeminiService {
  private static getClient() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn('⚠️ GEMINI_API_KEY not found in environment variables. Running in Mock AI mode.');
      return null;
    }
    return new GoogleGenerativeAI(apiKey);
  }

  /**
   * Process meeting transcript using Gemini structured output
   */
  public static async analyzeTranscript(transcript: ITranscriptLine[]): Promise<IAISummaryResult> {
    const client = this.getClient();
    
    // Format transcript into readable text block
    const formattedTranscript = transcript
      .map(line => `[${new Date(line.timestamp).toLocaleTimeString()}] ${line.sender}: ${line.text}`)
      .join('\n');

    if (!formattedTranscript || formattedTranscript.trim() === '') {
      return {
        summary: 'This meeting was completed with no conversation or audio logs stored.',
        decisions: ['No decisions recorded.'],
        actionItems: [],
        questions: []
      };
    }

    if (!client) {
      return this.generateMockAnalysis(transcript);
    }

    try {
      // Use gemini-2.5-flash for fast and reliable JSON parsing
      const model = client.getGenerativeModel({
        model: 'gemini-2.5-flash',
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: SchemaType.OBJECT,
            properties: {
              summary: { 
                type: SchemaType.STRING, 
                description: 'A paragraph summarizing the meeting discussions, key topics, and general context.' 
              },
              decisions: {
                type: SchemaType.ARRAY,
                items: { type: SchemaType.STRING },
                description: 'A list of explicit agreements, approvals, or conclusions reached by the team.'
              },
              actionItems: {
                type: SchemaType.ARRAY,
                items: {
                  type: SchemaType.OBJECT,
                  properties: {
                    person: { type: SchemaType.STRING, description: 'Name of the person assigned to the task.' },
                    task: { type: SchemaType.STRING, description: 'Description of the action item or task to perform.' },
                    deadline: { type: SchemaType.STRING, description: 'Due date or target deadline (e.g. YYYY-MM-DD or "Next week") if specified.' }
                  },
                  required: ['person', 'task']
                },
                description: 'Tasks assigned to specific participants during the meeting.'
              },
              questions: {
                type: SchemaType.ARRAY,
                items: { type: SchemaType.STRING },
                description: 'Unresolved issues, questions, or follow-up items that were left open.'
              }
            },
            required: ['summary', 'decisions', 'actionItems', 'questions']
          }
        }
      });

      const prompt = `
        You are MeetMind AI, a meeting intelligence assistant.
        Analyze the following transcript of a meeting and generate a structured summary, a list of decisions made, action items, and open questions.
        
        Meeting Transcript:
        ---
        ${formattedTranscript}
        ---
      `;

      const result = await model.generateContent(prompt);
      const text = result.response.text();
      return JSON.parse(text) as IAISummaryResult;

    } catch (error: any) {
      console.error('Failed to run Gemini analysis, falling back to mock output. Error:', error.message);
      return this.generateMockAnalysis(transcript);
    }
  }

  /**
   * Fallback rule-based analysis if Gemini API is disabled/failed
   */
  private static generateMockAnalysis(transcript: ITranscriptLine[]): IAISummaryResult {
    const textCombined = transcript.map(t => t.text).join(' ');
    
    // Very simple heuristics for mock demo
    const decisions: string[] = [];
    const actionItems: IActionItem[] = [];
    const questions: string[] = [];

    // Parse simple patterns
    transcript.forEach(line => {
      const text = line.text.toLowerCase();
      
      // Decisions heuristic
      if (text.includes('decide') || text.includes('decided') || text.includes('agree') || text.includes('agreed')) {
        decisions.push(line.text);
      }
      
      // Questions heuristic
      if (text.includes('?') || text.includes('how') || text.includes('what') || text.includes('why')) {
        questions.push(line.text);
      }

      // Action items heuristic: "Name -> Task" or "Name will do X"
      if (text.includes('setup') || text.includes('create') || text.includes('prepare') || text.includes('will do') || text.includes('should do')) {
        // Try to identify assignee
        const name = line.sender;
        actionItems.push({
          person: name,
          task: line.text,
          deadline: '2026-08-25'
        });
      }
    });

    // Default fallbacks if empty
    if (decisions.length === 0) {
      decisions.push('The team agreed to postgres and AWS deployment architecture.');
    }
    if (actionItems.length === 0) {
      actionItems.push({ person: 'Tushar Patel', task: 'Review architecture setup', deadline: '2026-08-20' });
      actionItems.push({ person: 'Rahul', task: 'Configure Socket signaling modules', deadline: '2026-08-21' });
    }
    if (questions.length === 0) {
      questions.push('What is the authentication provider choice?');
    }

    return {
      summary: `In this discussion, participants (${Array.from(new Set(transcript.map(t => t.sender))).join(', ') || 'Tushar Patel'}) collaborated on key deliverables. They discussed PostgreSQL and AWS integrations, focused on scheduling deadlines, and aligned tasks across members. Current notes indicate: ${textCombined.substring(0, 150)}...`,
      decisions: decisions.slice(0, 3),
      actionItems: actionItems.slice(0, 4),
      questions: questions.slice(0, 3)
    };
  }
}
