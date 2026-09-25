import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

import {
  PDFParse,
} from "pdf-parse";

import mammoth from "mammoth";
import JSZip from "jszip";
import { createWorker } from "tesseract.js";

const execFileAsync = promisify(execFile);

// =========================================================
// TYPES
// =========================================================

export interface ExtractedDocument {
  text: string;

  pages?: Array<{
    pageNumber: number;
    text: string;
  }>;

  slides?: Array<{
    slideNumber: number;
    text: string;
  }>;
}

// =========================================================
// FILE TYPE DETECTION
// =========================================================

function getExtension(
  filePath: string
): string {
  return path
    .extname(filePath)
    .toLowerCase();
}

// =========================================================
// PDF
// =========================================================

async function extractPdf(
  filePath: string
): Promise<ExtractedDocument> {
  const buffer =
    await fs.readFile(
      filePath
    );

  const parser =
    new PDFParse({
      data: buffer,
    });

  try {
    const result =
      await parser.getText();

    return {
      text:
        result.text.trim(),
    };
  } finally {
    await parser.destroy();
  }
}

// =========================================================
// WORD DOCUMENT (.docx)
// =========================================================

async function extractWord(
  filePath: string
): Promise<ExtractedDocument> {
  const result =
    await mammoth.extractRawText({
      path: filePath,
    });

  return {
    text:
      result.value.trim(),
  };
}

// =========================================================
// POWERPOINT (.pptx)
// =========================================================
//
// PPTX files are ZIP archives containing XML files.
//
// We extract text from:
//
// ppt/slides/slide1.xml
// ppt/slides/slide2.xml
// etc.
//
// PowerPoint text runs are represented using:
//
// <a:t>Some text</a:t>
//

async function extractPowerPoint(
  filePath: string
): Promise<ExtractedDocument> {
  const buffer =
    await fs.readFile(
      filePath
    );

  const zip =
    await JSZip.loadAsync(
      buffer
    );

  const slideFiles =
    Object.keys(zip.files)
      .filter(
        (name) =>
          /^ppt\/slides\/slide\d+\.xml$/
            .test(name)
      )
      .sort(
        (a, b) => {
          const aNumber =
            Number(
              a.match(
                /slide(\d+)\.xml/
              )?.[1] ?? 0
            );

          const bNumber =
            Number(
              b.match(
                /slide(\d+)\.xml/
              )?.[1] ?? 0
            );

          return aNumber - bNumber;
        }
      );

  const slides: Array<{
    slideNumber: number;
    text: string;
  }> = [];

  for (
    let index = 0;
    index < slideFiles.length;
    index++
  ) {
    const fileName =
      slideFiles[index];

    const slideFile =
      zip.files[fileName];

    if (!slideFile) {
      continue;
    }

    const xml =
      await slideFile.async(
        "text"
      );

    const textMatches =
      [
        ...xml.matchAll(
          /<a:t>([\s\S]*?)<\/a:t>/g
        ),
      ];

    const text =
      textMatches
        .map(
          (match) =>
            decodeXmlEntities(
              match[1]
            )
        )
        .join(" ")
        .replace(
          /\s+/g,
          " "
        )
        .trim();

    if (text) {
      slides.push({
        slideNumber:
          index + 1,
        text,
      });
    }
  }

  return {
    text:
      slides
        .map(
          (slide) =>
            `Slide ${slide.slideNumber}\n${slide.text}`
        )
        .join("\n\n"),

    slides,
  };
}

// =========================================================
// XML ENTITY DECODING
// =========================================================

function decodeXmlEntities(
  value: string
): string {
  return value
    .replace(
      /&amp;/g,
      "&"
    )
    .replace(
      /&lt;/g,
      "<"
    )
    .replace(
      /&gt;/g,
      ">"
    )
    .replace(
      /&quot;/g,
      '"'
    )
    .replace(
      /&apos;/g,
      "'"
    );
}

// =========================================================
// PLAIN TEXT
// =========================================================

async function extractText(
  filePath: string
): Promise<ExtractedDocument> {
  const text =
    await fs.readFile(
      filePath,
      "utf8"
    );

  return {
    text: text.trim(),
  };
}

// =========================================================
// LEGACY OFFICE CONVERSION (.ppt / .doc)
// =========================================================
//
// .ppt and .doc are binary OLE formats, not ZIP archives
// like their modern .pptx/.docx counterparts, so neither
// JSZip nor mammoth can read them directly.
//
// We convert them to the modern format first using a
// LibreOffice headless conversion, then reuse the existing
// modern-format extractors on the converted file.
//
// This requires LibreOffice to be installed on the machine
// running ingestion. It is NOT an npm dependency.
//
// The path to the LibreOffice binary can be overridden via
// the LIBREOFFICE_PATH environment variable. This matters
// on Windows, where "soffice" is usually not on PATH by
// default and the full install path must be supplied, e.g.
//
// LIBREOFFICE_PATH="C:\Program Files\LibreOffice\program\soffice.exe"
//

