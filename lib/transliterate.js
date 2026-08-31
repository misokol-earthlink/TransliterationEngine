const fs = require("fs");
const path = require("path");
const OpenAI = require("openai");

function getOpenAIClient(apiKey) {
  return new OpenAI({
    apiKey:
      apiKey ||
      process.env.OPENAI_API_KEY
  });
}

function enforceSentenceCapitalization(jsonData) {
  if (
    !jsonData ||
    !Array.isArray(jsonData.lines)
  ) {
    return jsonData;
  }

  /*
   * Determine document mode.
   *
   * If any Hebrew word contains a cantillation
   * mark U+0591 through U+05AF, treat the entire
   * document as cantillated.
   */
  const hasTrope =
    jsonData.lines.some(function (line) {
      const words =
        Array.isArray(line.words)
          ? line.words
          : [];

      return words.some(function (word) {
        return /[\u0591-\u05AF]/.test(
          String(word.hebrew || "")
        );
      });
    });

  let capitalizeNext = true;

  jsonData.lines.forEach(function (line) {
    const words =
      Array.isArray(line.words)
        ? line.words
        : [];

    words.forEach(function (word) {
      const translit =
        String(word.translit || "");

      if (
        capitalizeNext &&
        translit
      ) {
        word.translit =
          translit.replace(
            /[A-Za-z]/,
            function (letter) {
              return letter.toUpperCase();
            }
          );

        capitalizeNext = false;
      }

      const hebrew =
        String(word.hebrew || "");

      if (hasTrope) {
        /*
         * Cantillated text:
         * Sof Pasuq defines the sentence end.
         */
        if (hebrew.includes("\u05C3")) {
          capitalizeNext = true;
        }
      } else {
        /*
         * Non-cantillated text:
         * ordinary sentence punctuation defines
         * the sentence end.
         */
        if (/[.!?]\s*$/.test(hebrew)) {
          capitalizeNext = true;
        }
      }
    });
  });

  return jsonData;
}

async function transliterateJson(
  inputJson,
  apiKey
) {  const specificationPath = path.join(
    __dirname,
    "..",
    "Specification",
    "URJ_Transliteration_Specification.md"
  );

  const specification = fs.readFileSync(specificationPath, "utf8");
const client =
  getOpenAIClient(apiKey);
  const response = await client.responses.create({
    model: "gpt-5.4-mini",
    instructions: specification,
    input: `
Process the supplied JSON according to the specification.

Preserve the complete JSON structure.
Preserve every Hebrew string exactly as received.
Replace only each "translit" value.
Return valid JSON only.

JSON:
${JSON.stringify(inputJson, null, 2)}
`
  });

 const result =
  JSON.parse(
    response.output_text
  );

return enforceSentenceCapitalization(
  result
);
}

module.exports = {
  transliterateJson
};