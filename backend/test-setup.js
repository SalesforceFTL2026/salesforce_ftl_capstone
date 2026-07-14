import dotenv from 'dotenv';
dotenv.config();

console.log('\n🔍 Testing MapResponse Backend Setup...\n');

// Check environment variables
console.log('✅ Environment Variables:');
console.log(`   DATABASE_URL: ${process.env.DATABASE_URL ? '✓ Set' : '✗ Missing'}`);
console.log(`   ANTHROPIC_API_KEY: ${process.env.ANTHROPIC_API_KEY ? '✓ Set' : '✗ Missing'}`);
console.log(`   OPENAI_API_KEY: ${process.env.OPENAI_API_KEY ? '✓ Set' : '✗ Missing'}`);
console.log(`   PORT: ${process.env.PORT || 3000}`);

// Test Claude API
if (process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY !== 'sk-ant-your-key-here') {
  console.log('\n🤖 Testing Claude API...');
  try {
    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    
    const message = await anthropic.messages.create({
      model: "claude-3-5-haiku-20241022",
      max_tokens: 50,
      messages: [{ role: "ay 'API working!'" }]
    });
    
    console.log(`   ✓ Claude API: ${message.content[0].text}`);
  } catch (error) {
    console.log(`   ✗ Claude API Error: ${error.message}`);
  }
} else {
  console.log('\n⚠️  Skipping Claude API test (no key set)');
}

// Test OpenAI API
if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'sk-your-key-here') {
  console.log('\n🔮 Testing OpenAI Embeddings API...');
  try {
    const { default: OpenAI } = await import('openai');
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    
    const response = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: "test",
    });
    
    console.log(`   ✓ OpenAI API: Embedding length ${response.data[0].embedding.length}`);
  } catch (error) {
    console.log(`   ✗ OpenAI API Error: ${error.message}`);
  }
} else {
  console.log('\n⚠️  Skipping OpenAI API test (no key set)');
}

console.log('\n✅ Setup test complete!\n');
