# AI Service Setup Guide

Your AI CRM platform is now configured to use OpenAI for intelligent content generation and decision making. Here's how to set it up:

## 1. Get an OpenAI API Key

1. Go to [OpenAI's website](https://platform.openai.com/)
2. Sign up or log in to your account
3. Navigate to the API section
4. Create a new API key
5. Copy the API key (it starts with `sk-`)

## 2. Configure the Secret in Leap

1. In your Leap dashboard, go to the **Infrastructure** tab
2. Find the **Secrets** section
3. Add a new secret with:
   - **Name**: `OpenAIKey`
   - **Value**: Your OpenAI API key (the one starting with `sk-`)
4. Save the secret

## 3. What the AI Service Provides

With the OpenAI key configured, your platform will have:

### 🤖 **Intelligent Content Generation**
- Personalized email content based on prospect data
- SMS messages optimized for engagement  
- Social media content tailored to the prospect's stage
- Dynamic subject lines and calls-to-action

### 🧠 **Smart Decision Making**
- Automated lead classification and scoring
- Intelligent nurturing sequence recommendations
- HubSpot automation decisions based on prospect behavior
- Real-time insights and recommendations

### 📊 **AI-Powered Features**
- Lead classification: Hot, Warm, Cold, Nurture, Unqualified
- Stage identification: Awareness, Interest, Consideration, Intent, Evaluation, Purchase
- Behavioral pattern analysis
- Personalized content recommendations

## 4. Fallback Behavior

**Don't worry if you don't set up the API key immediately!** 

The system includes intelligent fallbacks:
- **Without API key**: Uses high-quality template-based content generation
- **With API key**: Unlocks full AI-powered personalization and decision making
- **On errors**: Automatically falls back to rule-based systems

## 5. Cost Considerations

- OpenAI API usage is pay-per-use
- The platform uses `gpt-4o-mini` for cost efficiency
- Typical usage: $0.001-0.01 per AI generation
- You can monitor usage in your OpenAI dashboard

## 6. Testing the Setup

Once configured, test the AI features:

1. **Create a prospect** in the CRM
2. **Generate content** using the nurturing campaigns
3. **Check the HubSpot integration** for automated decisions
4. **Review AI insights** in the prospect classification section

The AI will provide reasoning for all its decisions, so you can see how it's working!

---

**Need help?** The AI service is designed to work seamlessly whether or not you have the API key configured. Start using the platform immediately and add AI power when you're ready!