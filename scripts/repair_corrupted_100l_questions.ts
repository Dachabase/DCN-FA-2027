import { prisma } from '../src/database/prisma';

export function unquoteCorrupted(str: string | null | undefined): string {
  if (!str || typeof str !== 'string') return '';
  str = str.trim();
  if (!str.includes("' '") && !/'[a-zA-Z0-9]'/.test(str)) {
    return str;
  }

  // Handle prefix like "A. " or "(A) "
  const optMatch = str.match(/^(\(?[A-Ea-e][\.\)]\s*)(.*)$/);
  if (optMatch) {
    const prefix = optMatch[1];
    const rest = optMatch[2].trim();
    return prefix + unquoteCorrupted(rest);
  }

  // Check if every even char is a quote (formed by python replace("", "'"))
  if (str.length >= 3 && str.startsWith("'") && str.endsWith("'") && str.length % 2 === 1) {
    let allEven = true;
    for (let i = 0; i < str.length; i += 2) {
      if (str[i] !== "'") {
        allEven = false;
        break;
      }
    }
    if (allEven) {
      const chars: string[] = [];
      for (let i = 1; i < str.length; i += 2) {
        chars.push(str[i]);
      }
      return chars.join('').trim();
    }
  }

  // Fallback for partial/irregular patterns
  let cleaned = str.replace(/'([^'])'/g, '$1');
  cleaned = cleaned.replace(/^'|'$/g, '').replace(/''/g, "'").replace(/\s+/g, ' ').trim();
  return cleaned;
}

async function repairAll() {
  console.log('Fetching questions with single-quote corruption...');
  const allCorrupted = await prisma.question.findMany({
    where: {
      OR: [
        { questionText: { contains: "' '" } },
        { questionText: { startsWith: "'A'" } },
        { questionText: { startsWith: "'W'" } },
        { questionText: { startsWith: "'T'" } },
        { questionText: { startsWith: "'I'" } },
        { questionText: { startsWith: "'1'" } },
      ]
    },
    select: {
      id: true,
      questionText: true,
      options: true,
      explanation: true,
      passage: true,
    }
  });

  console.log(`Found ${allCorrupted.length} candidates for repair.`);

  const BATCH_SIZE = 50;
  let updatedCount = 0;

  for (let i = 0; i < allCorrupted.length; i += BATCH_SIZE) {
    const batch = allCorrupted.slice(i, i + BATCH_SIZE);
    
    await Promise.all(
      batch.map(async (q) => {
        const newText = unquoteCorrupted(q.questionText);
        const newOptions = Array.isArray(q.options)
          ? q.options.map((opt) => unquoteCorrupted(String(opt)))
          : q.options;
        const newExplanation = q.explanation ? unquoteCorrupted(q.explanation) : q.explanation;
        const newPassage = q.passage ? unquoteCorrupted(q.passage) : q.passage;

        // Only update if changed
        const textChanged = newText !== q.questionText;
        const optionsChanged = JSON.stringify(newOptions) !== JSON.stringify(q.options);

        if (textChanged || optionsChanged) {
          await prisma.question.update({
            where: { id: q.id },
            data: {
              questionText: newText,
              options: newOptions,
              explanation: newExplanation,
              passage: newPassage,
            }
          });
          updatedCount++;
        }
      })
    );

    console.log(`Progress: ${Math.min(i + BATCH_SIZE, allCorrupted.length)} / ${allCorrupted.length} (updated ${updatedCount})`);
  }

  console.log(`\nRepair completed! Total questions updated: ${updatedCount}`);
}

repairAll().catch(console.error).finally(() => prisma.$disconnect());
