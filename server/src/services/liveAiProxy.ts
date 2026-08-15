import { WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import { dbStore } from './dbStore';
import { RAGService } from './rag.service';

const GEMINI_LIVE_URL = 'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent';

// Tool Declarations for Gemini Live
const liveTools = [
  {
    functionDeclarations: [
      {
        name: 'createMeeting',
        description: 'Schedules a new meeting workspace in the system.',
        parameters: {
          type: 'OBJECT',
          properties: {
            title: { type: 'STRING', description: 'The title of the meeting' },
            startTime: { type: 'STRING', description: 'ISO date time string when the meeting starts' },
            endTime: { type: 'STRING', description: 'ISO date time string when the meeting ends' }
          },
          required: ['title', 'startTime', 'endTime']
        }
      },
      {
        name: 'moveMeetingToFolder',
        description: 'Moves a meeting workspace to a specific folder.',
        parameters: {
          type: 'OBJECT',
          properties: {
            meetingId: { type: 'STRING', description: 'The unique ID of the meeting' },
            folderId: { type: 'STRING', description: 'The unique ID of the folder' }
          },
          required: ['meetingId', 'folderId']
        }
      },
      {
        name: 'searchMeetings',
        description: 'Searches the meeting history and transcripts for questions or decisions.',
        parameters: {
          type: 'OBJECT',
          properties: {
            query: { type: 'STRING', description: 'The query to search' }
          },
          required: ['query']
        }
      }
    ]
  }
];

export function handleLiveAiConnection(clientWs: WebSocket, req: IncomingMessage) {
  console.log('🤖 Client upgrading to Gemini Live Proxy connection');
  
  const apiKey = process.env.GEMINI_API_KEY;
  
  // If API key is missing, run in Simulated Mock Live Mode
  if (!apiKey) {
    setupSimulatedLiveAi(clientWs);
    return;
  }

  // Connect to Google's Multimodal Live API WebSocket
  const geminiWsUrl = `${GEMINI_LIVE_URL}?key=${apiKey}`;
  const geminiWs = new WebSocket(geminiWsUrl);

  // Relay client messages to Gemini
  clientWs.on('message', (message, isBinary) => {
    if (geminiWs.readyState === WebSocket.OPEN) {
      geminiWs.send(message, { binary: isBinary });
    }
  });

  // Relay Gemini messages to client, and intercept function calls
  geminiWs.on('message', async (message) => {
    try {
      const dataStr = message.toString();
      const response = JSON.parse(dataStr);

      // Check if it's a function call from Gemini Live
      if (response.toolCall) {
        await handleToolCalls(response.toolCall, geminiWs, clientWs);
        return; // Handled, do not forward raw toolCall to client
      }

      // Forward contents to client
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(message);
      }
    } catch (err) {
      // Binary audio packets from Gemini or non-JSON content
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(message);
      }
    }
  });

  // Setup Live API configuration once Gemini connection opens
  geminiWs.on('open', () => {
    console.log('✅ Connected to Google Gemini Live API');
    
    const setupMessage = {
      setup: {
        model: 'models/gemini-2.5-flash', // Multimodal Live API model
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: 'Aoede' // clear feminine voice
              }
            }
          }
        },
        tools: liveTools
      }
    };
    geminiWs.send(JSON.stringify(setupMessage));
  });

  // Close connections
  clientWs.on('close', () => {
    console.log('🔌 Client disconnected from Live Proxy');
    geminiWs.close();
  });

  geminiWs.on('close', () => {
    console.log('🔌 Gemini Live API connection closed');
    clientWs.close();
  });

  geminiWs.on('error', (err) => {
    console.error('⚠️ Gemini Live API WebSocket error:', err.message);
  });
}

/**
 * Handle function/tool execution intercepted from Gemini Live
 */
async function handleToolCalls(toolCall: any, geminiWs: WebSocket, clientWs: WebSocket) {
  const functionCalls = toolCall.functionCalls || [];
  const functionResponses: any[] = [];

  for (const call of functionCalls) {
    const { name, args, id } = call;
    console.log(`🛠️ Gemini Live Tool Invoked: ${name} with args:`, args);

    let result: any = { success: false };

    try {
      if (name === 'createMeeting') {
        const meet = await dbStore.createMeeting({
          title: args.title,
          description: 'Scheduled automatically by MeetMind Voice Assistant.',
          startTime: new Date(args.startTime),
          endTime: new Date(args.endTime),
          createdBy: 'default-user-id',
          participants: [],
          folderId: null,
          status: 'scheduled',
          transcript: []
        });
        result = { success: true, meetingId: meet._id, message: `Meeting "${meet.title}" scheduled successfully.` };
        
        // Notify client side browser UI to refresh dashboard/meetings
        clientWs.send(JSON.stringify({
          type: 'notification',
          text: `AI Voice scheduled: "${meet.title}"`
        }));
      } 
      else if (name === 'moveMeetingToFolder') {
        const moved = await dbStore.updateMeeting(args.meetingId, { folderId: args.folderId });
        result = { success: !!moved, message: moved ? 'Meeting moved successfully.' : 'Failed to find meeting.' };
        
        clientWs.send(JSON.stringify({
          type: 'notification',
          text: 'AI Voice moved meeting to folder.'
        }));
      } 
      else if (name === 'searchMeetings') {
        const searchResult = await RAGService.queryKnowledgeBase('default-user-id', args.query);
        result = { answer: searchResult.answer };
      }
    } catch (err: any) {
      result = { success: false, error: err.message };
    }

    functionResponses.push({
      name,
      response: { output: result },
      id
    });
  }

  // Send result back to Gemini Live
  const responseMessage = {
    toolResponse: {
      functionResponses
    }
  };

  if (geminiWs.readyState === WebSocket.OPEN) {
    geminiWs.send(JSON.stringify(responseMessage));
  }
}

/**
 * Fallback simulator if Gemini API is disabled
 */
function setupSimulatedLiveAi(clientWs: WebSocket) {
  console.log('🤖 Gemini Live Simulator Active for client');

  clientWs.on('message', (message) => {
    try {
      const dataStr = message.toString();
      const response = JSON.parse(dataStr);
      
      // If client requests setup, reply with success
      if (response.setup) {
        clientWs.send(JSON.stringify({ type: 'setup_complete' }));
      }
    } catch (err) {
      // In binary mic audio, do nothing in mock mode to avoid flooding
    }
  });

  // Periodically send mock speech responses
  const interval = setInterval(() => {
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.send(JSON.stringify({
        serverContent: {
          modelTurn: {
            parts: [{
              text: "Hello! I am MeetMind AI. I can assist you with scheduling, organizing, and retrieving information from your meetings."
            }]
          }
        }
      }));
    }
  }, 15000);

  clientWs.on('close', () => {
    clearInterval(interval);
  });
}
