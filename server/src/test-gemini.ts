import { GoogleGenerativeAI } from '@google/generative-ai';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env variables
dotenv.config({ path: path.join(__dirname, '../.env') });

async function listModels() {
  const apiKey = process.env.GEMINI_API_KEY;
  console.log('🔑 Testing API Key:', apiKey ? apiKey.substring(0, 10) + '...' : 'MISSING');

  if (!apiKey) {
    console.error('❌ Error: GEMINI_API_KEY is not defined in server/.env');
    return;
  }

  const genAI = new GoogleGenerativeAI(apiKey);

  try {
    console.log('🔄 Fetching list of models available to this key...');
    const result = await (genAI as any).listModels();
    console.log('--- Available Models ---');
    for (const model of result.models) {
      console.log(`- Name: ${model.name} (Supported: ${model.supportedGenerationMethods.join(', ')})`);
    }
  } catch (err: any) {
    console.error('❌ Failed to list models:', err.message);
  }
}

listModels();
