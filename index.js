// Load environment variables from .env file
require('dotenv').config();

const { Client, GatewayIntentBits, Partials, Events } = require('discord.js');
const { OpenAI } = require('openai');
const fs = require('fs');

// Create a new Discord client with necessary intents to read messages
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds, // For guild-related events
    GatewayIntentBits.GuildMessages, // To listen to messages in guilds
    GatewayIntentBits.MessageContent, // To read the content of messages
  ],
  partials: [Partials.Channel], // To handle partial data if needed
});

// Initialize OpenAI client with your API key
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// File path to save user conversation memory
const memoryFile = './memory.json';
let memory = {};

// Load previous memory from file if exists, else start fresh
if (fs.existsSync(memoryFile)) {
  try {
    memory = JSON.parse(fs.readFileSync(memoryFile, 'utf8'));
  } catch {
    console.warn('Warning: Could not read memory file, starting fresh.');
    memory = {};
  }
} else {
  // Create empty memory file if it doesn't exist
  fs.writeFileSync(memoryFile, JSON.stringify(memory, null, 2));
}

// When bot is ready, log a confirmation
client.once(Events.ClientReady, () => {
  console.log(`✅ Logged in as ${client.user.tag}!`);
});

// Listen for messages and respond to those starting with "!ask"
client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot) return; // Ignore other bots
  if (!message.content.toLowerCase().startsWith('!ask')) return; // Only respond to !ask

  const userId = message.author.id;
  const input = message.content.slice(4).trim(); // Remove "!ask" and get the question

  if (!input) {
    return message.reply('👋 Please ask a question after `!ask`. I\'m here to help!');
  }

  // Initialize memory for user if none exists
  if (!memory[userId]) memory[userId] = [];

  // Add user's message to memory
  memory[userId].push({ role: 'user', content: input });

  try {
    // Call OpenAI chat completion with recent conversation history
    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo', // Using GPT-3.5 turbo for broad access
      messages: [
        { role: 'system', content: 'You are a friendly and helpful Discord assistant.' },
        ...memory[userId].slice(-10), // Keep last 10 messages to stay within token limits
      ],
    });

    const botReply = response.choices[0].message.content;

    // Save assistant's reply to memory
    memory[userId].push({ role: 'assistant', content: botReply });

    // Write updated memory back to the file
    fs.writeFileSync(memoryFile, JSON.stringify(memory, null, 2));

    // Reply in Discord channel
    await message.reply(botReply);
  } catch (error) {
    console.error('OpenAI API error:', error.response?.data || error.message || error);
    message.reply('😕 Sorry, something went wrong while trying to answer that.');
  }
});

// Log in to Discord using your bot token from .env file
client.login(process.env.BOT_TOKEN);
