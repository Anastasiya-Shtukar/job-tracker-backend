const OpenAI = require("openai");

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const generateDetailsSuggestion = async (details) => {
  const response = await client.responses.create({
    model: "gpt-4.1-mini",
    input: `Rewrite and shorten these job details.
Do not add new facts.
Return 1-2 sentences.

Text:
${details}`,
  });

  const suggestion = response.output_text?.trim();

  if (!suggestion) {
    throw new Error("AI returned an empty suggestion");
  }

  return suggestion;
};

const extractStructuredJobData = async (sourceText) => {
  const prompt = `
You are extracting job posting data for a job tracking app.

Analyze the text and return structured data.

Important rules:
- Detect the language of the input text.
- Return all values in the same language as the input text.
- Do not translate the content to English unless the input is in English.
- Do not invent missing information.
- If a field is missing or unclear, use an empty string.
- Keep "details" concise and useful for a user tracking job applications.
- "details" should include key requirements, work mode, location, seniority, or technologies only if they appear in the text.
- Return only valid JSON.
- No markdown.
- No comments.
- No extra text.

JSON shape:
{
  "title": "",
  "company": "",
  "details": ""
}

Input text:
${sourceText.slice(0, 12000)}
`;

  const response = await client.responses.create({
    model: "gpt-4.1-mini",
    input: prompt,
  });

  const answer = response.output_text?.trim();

  if (!answer) {
    throw new Error("AI returned an empty response");
  }

  let extractedJob;

  try {
    extractedJob = JSON.parse(answer);
  } catch (error) {
    const parsingError = new Error("AI returned invalid JSON");
    parsingError.code = "INVALID_AI_JSON";

    throw parsingError;
  }

  return {
    title:
      typeof extractedJob.title === "string" ? extractedJob.title.trim() : "",
    company:
      typeof extractedJob.company === "string"
        ? extractedJob.company.trim()
        : "",
    details:
      typeof extractedJob.details === "string"
        ? extractedJob.details.trim()
        : "",
  };
};

module.exports = {
  generateDetailsSuggestion,
  extractStructuredJobData,
};
