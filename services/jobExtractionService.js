const { extractStructuredJobData } = require("./aiService");

const MINIMUM_SOURCE_LENGTH = 300;

const FETCH_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
    "AppleWebKit/537.36 (KHTML, like Gecko) " +
    "Chrome/124.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "pl-PL,pl;q=0.9,en;q=0.8",
};

const createExtractionError = (message, code) => {
  const error = new Error(message);
  error.code = code;

  return error;
};

const cleanHtml = (html) =>
  html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const fetchJobPageText = async (url) => {
  let response;

  try {
    response = await fetch(url, {
      headers: FETCH_HEADERS,
    });
  } catch (error) {
    throw createExtractionError(
      "Couldn’t read this URL. Paste the job posting text manually.",
      "JOB_PAGE_UNAVAILABLE",
    );
  }

  if (!response.ok) {
    throw createExtractionError(
      "Couldn’t read this URL. Paste the job posting text manually.",
      "JOB_PAGE_UNAVAILABLE",
    );
  }

  const html = await response.text();
  const sourceText = cleanHtml(html);

  if (sourceText.length < MINIMUM_SOURCE_LENGTH) {
    throw createExtractionError(
      "Couldn’t read this URL. Paste the job posting text manually.",
      "JOB_PAGE_CONTENT_TOO_SHORT",
    );
  }

  return sourceText;
};

const getSourceText = async ({ text, url }) => {
  if (text) {
    return text;
  }

  if (url) {
    return fetchJobPageText(url);
  }

  throw createExtractionError(
    "Job URL or job posting text is required",
    "MISSING_JOB_SOURCE",
  );
};

const extractJobData = async ({ text, url }) => {
  const sourceText = await getSourceText({
    text,
    url,
  });

  return extractStructuredJobData(sourceText);
};

module.exports = {
  extractJobData,
};
