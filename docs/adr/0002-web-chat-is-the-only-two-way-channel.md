# Web Chat is the only two-way conversation channel

The Assistant qualifies Leads only in Web Chat. Email and SMS are outbound only. Every email carries a signed link back into the Lead's Web Chat, and a form submission opens the chat already linked to the new Lead. We rejected inbound email (a Resend inbound webhook) because it adds DNS setup and reply parsing for little demo value, and we rejected an email-only path for form Leads because it would skip the AI conversation that the demo is about. SMS stays a simulator, with a dev panel for inbound messages such as "STOP".

## Consequences

- A `ChannelAdapter` for email or SMS only sends messages. A real inbound email or Twilio adapter would be a new capability, not a config change.
- Anyone reading `Message.channel = EMAIL` should expect only outbound messages there.