const LIBREOFFICE_CONVERSION_TIMEOUT_MS = 120_000;

function getLibreOfficeBinary(): string {
  return (
    process.env.LIBREOFFICE_PATH?.trim() ||
    "soffice"
  );
}

async function convertWithLibreOffice(
  filePath: string,
  targetExtension: "pptx" | "docx"
): Promise<string> {
  const tempDir =
    await fs.mkdtemp(
      path.join(
        os.tmpdir(),
        "knowledge-convert-"
      )
    );

  const binary =
    getLibreOfficeBinary();

  try {
    await execFileAsync(
      binary,
      [
        "--headless",
        "--convert-to",
        targetExtension,
        "--outdir",
        tempDir,
        filePath,
      ],
      {
        timeout:
          LIBREOFFICE_CONVERSION_TIMEOUT_MS,
      }
    );
  } catch (conversionError) {
    await fs.rm(tempDir, {
      recursive: true,
      force: true,
    });

    throw new Error(
      `Failed to convert "${path.basename(
        filePath
      )}" to .${targetExtension} using LibreOffice. ` +
        `Ensure LibreOffice is installed and either "soffice" is on PATH ` +
        `or LIBREOFFICE_PATH points to the soffice binary. ` +
        `Original error: ${
          conversionError instanceof Error
            ? conversionError.message
            : String(conversionError)
        }`
    );
  }

  const baseName =
    path.basename(
      filePath,
      path.extname(filePath)
    );

  const convertedPath =
    path.join(
      tempDir,
      `${baseName}.${targetExtension}`
    );

  try {
    await fs.access(convertedPath);
  } catch {
    await fs.rm(tempDir, {
      recursive: true,
      force: true,
    });

    throw new Error(
      `LibreOffice reported success converting "${path.basename(
        filePath
      )}" but the expected output file was not found at ${convertedPath}.`
    );
  }

  return convertedPath;
}

async function extractLegacyPowerPoint(
  filePath: string
): Promise<ExtractedDocument> {
  const convertedPath =
    await convertWithLibreOffice(
      filePath,
      "pptx"
    );

  try {
    return await extractPowerPoint(
      convertedPath
    );
  } finally {
    await fs.rm(
      path.dirname(convertedPath),
      {
        recursive: true,
        force: true,
      }
    );
  }
}

async function extractLegacyWord(
  filePath: string
): Promise<ExtractedDocument> {
  const convertedPath =
    await convertWithLibreOffice(
      filePath,
      "docx"
    );

  try {
    return await extractWord(
      convertedPath
    );
  } finally {
    await fs.rm(
      path.dirname(convertedPath),
      {
        recursive: true,
        force: true,
      }
    );
  }
}

// =========================================================
// SCANNED IMAGES (.jpg / .jpeg / .png) — OCR
// =========================================================
//
// Many "Past Questions" materials are scanned photos of
// exam papers with no embedded text layer. We run OCR
// using tesseract.js (pure JS/WASM — no system binary
// required, unlike node-tesseract-ocr).
//
// OCR quality on phone-photographed exam papers will vary.
// This is intentionally a best-effort extraction: garbled
// or partial text is preferable to skipping the file
// entirely, since retrieval can still surface a rough match.
//

async function extractImage(
  filePath: string
): Promise<ExtractedDocument> {
  const worker =
    await createWorker("eng");

  try {
    const { data } =
      await worker.recognize(
        filePath
      );

    return {
      text:
        data.text.trim(),
    };
  } finally {
    await worker.terminate();
  }
}

// =========================================================
// PUBLIC EXTRACTION FUNCTION
// =========================================================

export async function extractDocument(
  filePath: string
): Promise<ExtractedDocument> {
  const extension =
    getExtension(
      filePath
    );

  switch (extension) {
    case ".pdf":
      return extractPdf(
        filePath
      );

    case ".docx":
      return extractWord(
        filePath
      );

    case ".doc":
      return extractLegacyWord(
        filePath
      );

    case ".pptx":
      return extractPowerPoint(
        filePath
      );

    case ".ppt":
      return extractLegacyPowerPoint(
        filePath
      );

    case ".jpg":
    case ".jpeg":
    case ".png":
      return extractImage(
        filePath
      );

    case ".txt":
      return extractText(
        filePath
      );

    case ".md":
      return extractText(
        filePath
      );

    default:
      throw new Error(
        `Unsupported document type: ${extension}`
      );
  }
}