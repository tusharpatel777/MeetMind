const dotenv = require('dotenv');
const path = require('path');

// Load .env variables
dotenv.config({ path: path.join(__dirname, '../.env') });

const modelsToTest = [
  'gemini-3.1-flash',
  'gemini-3.1-flash-preview',
  'gemini-2.5-flash'
];

async function test31Models() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return;

  for (const model of modelsToTest) {
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: 'Hello' }] }] })
      });
      console.log(`[${model}] Status: ${res.status} ${res.statusText}`);
      if (res.ok) {
        const data = await res.json();
        console.log(`✅ Success for ${model}! Response:`, data.candidates?.[0]?.content?.parts?.[0]?.text);
      } else {
        const errData = await res.json().catch(() => ({}));
        console.log(`❌ Error for ${model}:`, errData.error?.message);
      }
    } catch (err) {
      console.error(`❌ Request failed for ${model}:`, err.message);
    }
  }
}

test31Models();
