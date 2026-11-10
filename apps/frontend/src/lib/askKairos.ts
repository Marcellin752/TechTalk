/** A link that opens Kairos with a question already written, ready to send. */
export const askKairos = (question: string) => `/kairos?ask=${encodeURIComponent(question.slice(0, 1500))}`;

/** The slug of a concept for a free-text topic: the same rule the server uses, so a topic links to its concept. */
export const topicSlug = (topic: string) =>
  topic.toLowerCase().trim().replace(/\+/g, "p").replace(/#/g, "sharp").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
