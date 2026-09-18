export interface RawReadingToken {
  token: string;
  normalized: string;
  start: number;
  end: number;
  sentenceIndex: number;
  isSentenceStart: boolean;
  isNumber: boolean;
}

const TOKEN_PATTERN = /(?:[A-Za-z]+(?:[’'][A-Za-z]+)*(?:-[A-Za-z]+)*)|(?:\d+(?:[.,]\d+)*)/g;

export function normalizeToken(token: string): string {
  return token.toLowerCase().replace(/’/g, "'");
}

export function splitSentences(text: string): string[] {
  return (text.match(/[^.!?]+(?:[.!?]+["']?|$)/g) ?? [text]).map((sentence) => sentence.trim()).filter(Boolean);
}

export function tokenize(text: string): RawReadingToken[] {
  const tokens: RawReadingToken[] = [];
  let sentenceIndex = 0;
  let sentenceStart = true;
  for (const match of text.matchAll(TOKEN_PATTERN)) {
    const start = match.index ?? 0;
    const between = tokens.length ? text.slice(tokens[tokens.length - 1].end, start) : text.slice(0, start);
    if (/[.!?]/.test(between)) {
      sentenceIndex += (between.match(/[.!?]+/g) ?? []).length;
      sentenceStart = true;
    }
    const token = match[0];
    tokens.push({
      token,
      normalized: normalizeToken(token),
      start,
      end: start + token.length,
      sentenceIndex,
      isSentenceStart: sentenceStart,
      isNumber: /^\d/.test(token)
    });
    sentenceStart = false;
  }
  return tokens;
}
