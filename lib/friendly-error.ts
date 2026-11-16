// Turns technical errors (database, network, storage) into plain language people can act on.
// The technical detail is logged to the browser console for developers and never shown on screen.

const GENERIC = 'Something went wrong. Please try again.';

// Words found in database rule names (for example messages_body_length_check) -> what went wrong.
const FIELD_HINTS: Array<[RegExp, string]> = [
  [/body|message/, 'Messages cannot be empty or longer than 2,000 characters.'],
  [/title|headline/, 'The title is too short or too long.'],
  [/description/, 'The description is too short or too long.'],
  [/campus|institution|school/, 'The campus name is too short or too long.'],
  [/price|amount|fee|kobo/, 'Enter a valid price.'],
  [/full_name|name/, 'The name is too short or too long.'],
  [/phone|whatsapp|contact/, 'Enter a valid phone number.'],
  [/email/, 'Enter a valid email address.'],
  [/link|url/, 'Enter a valid link.'],
  [/reason|note|comment|feedback/, 'The text is too short or too long.'],
  [/category/, 'Choose a valid category.'],
  [/status/, 'That action is not allowed in the current state.'],
  [/days|percent|capacity|level/, 'Enter a valid number.'],
];

/** True when a message looks like it came from the database or network layer rather than a person. */
export function looksTechnical(message: string) {
  return /violates|constraint|row-level security|permission denied|duplicate key|null value in column|invalid input|syntax error|sqlstate|postgres|pgrst|schema cache|does not exist|relation "|column "|function public\.|could not find the (table|function|column)|jwt|failed to fetch|networkerror|network request failed|load failed|fetch failed|typeerror|unexpected token|undefined is not|cannot read prop|aborterror|econn|timed out|timeout/i.test(message);
}

function constraintMessage(raw: string) {
  const name = raw.match(/constraint "?([a-z0-9_]+)"?/i)?.[1] || '';
  const key = name.replace(/_(check|key|fkey|pkey)$/i, '');
  for (const [pattern, text] of FIELD_HINTS) if (pattern.test(key)) return text;
  return 'Some of what you entered is not allowed. Please check it and try again.';
}

/** Plain-language version of a message. Messages that are already human are returned unchanged. */
export function friendlyMessage(raw: unknown, fallback = GENERIC): string {
  const message = typeof raw === 'string' ? raw.trim() : '';
  if (!message) return fallback;
  if (!looksTechnical(message)) return message;
  if (typeof console !== 'undefined') console.warn('CARTOMUX technical error (hidden from the user):', message);
  const lower = message.toLowerCase();

  if (/row-level security|permission denied|not authorized|insufficient_privilege/.test(lower)) return 'You do not have permission to do that.';
  if (/jwt|auth session missing|session.*expired|refresh token/.test(lower)) return 'Your session has expired. Please sign in again.';
  if (/failed to fetch|networkerror|network request failed|load failed|fetch failed|econn|aborterror|timed out|timeout/.test(lower)) return 'Network problem. Check your connection and try again.';
  if (/violates check constraint/.test(lower)) return constraintMessage(message);
  if (/duplicate key|already exists|unique constraint/.test(lower)) return 'That already exists.';
  if (/violates foreign key/.test(lower)) return 'That item is no longer available. Please refresh the page and try again.';
  if (/null value in column/.test(lower)) return 'Please fill in all the required fields.';
  if (/invalid input|syntax error|unexpected token/.test(lower)) return 'Some of the information is not valid. Please check it and try again.';
  if (/does not exist|schema cache|could not find the (table|function|column)/.test(lower)) return 'This feature is not available right now. Please try again later.';
  if (/json object requested|no rows|multiple \(or no\) rows/.test(lower)) return 'We could not find that. It may have been removed.';
  return fallback;
}

/** For Error objects, Supabase errors ({ message, code, details }) or plain strings. */
export function friendlyError(error: unknown, fallback = GENERIC, options: { ignoreConstraints?: boolean } = {}): string {
  if (!error) return fallback;
  if (typeof error === 'string') return friendlyMessage(error, fallback);
  const e = error as { message?: unknown; code?: unknown; details?: unknown };
  const code = typeof e.code === 'string' ? e.code : '';
  const message = typeof e.message === 'string' ? e.message : '';
  // For actions like "delete", a rule about the text length would be confusing: use the action's own message.
  if (options.ignoreConstraints && (code === '23514' || /violates check constraint/i.test(message))) {
    if (typeof console !== 'undefined') console.warn('CARTOMUX technical error (hidden from the user):', message);
    return fallback;
  }
  // Postgres error classes first: they are the most reliable signal.
  if (code === '23514') return friendlyMessage(message.includes('constraint') ? message : `violates check constraint "${code}"`, fallback);
  if (code === '23505') return 'That already exists.';
  if (code === '23503') return 'That item is no longer available. Please refresh the page and try again.';
  if (code === '23502') return 'Please fill in all the required fields.';
  if (code === '42501') return 'You do not have permission to do that.';
  if (code === '42P01' || code === '42883' || code === 'PGRST202' || code === 'PGRST205') return 'This feature is not available right now. Please try again later.';
  if (code === 'PGRST116') return 'We could not find that. It may have been removed.';
  if (code === '22P02') return 'Some of the information is not valid. Please check it and try again.';
  if (code === 'PGRST301' || code === 'PGRST303') return 'Your session has expired. Please sign in again.';
  return friendlyMessage(message, fallback);
}
