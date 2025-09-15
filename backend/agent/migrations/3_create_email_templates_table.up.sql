CREATE TABLE email_templates (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  template_type TEXT NOT NULL CHECK (template_type IN ('initial_outreach', 'follow_up', 'business_builder', 'product_customer')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO email_templates (name, subject, body, template_type) VALUES
('Initial Business Builder Outreach', 'Expanding my Nu Skin team - interested?', 'Hi {{name}},

I came across your profile and was impressed by your {{position}} background at {{company}}. 

I''m currently expanding my Nu Skin team and looking for ambitious professionals who want to build a business alongside their career. Our business model has helped many people create additional income streams and even replace their full-time income.

Would you be open to a brief conversation about this opportunity?

Best regards,
{{agent_name}}', 'business_builder'),

('Initial Product Customer Outreach', 'Premium skincare recommendation', 'Hi {{name}},

I noticed you might be interested in premium skincare solutions based on your profile.

Nu Skin has been a game-changer for me and many others. Our products are backed by science and deliver real results. I''d love to share some information about our anti-aging line that might interest you.

Would you like to learn more?

Best,
{{agent_name}}', 'product_customer'),

('Follow-up', 'Following up on Nu Skin opportunity', 'Hi {{name}},

I wanted to follow up on my previous message about {{topic}}. 

I understand you''re busy, but I''d hate for you to miss out on this opportunity. Many of our most successful partners initially had reservations but are now grateful they took the first step.

When would be a good time for a quick 15-minute call?

Best,
{{agent_name}}', 'follow_up');
