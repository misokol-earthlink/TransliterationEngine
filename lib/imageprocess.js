const fs = require("fs");
const path = require("path");
const OpenAI = require("openai");
const { toFile } = require("openai");
function getOpenAIClient(apiKey) {
  return new OpenAI({
    apiKey:
      apiKey ||
      process.env.OPENAI_API_KEY
  });
}
console.log(
  "LOADED IMAGEPROCESS VERSION: title-fix-20260715"
);
console.log(
  "IMAGEPROCESS FILE:",
  __filename
);

/**
 * Extract Hebrew from an image or PDF and return Lyrics JSON.
 *
 * @param {Buffer} fileBuffer
 *   The uploaded image or PDF contents.
 *
 * @param {string} fileName
 *   The original uploaded filename.
 *
 * @param {string} mimeType
 *   The uploaded file MIME type.
 *
 * @returns {Promise<object>}
 *   Compatible Lyrics JSON with blank translit values.
 */
async function processHebrewImage(
  fileBuffer,
  fileName,
  mimeType,
  apiKey
) {
  const client =
    getOpenAIClient(apiKey);
  console.log(
    "ENTERED processHebrewImage:",
    fileName,
    mimeType
  );

  if (!Buffer.isBuffer(fileBuffer)) {    throw new Error(
      "Image processing requires a valid file buffer."
    );
  }

  if (!fileName) {
    throw new Error(
      "Image processing requires a filename."
    );
  }

  const specificationPath = path.join(
    __dirname,
    "..",
    "Specification",
    "HebrewImageProcessingSpecificationNew.md"
  );

  const specification = fs.readFileSync(
    specificationPath,
    "utf8"
  );

  const normalizedMimeType =
    String(mimeType || "").toLowerCase();

  const normalizedFileName =
    String(fileName).toLowerCase();

  const isPdf =
    normalizedMimeType === "application/pdf" ||
    normalizedFileName.endsWith(".pdf");

let uploadedFile = null;

try {
  let fileInput;

  if (isPdf) {
    console.log("Uploading PDF to OpenAI...");

    uploadedFile = await client.files.create({
      file: await toFile(
        fileBuffer,
        fileName,
        {
          type: "application/pdf"
        }
      ),
      purpose: "user_data"
    });

    console.log(
      "PDF upload complete:",
      uploadedFile.id
    );

    fileInput = {
      type: "input_file",
      file_id: uploadedFile.id
    };
  } else {
    console.log(
      "Encoding image for direct submission..."
    );

    const imageMimeType =
      normalizedMimeType.startsWith("image/")
        ? normalizedMimeType
        : "image/jpeg";

    const base64Image =
      fileBuffer.toString("base64");

    const imageDataUrl =
      "data:" +
      imageMimeType +
      ";base64," +
      base64Image;

    fileInput = {
      type: "input_image",
      image_url: imageDataUrl,
      detail: "high"
    };

    console.log(
      "Image encoding complete."
    );
  }

console.log(
  "Sending file to image-processing model..."
);

const response = await client.responses.create(
  {
  model: "gpt-5.4-mini",
    //model: "gpt-5.6",
    instructions: specification,
    input: [
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text:
              "Process the supplied image or PDF " +
              "according to the specification.\n\n" +
              "Original filename: " +
              fileName +
              "\n\n" +
              "Return valid Lyrics JSON only."
          },
          fileInput
        ]
      }
    ]
  },
  {
    timeout: 120000,
     maxRetries: 0
  }
);


console.log("===== COMPLETE RESPONSE =====");
console.dir(response, { depth: null });
console.log("=============================");

console.log(
  "Image-processing model returned a response."
);
    const outputText =
      String(response.output_text || "").trim();

    if (!outputText) {
      throw new Error(
        "The image-processing model returned no output."
      );
    }

  let extractedJson;
console.log(typeof outputText);
console.log(outputText);
try {
  extractedJson = JSON.parse(outputText);
} catch (parseError) {
  throw new Error(
    "The image-processing model did not return valid JSON."
  );
}

extractedJson.title = path
  .basename(fileName)
  .replace(/\.[^.]+$/, "");

console.log(
  "TITLE BEFORE FIRST-PASS VALIDATION:",
  extractedJson.title
);

console.log(
  "EXTRACTED JSON TYPE:",
  Array.isArray(extractedJson)
    ? "array"
    : typeof extractedJson
);

/*
 * Validate Pass 1 before using it as the
 * working transcription for Pass 2.
 */
console.log(
  "FIRST RETURNED WORD:",
  extractedJson.lines &&
  extractedJson.lines[0] &&
  extractedJson.lines[0].words &&
  extractedJson.lines[0].words[0]
);
validateExtractedJson(extractedJson);
return extractedJson;

} finally {
  /*
   * Remove the temporarily uploaded API file.
   * A cleanup failure should not discard a successful result.
   */
  if (uploadedFile && uploadedFile.id) {
    try {
      await client.files.delete(uploadedFile.id);
    } catch (cleanupError) {
      console.warn(
        "Could not remove temporary OpenAI file:",
        cleanupError.message
      );
    }
  }
}
}
function validateExtractedJson(jsonData) {
  if (
    !jsonData ||
    typeof jsonData !== "object" ||
    Array.isArray(jsonData)
  ) {
    throw new Error(
      "The image-processing result is not a JSON object."
    );
  }

  if (typeof jsonData.title !== "string") {
    throw new Error(
      'The image-processing result is missing a valid "title".'
    );
  }

  if (!Array.isArray(jsonData.lines)) {
    throw new Error(
      'The image-processing result is missing a valid "lines" array.'
    );
  }

  jsonData.lines.forEach(function (line, lineIndex) {
    if (
      !line ||
      typeof line !== "object" ||
      !Array.isArray(line.words)
    ) {
      throw new Error(
        "Invalid words array in extracted line " +
        (lineIndex + 1) +
        "."
      );
    }

    line.words.forEach(function (word, wordIndex) {
      if (
        !word ||
        typeof word !== "object" ||
        typeof word.hebrew !== "string" ||
        typeof word.translit !== "string"
      ) {
        throw new Error(
          "Invalid word object at line " +
          (lineIndex + 1) +
          ", word " +
          (wordIndex + 1) +
          "."
        );
      }
    });
  });
}

module.exports = {
  processHebrewImage
};