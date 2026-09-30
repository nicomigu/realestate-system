# realestate-system

A single realtor's lead-handling system. It captures Leads from a website and lead sources, lets an AI Assistant run the first conversation to qualify them and book an Appointment, and then tracks them through a pipeline.

## People

**Agent**:
The human realtor who owns the calendar and works the pipeline. The MVP has exactly one bookable Agent, and every Lead is assigned to them.
_Avoid_: Realtor, user (when meaning the realtor), AI agent

**Assistant**:
The AI that runs a Lead's conversation for the Agent. It acts only through whitelisted tools.
_Avoid_: AI agent, bot, chatbot

**Admin**:
A non-bookable operator who runs demo tooling and sees everything. Not an Agent.

**Visitor**:
An anonymous person on the demo site or in the chat widget who hasn't sent a message yet. A Visitor is not a Lead.

## Leads

**Lead**:
A person who has made contact by sending a chat message, submitting the form, or arriving via a Lead Source. One person has at most one open (not closed) Lead. A returning match is attached to that Lead instead of creating a new one.
_Avoid_: Contact, prospect, customer

**Lead Source**:
Where a Lead first came from (Website, Facebook, Zillow, Google Ads, Manual). It is fixed at creation and never overwritten by a later duplicate.

**Intent**:
What the Lead wants to do: Buyer, Seller or Investor (Unknown until learned).

**Stage**:
The Lead's position in the pipeline: New → Contacted → Qualified → Appointment → Closed Won / Closed Lost. Automation moves a Lead only forward and only one Stage at a time. An Agent can move a Lead to any Stage.
_Avoid_: Status (reserved for Appointments and Enrollments), column

**Contacted**:
The Stage meaning a First Response has happened. Sequence messages alone never make a Lead Contacted.

**Closed**:
A Lead in Closed Won or Closed Lost. Only an Agent closes or reopens a Lead. The Assistant never replies to a Closed Lead, and the Agent is notified instead.

**Stale**:
A Contacted or Qualified Lead with no inbound message for 3 days, no Booked Appointment, no active Enrollment and no Opt-out. A Lead is re-engaged at most once.

**Opted Out**:
A Lead who unsubscribed by email link or SMS "STOP". They get no sequence messages and no outbound email or SMS from the Assistant, but Web Chat they start still works and Appointment confirmations and reminders still go out. It doesn't change the Stage.
_Avoid_: Unsubscribed, do-not-contact

**Qualified**:
The Stage meaning "we know enough to book". A Buyer or Investor needs budget, area and timeline known. A Seller needs area and timeline known. Being Qualified is independent of Temperature.

**Price Range**:
The money figure for a Lead: a Buyer's or Investor's budget, or a Seller's estimated price.
_Avoid_: Budget (when the Lead might be a Seller)

**Score**:
A 0–100 number computed by fixed rules from the Lead's known facts, using a separate weight table per Intent. It is never computed by the Assistant.

**Temperature**:
Hot, Warm or Cold, derived from the Score by thresholds.
_Avoid_: Rating, priority

**Tag**:
A free-form label that only an Agent sets on a Lead. Automation never writes Tags.

**Funnel**:
How many Leads reached each Stage in a period. Moving a Lead backward doesn't undo a Stage it already reached.

**First Response**:
The first outbound message to a Lead authored by the Assistant or an Agent, on any channel. First-response time is measured from Lead creation. System and sequence messages don't count.

## Conversation

**Web Chat**:
The only true two-way conversation channel. Email and SMS are outbound, and email carries a signed link back into the Lead's Web Chat.

**Handoff**:
The Assistant stops replying to a Lead and the Agent owns the conversation. It is triggered by the Agent ("Take over"), by the Assistant asking for a human, or by reaching the Turn Cap.
_Avoid_: Takeover (that's only the button label), escalation

**Resume**:
Handing a Lead's conversation back to the Assistant after a Handoff. The Assistant continues with the full history.

**Turn Cap**:
The maximum number of Assistant replies to one Lead. Reaching it forces a Handoff.

A Handoff is also forced when the Assistant can't answer (the model fails or the daily cap is hit), so a Lead is never left in silence.

## Follow-up

**Sequence**:
A named, ordered list of timed outbound message templates. The MVP has two: "New lead" (on Lead creation) and "Re-engage" (when a Lead goes Stale).
_Avoid_: Drip, campaign, nurture flow

**Enrollment**:
One Lead's run through one Sequence. It is Active, Stopped (the Lead replied, booked, was handed off, closed or opted out) or Done (all steps sent).

## Appointments

**Appointment**:
A fixed-length consultation call between a Lead and the Agent, with no property or location attached. A Lead holds at most one Booked Appointment at a time.
_Avoid_: Showing, meeting, booking (as a noun)

**Slot**:
A bookable 30-minute start time inside the Agent's working hours, at least 2 hours ahead and within 14 days. Slots are shown in the Agent's time zone.

**Reschedule**:
Cancelling a Lead's Booked Appointment and booking a new one as a single act.

**No-show**:
An Appointment the Lead missed. It doesn't change the Stage. The Assistant offers to rebook once, unless the Lead has been handed off or has opted out.
