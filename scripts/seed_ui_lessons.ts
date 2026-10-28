import { prisma } from "../src/database/prisma";
import { upsertLesson } from "../src/modules/lessons/lessons.service";

async function main() {
  console.log("🌱 Seeding UI Sample Lessons...");

  // Find sample question IDs for GES 107 check questions
  const gesQuestions = await prisma.question.findMany({
    where: { courseCode: "GES 107" },
    take: 2,
  });
  const gesQIds = gesQuestions.map((q) => q.id);

  // Lesson 1: GES 107
  await upsertLesson({
    courseCode: "GES 107",
    topicName: "Reproductive Anatomy & Physiology",
    title: "Female & Male Reproductive Physiology: From Gametogenesis to Fertilization",
    summary: "Comprehensive guide to the ovarian cycle, uterine phases, site of fertilization (ampulla), and hormonal regulation.",
    orderIndex: 1,
    checkQIds: gesQIds,
    content: `
# Reproductive Anatomy & Physiology

## 1. The Female Reproductive Cycle
The menstrual cycle comprises two coordinated cycles:
1. **The Ovarian Cycle**: Follicular phase, Ovulation, and Luteal phase.
2. **The Uterine (Endometrial) Cycle**: Menstrual phase, Proliferative phase, and Secretory phase.

### Key Hormonal Triggers
- **Follicle-Stimulating Hormone (FSH)**: Initiates follicular development.
- **Luteinizing Hormone (LH) Surge**: Triggers rupture of the mature Graafian follicle and ovulation within 24–36 hours.
- **Progesterone**: Secreted by the *corpus luteum* to maintain the secretory endometrium for blastocyst implantation.

## 2. Fertilization Dynamics
- **Primary Site**: The **ampulla** of the fallopian tube (uterine tube).
- **Viability**: Spermatozoa typically retain fertilizing capability for 48–72 hours in the female tract; the unfertilized ovum remains viable for approximately 12–24 hours post-ovulation.
- **Implantation**: Occurs in the posterior or anterior wall of the endometrial cavity 6–8 days post-fertilization.

## 3. High-Yield UI CBT Exam Notes
> **CBT Focus Tip:** UI GES 107 past questions consistently test the exact anatomical site of fertilization (ampulla, NOT the isthmus or uterine cavity).
    `.trim(),
  });

  // Lesson 2: CSC 101
  const cscQuestions = await prisma.question.findMany({
    where: { courseCode: "CSC 101" },
    take: 2,
  });
  const cscQIds = cscQuestions.map((q) => q.id);

  await upsertLesson({
    courseCode: "CSC 101",
    topicName: "Number Systems & Binary Arithmetic",
    title: "Binary, Octal, Hexadecimal & Two's Complement Arithmetic",
    summary: "Foundational digital data representation, positional base conversions, and signed negative integer handling in digital ALUs.",
    orderIndex: 1,
    checkQIds: cscQIds,
    content: `
# Number Systems & Binary Arithmetic

## 1. Positional Number Systems
In any positional number system with radix (base) $R$, a number $N$ is represented as:
$$N = \\sum_{i} d_i \\cdot R^i$$

- **Binary ($R = 2$)**: Digits $\\{0, 1\\}$.
- **Octal ($R = 8$)**: Digits $\\{0, 1, \\dots, 7\\}$. Each octal digit maps to 3 binary bits.
- **Hexadecimal ($R = 16$)**: Digits $\\{0..9, A..F\\}$. Each hex digit maps to 4 binary bits (nibble).

## 2. Two's Complement Signed Integer Representation
Modern computers utilize Two's Complement for signed integers because addition and subtraction use identical digital adder hardware with no negative zero ambiguity.

### How to calculate Two's Complement of an $n$-bit number:
1. Invert all bits (One's Complement).
2. Add $1$ to the least significant bit (LSB).

Example with 8-bit $+5$ ($00000101_2$):
1. Invert: $11111010_2$
2. Add 1: $11111011_2 = -5_{10}$

## 3. CBT Exam Rule of Thumb
> Always check the sign bit (MSB). In Two's Complement, MSB $1$ indicates a negative integer.
    `.trim(),
  });

  // Lesson 3: MAT 111
  const matQuestions = await prisma.question.findMany({
    where: { courseCode: "MAT 111" },
    take: 2,
  });
  const matQIds = matQuestions.map((q) => q.id);

  await upsertLesson({
    courseCode: "MAT 111",
    topicName: "Quadratic Equations and Inequalities",
    title: "Quadratic Equations, Nature of Roots & The Discriminant Criterion",
    summary: "Algebraic solutions for general quadratics, discriminant properties, relation between coefficients and symmetric functions of roots.",
    orderIndex: 1,
    checkQIds: matQIds,
    content: `
# Quadratic Equations & Discriminant Analysis

## 1. General Quadratic Form
For real coefficients $a \\neq 0$:
$$a x^2 + b x + c = 0$$

Roots $\\alpha, \\beta$ given by:
$$x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$$

## 2. The Discriminant Criterion $\\Delta = b^2 - 4ac$
- If $\\Delta > 0$: Two distinct real roots. (If $\\Delta$ is a perfect square and $a,b,c \\in \\mathbb{Q}$, roots are rational).
- If $\\Delta = 0$: Real, repeated (coincident) roots: $\\alpha = \\beta = -\\frac{b}{2a}$.
- If $\\Delta < 0$: Conjugate complex roots $\\alpha, \\beta = u \\pm iv$.

## 3. Vieta's Formulas (Sum & Product of Roots)
$$\\alpha + \\beta = -\\frac{b}{a}$$
$$\\alpha \\beta = \\frac{c}{a}$$

### Symmetric Functions:
$$\\alpha^2 + \\beta^2 = (\\alpha + \\beta)^2 - 2\\alpha\\beta$$
$$\\frac{1}{\\alpha} + \\frac{1}{\\beta} = \\frac{\\alpha + \\beta}{\\alpha\\beta}$$
    `.trim(),
  });

  console.log("✅ UI Sample Lessons Seeded Successfully!");
}

main()
  .catch((e) => {
    console.error("❌ Lesson seed error:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
