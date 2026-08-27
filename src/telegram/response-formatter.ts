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
 * Unsupported/unsafe HTML is escaped.
 */

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
   * Escape all raw HTML characters before
   * generating our own Telegram HTML.
   */
  output =
    escapeHtml(output);

  /**
   * Formatting conversions.
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