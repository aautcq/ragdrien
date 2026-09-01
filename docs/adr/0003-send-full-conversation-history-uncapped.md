# Send full conversation history to the model, uncapped

Chat turns previously ran stateless: the server discarded every message but the visitor's latest before calling the model, even though the client already held the full transcript. We now forward the entire visitor-visible transcript (mapped to alternating Human/AI messages, with any client-supplied `system` role stripped) on every request, so replies can refer to earlier turns.

We send the transcript uncapped rather than truncating by turn count or token budget: this is a low-traffic personal chatbot, and a cap would be premature optimization for a problem (context-window overflow, latency, cost) we haven't observed yet. The trade-off is that a long enough conversation could eventually exceed the model's context window or slow down; we accept that for now and can add truncation later if it becomes a real issue.
