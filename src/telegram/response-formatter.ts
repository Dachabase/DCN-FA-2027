/**
 * Converts the Markdown produced by Gemini into safe
 * Telegram HTML.
 *
 * Supported:
 * - headings
 * - bold
 * - italic
 * - inline code
 * - fenced code blocks
 * - unordered lists
 * - ordered lists
 * - links
 *
 * Also provides Telegram-safe response splitting so
 * responses longer than Telegram's message limit can
 * be sent as multiple messages without breaking HTML.
 */

// ---------------------------------------------------------
// TELEGRAM LIMIT
// ---------------------------------------------------------

/**
 * Telegram allows messages of up to 4096 characters.
 *
 * We intentionally stay below that limit to provide a
 * safety margin.
 */
const TELEGRAM_MESSAGE_LIMIT = 4000;

// ---------------------------------------------------------
// HTML ESCAPING
// ---------------------------------------------------------

function escapeHtml(
  value: string
): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeAttribute(
  value: string
): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// ---------------------------------------------------------
// PROTECTED BLOCKS
// ---------------------------------------------------------

interface ProtectedBlock {
  placeholder: string;
  content: string;
}

function protectCodeBlocks(
  input: string
): {
  text: string;
  blocks: ProtectedBlock[];
} {
  const blocks: ProtectedBlock[] = [];

  let index = 0;

  const text =
    input.replace(
      /```(?:[a-zA-Z0-9_+#.-]+)?\s*\n?([\s\S]*?)```/g,
      (_match, code: string) => {
        const placeholder =
          `@@CODE_BLOCK_${index}@@`;

        blocks.push({
          placeholder,
          content: code.trimEnd(),
        });

        index += 1;

        return placeholder;
      }
    );

  return {
    text,
    blocks,
  };
}

function restoreCodeBlocks(
  input: string,
  blocks: ProtectedBlock[]
): string {
  let output = input;

  for (const block of blocks) {
    const code =
      escapeHtml(block.content);

    const formatted =
      `<pre><code>${code}</code></pre>`;

    output =
      output.replace(
        block.placeholder,
        formatted
      );
  }

  return output;
}

// ---------------------------------------------------------
// INLINE CODE
// ---------------------------------------------------------

function protectInlineCode(
  input: string
): {
  text: string;
  blocks: ProtectedBlock[];
} {
  const blocks: ProtectedBlock[] = [];

  let index = 0;

  const text =
    input.replace(
      /`([^`\n]+)`/g,
      (_match, code: string) => {
        const placeholder =
          `@@INLINE_CODE_${index}@@`;

        blocks.push({
          placeholder,
          content: code,
        });

        index += 1;

        return placeholder;
      }
    );

  return {
    text,
    blocks,
  };
}

function restoreInlineCode(
  input: string,
  blocks: ProtectedBlock[]
): string {
  let output = input;

  for (const block of blocks) {
    const code =
      escapeHtml(block.content);

    output =
      output.replace(
        block.placeholder,
        `<code>${code}</code>`
      );
  }

  return output;
}

// ---------------------------------------------------------
// MARKDOWN CONVERSION
// ---------------------------------------------------------

function convertHeadings(
  input: string
): string {
  return input.replace(
    /^#{1,6}\s+(.+)$/gm,
    "<b>$1</b>"
  );
}

function convertBold(
  input: string
): string {
  return input.replace(
    /\*\*(.+?)\*\*/g,
    "<b>$1</b>"
  );
}

function convertItalic(
  input: string
): string {
  return input.replace(
    /(?<!\*)\*([^*\n]+)\*(?!\*)/g,
    "<i>$1</i>"
  );
}

function convertStrikethrough(
  input: string
): string {
  return input.replace(
    /~~(.+?)~~/g,
    "<s>$1</s>"
  );
}

function convertLinks(
  input: string
): string {
  return input.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
    (_match, label: string, url: string) => {
      return `<a href="${escapeAttribute(url)}">${label}</a>`;
    }
  );
}

function convertUnorderedLists(
  input: string
): string {
  return input.replace(
    /^\s*[-*+]\s+(.+)$/gm,
    "• $1"
  );
}

function convertOrderedLists(
  input: string
): string {
  return input.replace(
    /^\s*(\d+)\.\s+(.+)$/gm,
    "$1. $2"
  );
}

function removeDecorativeSeparators(
  input: string
): string {
  return input.replace(
    /^\s*([-*_]){3,}\s*$/gm,
    ""
  );
}

function cleanWhitespace(
  input: string
): string {
  return input
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// ---------------------------------------------------------
// FORMAT MARKDOWN → TELEGRAM HTML
// ---------------------------------------------------------

export function formatTelegramResponse(
  markdown: string
): string {
  if (!markdown.trim()) {
    return "";
  }

  /**
   * First protect fenced code blocks.
   */
  const protectedCode =
    protectCodeBlocks(markdown);

  let output =
    protectedCode.text;

  /**
   * Protect inline code before applying
   * Markdown formatting.
   */
  const protectedInline =
    protectInlineCode(output);

  output =
    protectedInline.text;

  /**
   * Escape raw HTML characters before generating
   * our own Telegram HTML.
   */
  output =
    escapeHtml(output);

  /**
   * Markdown conversions.
   */
  output =
    convertLinks(output);

  output =
    convertHeadings(output);

  output =
    convertBold(output);

  output =
    convertItalic(output);

  output =
    convertStrikethrough(output);

  output =
    convertUnorderedLists(output);

  output =
    convertOrderedLists(output);

  output =
    removeDecorativeSeparators(output);

  /**
   * Restore inline code.
   */
  output =
    restoreInlineCode(
      output,
      protectedInline.blocks
    );

  /**
   * Restore fenced code blocks.
   */
  output =
    restoreCodeBlocks(
      output,
      protectedCode.blocks
    );

  return cleanWhitespace(
    output
  );
}

// ---------------------------------------------------------
// TELEGRAM HTML SPLITTER
// ---------------------------------------------------------

interface HtmlTag {
  raw: string;
  name: string;
  closing: boolean;
  selfClosing: boolean;
}

/**
 * Telegram supports a limited subset of HTML.
 *
 * These are the tags our formatter generates and which
 * may need to remain open when a long response is split.
 */
const SPLITTABLE_TAGS = new Set([
  "b",
  "i",
  "s",
  "code",
  "pre",
  "a",
]);

function parseHtmlTag(
  value: string
): HtmlTag | null {
  const match =
    value.match(
      /^<\s*(\/)?\s*([a-zA-Z0-9]+)(?:\s[^>]*)?\/?\s*>$/
    );

  if (!match) {
    return null;
  }

  const closing =
    Boolean(match[1]);

  const name =
    match[2].toLowerCase();

  const selfClosing =
    /\/\s*>$/.test(value);

  return {
    raw: value,
    name,
    closing,
    selfClosing,
  };
}

/**
 * Extracts HTML tags and text portions.
 *
 * We keep tags intact so that we never split inside
 * something such as:
 *
 * <a href="...">
 *
 * or:
 *
 * <strong>
 */
function tokenizeHtml(
  html: string
): string[] {
  const tokens: string[] = [];

  const matches =
    html.match(
      /<[^>]+>|[^<]+/g
    );

  if (!matches) {
    return [];
  }

  for (const token of matches) {
    tokens.push(token);
  }

  return tokens;
}

/**
 * Returns the HTML needed to close currently open tags.
 */
function buildClosingTags(
  stack: string[]
): string {
  return [...stack]
    .reverse()
    .map(
      (tag) =>
        `</${tag}>`
    )
    .join("");
}

/**
 * Returns the HTML needed to reopen currently open tags.
 *
 * For links, we cannot safely reconstruct the original
 * opening tag from only the tag name, so the original
 * opening tag is stored separately.
 */
interface OpenTag {
  name: string;
  openingTag: string;
}

function buildOpeningTags(
  stack: OpenTag[]
): string {
  return stack
    .map(
      (tag) =>
        tag.openingTag
    )
    .join("");
}

/**
 * Finds a safe position in a text segment.
 *
 * Priority:
 *
 * 1. paragraph/newline
 * 2. whitespace
 * 3. hard split
 */
function findSafeTextBreak(
  text: string,
  maxLength: number
): number {
  if (text.length <= maxLength) {
    return text.length;
  }

  if (maxLength <= 0) {
    return 0;
  }

  const candidate =
    text.slice(
      0,
      maxLength
    );

  const paragraphBreak =
    candidate.lastIndexOf(
      "\n\n"
    );

  if (
    paragraphBreak > 0
  ) {
    return paragraphBreak + 2;
  }

  const lineBreak =
    candidate.lastIndexOf(
      "\n"
    );

  if (
    lineBreak > 0
  ) {
    return lineBreak + 1;
  }

  const spaceBreak =
    candidate.lastIndexOf(
      " "
    );

  if (
    spaceBreak > 0
  ) {
    return spaceBreak + 1;
  }

  return maxLength;
}

/**
 * Splits formatted Telegram HTML into multiple messages.
 *
 * Important:
 *
 * We close and reopen formatting tags between chunks.
 * This prevents malformed HTML such as:
 *
 * <b>This is a very long...
 *
 * being split into two messages without closing <b>.
 */
export function splitTelegramResponse(
  html: string,
  limit: number = TELEGRAM_MESSAGE_LIMIT
): string[] {
  const cleaned =
    html.trim();

  if (!cleaned) {
    return [];
  }

  if (
    cleaned.length <= limit
  ) {
    return [cleaned];
  }

  const tokens =
    tokenizeHtml(cleaned);

  const chunks: string[] = [];

  let current = "";

  const openTags: OpenTag[] = [];

  const flushCurrent = (): void => {
    const content =
      current.trim();

    if (!content) {
      current = "";
      return;
    }

    const closingTags =
      buildClosingTags(
        openTags.map(
          (tag) =>
            tag.name
        )
      );

    const chunk =
      `${content}${closingTags}`.trim();

    if (chunk) {
      chunks.push(chunk);
    }

    current =
      buildOpeningTags(
        openTags
      );
  };

  for (
    const token of tokens
  ) {
    const parsedTag =
      token.startsWith("<")
        ? parseHtmlTag(token)
        : null;

    // -------------------------------------------------------
    // HTML TAG
    // -------------------------------------------------------

    if (parsedTag) {
      /**
       * If the tag itself would exceed the limit,
       * flush first.
       */
      if (
        current.length +
          token.length >
        limit
      ) {
        flushCurrent();
      }

      /**
       * Extremely unusual case where an individual HTML
       * tag itself is larger than the limit.
       *
       * Do not split inside the tag.
       */
      if (
        token.length >
        limit
      ) {
        if (current.trim()) {
          flushCurrent();
        }

        chunks.push(token);

        continue;
      }

      current += token;

      if (
        SPLITTABLE_TAGS.has(
          parsedTag.name
        )
      ) {
        if (
          parsedTag.closing
        ) {
          /**
           * Remove the most recent matching open tag.
           */
          for (
            let index =
              openTags.length - 1;
            index >= 0;
            index -= 1
          ) {
            if (
              openTags[index]
                .name ===
              parsedTag.name
            ) {
              openTags.splice(
                index,
                1
              );

              break;
            }
          }
        } else if (
          !parsedTag.selfClosing
        ) {
          openTags.push({
            name:
              parsedTag.name,

            openingTag:
              parsedTag.raw,
          });
        }
      }

      continue;
    }

    // -------------------------------------------------------
    // TEXT
    // -------------------------------------------------------

    let remaining =
      token;

    while (
      remaining.length > 0
    ) {
      const available =
        limit -
        current.length;

      if (
        remaining.length <=
        available
      ) {
        current += remaining;
        remaining = "";
        continue;
      }

      /**
       * There is not enough room for the entire text token.
       *
       * Find a natural breaking point.
       */
      const breakLength =
        findSafeTextBreak(
          remaining,
          Math.max(
            1,
            available
          )
        );

      const piece =
        remaining.slice(
          0,
          breakLength
        );

      if (piece) {
        current += piece;
      }

      remaining =
        remaining.slice(
          breakLength
        );

      /**
       * If we couldn't consume anything, force one
       * character so the loop can never become infinite.
       */
      if (
        breakLength <= 0
      ) {
        current +=
          remaining.charAt(0);

        remaining =
          remaining.slice(1);
      }

      /**
       * If there is still content remaining, finish
       * this message and continue with the next one.
       */
      if (
        remaining.length > 0
      ) {
        flushCurrent();
      }
    }
  }

  /**
   * Flush the final chunk.
   */
  if (
    current.trim()
  ) {
    const closingTags =
      buildClosingTags(
        openTags.map(
          (tag) =>
            tag.name
        )
      );

    const finalChunk =
      `${current.trim()}${closingTags}`.trim();

    if (finalChunk) {
      chunks.push(
        finalChunk
      );
    }
  }

  /**
   * Safety pass.
   *
   * In the extremely unlikely event that something still
   * exceeds the configured limit, hard-split it rather than
   * allowing Telegram to reject the response.
   */
  const finalChunks: string[] = [];

  for (
    const chunk of chunks
  ) {
    if (
      chunk.length <= limit
    ) {
      finalChunks.push(
        chunk
      );

      continue;
    }

    /**
     * This fallback should almost never be needed because
     * the main splitter already observes the limit.
     */
    let remaining =
      chunk;

    while (
      remaining.length > limit
    ) {
      finalChunks.push(
        remaining.slice(
          0,
          limit
        )
      );

      remaining =
        remaining.slice(
          limit
        );
    }

    if (
      remaining
    ) {
      finalChunks.push(
        remaining
      );
    }
  }

  return finalChunks.filter(
    (chunk) =>
      chunk.trim().length > 0
  );
}