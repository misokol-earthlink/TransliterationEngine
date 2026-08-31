const API_BASE =
  "https://transliterationengine.onrender.com";


const API = {
  process:
    API_BASE + "/process",

  processImage:
    API_BASE + "/process-image"
};

const fileInput = document.getElementById("jsonFileInput");
const processButton = document.getElementById("processButton");
const openJsonForReviewButton =   document.getElementById(    "openJsonForReviewButton"  );
const processImageButton =   document.getElementById("processImageButton");
const processExtractedButton =   document.getElementById("processExtractedButton");
const status = document.getElementById("status");
const results = document.getElementById("results");
const hebrewSummaryTitle =   document.getElementById("hebrewSummaryTitle");
const downloadReviewButton =     document.getElementById( "downloadReviewButton" );
const hebrewSummary =   document.getElementById("hebrewSummary");
const downloadButton =   document.getElementById("downloadButton");
const imageFileInput =   document.getElementById("imageFileInput");
const reviewFileInput =   document.getElementById("reviewFileInput");
const startReviewButton =   document.getElementById("startReviewButton");
const transliterationSummaryTitle =   document.getElementById(   "transliterationSummaryTitle");
const transliterationSummary =   document.getElementById("transliterationSummary");
const enableTransliterationEditing =    document.getElementById("enableTransliterationEditing");
const commitTransliterationEditsButton =  document.getElementById("commitTransliterationEditsButton" );
const logoutButton =   document.getElementById("logoutButton");
let selectedReviewGapId = null;
let transliterationEditsCommitted = false;
let currentJson = null;
let reviewJson = null;
let currentImageFile = null;
let jsonReviewActive = false;
let extractedJson = null;
let selectedReviewWordIds = [];
let activeReviewWord = null;
let reviewModalWorkingHebrew = null;
let activeReviewLine = null;
let reviewLineWorkingGaps = null;
let originalReviewJson = null;
function splitReviewWordStructure(text) {
  const value = String(text || "");

  const match = value.match(
    /^(.*?)([,.;:]*)$/
  );

  if (!match) {
    return {
      hebrew: value,
      after: ""
    };
  }

  return {
    hebrew: match[1],
    after: match[2]
  };
}

function createReviewJson(ocrJson) {
  return {
    title: String(ocrJson.title || ""),
    reviewVersion: 1,
    documentStatus: "in-progress",

    lines: Array.isArray(ocrJson.lines)
      ? ocrJson.lines.map(function (
          line,
          lineIndex
        ) {
          const lineNumber =
            lineIndex + 1;

          const sourceWords =
            Array.isArray(line.words)
              ? line.words
              : [];

          const reviewWords =
            sourceWords.map(function (
              word,
              wordIndex
            ) {
              const wordNumber =
                wordIndex + 1;

              const normalizedHebrew =
                normalizeReviewUnicode(
                  String(word.hebrew || "")
                );

              const structure =
                splitReviewWordStructure(
                  normalizedHebrew
                );

              return {
                id:
                  "L" +
                  lineNumber +
                  "W" +
                  wordNumber,

                hebrew:
                  structure.hebrew,

                after:
                  structure.after,

                translit:
                  String(
                    word.translit || ""
                  ),

                originalHebrew:
                  structure.hebrew,

                originalAfter:
                  structure.after,

                reviewStatus:
                  "unreviewed",

                repair: false,

                notes: ""
              };
            });

        const gaps = [];

for (
  let gapIndex = 0;
  gapIndex <= reviewWords.length;
  gapIndex++
) {
  let punctuation = "";

  /*
   * Gap 0 occurs before the first word,
   * so there is no preceding word whose
   * punctuation belongs here.
   *
   * Every later gap receives the "after"
   * punctuation currently associated with
   * the preceding word.
   */
  if (gapIndex > 0) {
    punctuation =
      String(
        reviewWords[
          gapIndex - 1
        ].after || ""
      );
  }

  gaps.push({
    id:
      "L" +
      lineNumber +
      "G" +
      gapIndex,

    punctuation:
      punctuation,

    originalPunctuation:
      punctuation
  });
}
          return {
            lineName:
              line.lineName ||
              "Line" + lineNumber,

            words:
              reviewWords,

            gaps:
              gaps
          };
        })
      : []
  };
}

logoutButton.addEventListener(
  "click",
  async function () {
    try {
      const response = await fetch(
        API_BASE + "/logout",
        {
          method: "POST",
          credentials: "include"
        }
      );

      if (!response.ok) {
        throw new Error(
          "Logout failed."
        );
      }

      window.location.href =
        "index.html";
    } catch (error) {
      console.error(error);
      alert(
        "Unable to log out. Please try again."
      );
    }
  }
);

fileInput.addEventListener(
  "change",
  loadJsonFile
);

processButton.addEventListener(
  "click",
  processJson
);
openJsonForReviewButton.addEventListener(
  "click",
  openJsonForReview
);
processImageButton.addEventListener(
  "click",
  processImage
);

reviewFileInput.addEventListener(
  "change",
  loadReviewFile
);

processExtractedButton.addEventListener(
  "click",
  processExtractedHebrew
);

downloadReviewButton.addEventListener(
  "click",
  downloadReviewJson
);

downloadButton.addEventListener(
  "click",
  downloadUpdatedJson
);

imageFileInput.addEventListener(
  "change",
  loadImageFile
);

startReviewButton.addEventListener(
  "click",
  startReview
);
function loadJsonFile(event) {
  const file = event.target.files[0];

  results.innerHTML = "";
  currentJson = null;
jsonReviewActive = false;
processButton.disabled = true;
openJsonForReviewButton.disabled = true;
downloadButton.disabled = true;

  if (!file) {
    status.textContent = "No file selected.";
    return;
  }

  const reader = new FileReader();

  reader.onload = function (e) {
    try {
      currentJson = JSON.parse(e.target.result);

      if (
        !currentJson ||
        !Array.isArray(currentJson.lines)
      ) {
        throw new Error(
          'The JSON must contain a "lines" array.'
        );
      }

      status.innerHTML =
        "<b>Loaded:</b> " +
        escapeHtml(file.name) +
        "<br><br>" +
        "<b>Title:</b> " +
        escapeHtml(currentJson.title || "") +
        "<br>" +
        "<b>Lines:</b> " +
        currentJson.lines.length;

      processButton.disabled = false;
openJsonForReviewButton.disabled = false;
    } catch (error) {
      console.error(error);

      status.innerHTML =
        "<span style='color:red'>" +
        "Invalid Lyrics JSON file." +
        "</span>";

      currentJson = null;
processButton.disabled = true;
openJsonForReviewButton.disabled = true;
    }
  };

  reader.onerror = function () {
    status.innerHTML =
      "<span style='color:red'>" +
      "The selected file could not be read." +
      "</span>";
  };

  reader.readAsText(file);
}
function openJsonForReview() {
  if (!currentJson) {
    return;
  }

  /*
   * Convert the loaded Lyrics JSON into
   * the same Review JSON structure used
   * by image OCR.
   */
  reviewJson =
    createReviewJson(
      currentJson
    );
downloadButton.disabled = false;
jsonReviewActive = true;
  /*
   * Preserve the imported starting state
   * for Restore All Original Lines.
   */
  originalReviewJson =
    cloneReviewJson(
      reviewJson
    );

  /*
   * The imported JSON is now the active
   * extracted/review source.
   */
  extractedJson =
    currentJson;

  selectedReviewWordIds = [];
  activeReviewWord = null;
  activeReviewLine = null;
  selectedReviewGapId = null;

  displayExtractedHebrew(
    reviewJson
  );

  startReviewButton.disabled =
    false;

  downloadReviewButton.disabled =
    false;

  processExtractedButton.disabled =
    false;

  document.getElementById(
    "restoreAllLinesButton"
  ).disabled =
    false;

  document.getElementById(
    "lineStructureNumber"
  ).value =
    "-1";

  refreshLineStructureControls();

  status.innerHTML =
    "<b>Lyrics JSON opened for review.</b>" +
    "<br><br>" +
    "Review the Hebrew and make any " +
    "word, punctuation, or line-structure corrections. " +
    "When finished, click " +
    "<b>Process Extracted Hebrew</b>.";
}
async function transliterateLyricsJson(jsonData) {
  const response = await fetch(API.process, {
    method: "POST",
credentials: "include",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(jsonData)
  });

  if (!response.ok) {
    let message =
      `Server returned status ${response.status}.`;

    try {
      const errorData = await response.json();

      if (errorData.error) {
        message = errorData.error;
      }
    } catch (parseError) {
      // Keep the HTTP status message.
    }

    throw new Error(message);
  }

  return await response.json();
}

async function processJson() {
 if (jsonReviewActive) {
    status.innerHTML =
      "<span style='color:#b00020'>" +
      "<b>This JSON is currently in Review mode.</b><br><br>" +
      "Use <b>Process Extracted Hebrew</b> to transliterate " +
      "the reviewed version, or save the Review JSON " +
      "for later processing." +
      "</span>";

    return;
  }
  if (!currentJson) {
    return;
  }

  processButton.disabled = true;
  downloadButton.disabled = true;
  results.innerHTML = "";

  status.textContent =
    "Sending JSON for transliteration...";

  try {
    const returnedJson =
      await transliterateLyricsJson(currentJson);

    currentJson = returnedJson;

    downloadButton.disabled = false;

    status.innerHTML =
      "<b>Transliteration complete.</b>" +
      "<br><br>" +
      "<b>Title:</b> " +
      escapeHtml(returnedJson.title || "");

    displayProcessedLines(returnedJson);
  } catch (error) {
    console.error(error);

    status.innerHTML =
      "<span style='color:red'>" +
      "The transliteration request failed: " +
      escapeHtml(error.message) +
      "</span>";
  } finally {
    processButton.disabled = false;
  }
}

function displayExtractedHebrew(jsonData) {
selectedReviewWordIds = [];
  results.innerHTML = "";
let fullHebrew = "";
  if (!Array.isArray(jsonData.lines)) {
    return;
  }

  jsonData.lines.forEach(function (line) {
    const lineBox = document.createElement("div");
    lineBox.className = "result-line";

    const lineName = document.createElement("div");
    lineName.className = "line-name";
    lineName.textContent =
      line.lineName || "Unnamed line";
lineName.ondblclick = function () {
  openLinePunctuationModal(
    line
  );
};
    const words = Array.isArray(line.words)
      ? line.words
      : [];
lineBox.oncontextmenu = function (event) {
  event.preventDefault();

  const selectedWord = words.find(function (word) {
    return selectedReviewWordIds.includes(word.id);
  });

  if (!selectedWord) {
    alert(
      "Please choose another line. " +
      "This line has no words selected for review."
    );
    return;
  }

  activeReviewWord = selectedWord;

  openReviewModal(
    selectedWord.originalHebrew,
    selectedWord.hebrew
  );
};
    const hebrewLine = document.createElement("div");
    hebrewLine.className = "hebrew-line";

const gaps =
  Array.isArray(line.gaps)
    ? line.gaps
    : [];

/*
 * Gap 0 is the position before
 * the first word in the line.
 */
if (
  gaps[0] &&
  gaps[0].punctuation
) {
  hebrewLine.appendChild(
    document.createTextNode(
      String(gaps[0].punctuation)
    )
  );
}

words.forEach(function (word, wordIndex) {
  const wordSpan =
    document.createElement("span");
wordSpan.style.direction = "rtl";
wordSpan.style.unicodeBidi = "isolate";
wordSpan.style.display = "inline-block";
  wordSpan.id = word.id;

 wordSpan.onclick = function () {
  const clickedId =
    this.id;

  const wasAlreadySelected =
    selectedReviewWordIds.length === 1 &&
    selectedReviewWordIds[0] === clickedId;

  document.querySelectorAll(
    ".hebrew-line span"
  ).forEach(function(span) {
    span.style.color = "";
  });

  selectedReviewWordIds = [];

  if (!wasAlreadySelected) {
    selectedReviewWordIds.push(
      clickedId
    );

    this.style.color = "red";
  }

  console.log(
    selectedReviewWordIds
  );
};

  /*
   * The clickable span now contains
   * only the Hebrew word.
   */
  wordSpan.textContent =
    String(word.hebrew || "").trim();

  hebrewLine.appendChild(
    wordSpan
  );

  /*
   * Punctuation following this word
   * comes from its corresponding gap.
   */
  const followingGap =
    gaps[wordIndex + 1];

  if (
    followingGap &&
    followingGap.punctuation
  ) {
    hebrewLine.appendChild(
      document.createTextNode(
        String(
          followingGap.punctuation
        )
      )
    );
  }

  /*
   * Add the normal visual space
   * between words.
   */
  if (
    wordIndex <
    words.length - 1
  ) {
    hebrewLine.appendChild(
      document.createTextNode(" ")
    );
  }
});

    lineBox.appendChild(lineName);
    lineBox.appendChild(hebrewLine);

    results.appendChild(lineBox);
  });
hebrewSummary.innerHTML = "";

jsonData.lines.forEach(
  function(line) {
    const lineText =
      buildReviewLineText(
        line
      );

    if (!lineText) {
      return;
    }

    const summaryLine =
      document.createElement(
        "div"
      );

    summaryLine.textContent =
      lineText;

    summaryLine.dir =
      "rtl";

    summaryLine.style.direction =
      "rtl";

    summaryLine.style.unicodeBidi =
      "isolate";

    summaryLine.style.textAlign =
      "right";

    hebrewSummary.appendChild(
      summaryLine
    );
  }
);

hebrewSummary.style.direction = "rtl";
hebrewSummary.style.textAlign = "right";
hebrewSummary.className = "hebrew-line";
hebrewSummaryTitle.style.display = "block";
hebrewSummary.style.display = "block";
refreshLineStructureControls();
}

function displayProcessedLines(jsonData) {
  results.innerHTML = "";

  let fullHebrew = "";
  let fullTranslit = "";

  if (!Array.isArray(jsonData.lines)) {
    return;
  }

  jsonData.lines.forEach(function (line) {
    const lineBox = document.createElement("div");
    lineBox.className = "result-line";

    const lineName = document.createElement("div");
    lineName.className = "line-name";
    lineName.textContent =
      line.lineName || "Unnamed line";

    const words = Array.isArray(line.words)
      ? line.words
      : [];

    const hebrewLine =
      document.createElement("div");

    hebrewLine.className = "hebrew-line";

    hebrewLine.textContent = words
      .map(function (word) {
        return cleanLineText(word.hebrew);
      })
      .filter(Boolean)
      .join(" ");

    if (hebrewLine.textContent) {
      fullHebrew +=
        hebrewLine.textContent + "\n";
    }

    const translitLine =
      document.createElement("div");

    translitLine.className = "translit-line";

    translitLine.textContent = words
      .map(function (word) {
        return cleanLineText(word.translit);
      })
      .filter(Boolean)
      .join(" ");

    if (translitLine.textContent) {
      fullTranslit +=
        translitLine.textContent + "\n";
    }

    lineBox.appendChild(lineName);
    lineBox.appendChild(hebrewLine);
    lineBox.appendChild(translitLine);

    results.appendChild(lineBox);
  });

  hebrewSummary.textContent =
    fullHebrew.trim();

  hebrewSummary.style.whiteSpace = "pre-wrap";
  hebrewSummary.style.direction = "rtl";
  hebrewSummary.style.textAlign = "right";
  hebrewSummary.className = "hebrew-line";

  hebrewSummaryTitle.style.display = "block";
  hebrewSummary.style.display = "block";
enableTransliterationEditing.checked = false;
transliterationSummary.readOnly = true;
  transliterationSummary.value =
  fullTranslit.trim();

transliterationSummaryTitle.style.display =
  "block";
commitTransliterationEditsButton.style.display =
  "inline-block";

commitTransliterationEditsButton.disabled =
  true;
transliterationSummary.style.display =
  "block";
}
function downloadUpdatedJson() {
  let jsonToSave = null;

  /*
   * If review data exists, it is the most
   * current working state and takes priority.
   */
  /*
 * Committed transliteration edits take
 * priority because they are stored in
 * currentJson.
 */
if (
  transliterationEditsCommitted &&
  currentJson
) {
  jsonToSave =
    currentJson;
} else if (
  reviewJson &&
  Array.isArray(reviewJson.lines)
) {
  /*
   * If there are no committed
   * transliteration edits, review data
   * remains the current working state.
   */
  jsonToSave =
    buildLyricsJsonFromReview();
} else if (currentJson) {
  jsonToSave =
    currentJson;
}

  if (!jsonToSave) {
    alert(
      "There is no Lyrics JSON available to save."
    );
    return;
  }

  const jsonText =
    JSON.stringify(
      jsonToSave,
      null,
      2
    );

  const blob =
    new Blob(
      [jsonText],
      {
        type:
          "application/json"
      }
    );

  const url =
    URL.createObjectURL(
      blob
    );

  const link =
    document.createElement(
      "a"
    );

  link.href =
    url;

  const safeTitle =
    String(
      jsonToSave.title ||
      "lyrics"
    )
      .trim()
      .replace(
        /[<>:"/\\|?*\x00-\x1F]/g,
        "_"
      )
      .replace(
        /\s+/g,
        "_"
      );

  link.download =
    safeTitle +
    "_Lyrics.json";

  document.body.appendChild(
    link
  );

  link.click();

  document.body.removeChild(
    link
  );

  URL.revokeObjectURL(
    url
  );
}
async function processImage() {
  if (!currentImageFile) {
    status.innerHTML =
      "<span style='color:red'>" +
      "Please select an image or PDF file." +
      "</span>";
    return;
  }
const expectedLineCount =
  Number(
    document.getElementById(
      "expectedLineCount"
    ).value
  );

if (
  !Number.isInteger(expectedLineCount) ||
  expectedLineCount < -1 ||
  expectedLineCount === 0
) {
  alert(
    "Enter -1 if the number of physical Hebrew lines is unknown, " +
    "or enter a line count of 1 or greater."
  );
  return;
}
  try {
    /*
     * PASS 1
     */
    status.innerHTML =
      "<b>Processing image...</b>";

    const firstPassFormData =
      new FormData();

    firstPassFormData.append(
      "image",
      currentImageFile
    );
firstPassFormData.append(
  "expectedLineCount",
  String(expectedLineCount)
);
    const firstResponse =
      await fetch(
  API.processImage,
        {
          method: "POST",
          body: firstPassFormData
        }
      );

    if (!firstResponse.ok) {
      let message =
        `Server returned status ${firstResponse.status}.`;

      try {
        const errorData =
          await firstResponse.json();

        if (errorData.error) {
          message =
            errorData.error;
        }
      } catch (parseError) {
        // Keep HTTP status message.
      }

      throw new Error(message);
    }

    extractedJson =
      await firstResponse.json();
const returnedLineCount =
  (
    extractedJson &&
    Array.isArray(extractedJson.lines)
  )
    ? extractedJson.lines.length
    : 0;

let lineCountNotice = "";

if (
  expectedLineCount >= 1 &&
  returnedLineCount !== expectedLineCount
) {
  lineCountNotice =
    "<br><br>" +
    "<span style='color:#b00020'>" +
    "<b>Structural review required.</b><br>" +
    "Expected physical lines: " +
    expectedLineCount +
    "<br>" +
    "OCR returned: " +
    returnedLineCount +
    "</span>";
}

   /*
 * Build the Review JSON
 * from the successful OCR result.
 */
   reviewJson =
  createReviewJson(
    extractedJson
  );
downloadButton.disabled = false;

/*
 * Preserve the complete starting review state
 * so Restore All can return to it later.
 */
originalReviewJson =
  cloneReviewJson(
    reviewJson
  );

document.getElementById(
  "restoreAllLinesButton"
).disabled = false;
 
    downloadReviewButton.disabled =
      false;

    startReviewButton.disabled =
      false;

    console.log(
      "Raw extracted JSON:",
      extractedJson
    );

    console.log(
      "Working review JSON:",
      reviewJson
    );

    displayExtractedHebrew(
      reviewJson
    );

  status.innerHTML =
  "<b>Image processing complete.</b>" +
  lineCountNotice +
  "<br><br>" +
  "Review the extracted Hebrew, then click " +
  "<b>Process Extracted Hebrew</b>.";

  } catch (error) {
    console.error(error);

    status.innerHTML =
      "<span style='color:red'>" +
      "Image processing failed: " +
      escapeHtml(error.message) +
      "</span>";
  }
}
function loadImageFile(event) {
console.log("loadImageFile fired");

  const file = event.target.files[0];

  currentImageFile = null;
  extractedJson = null;

  processImageButton.disabled = true;
  processExtractedButton.disabled = true;
reviewJson = null;
  downloadButton.disabled = true;
downloadReviewButton.disabled = true;
  results.innerHTML = "";

  if (!file) {
    status.textContent =
      "No image or PDF file selected.";
    return;
  }

  const allowedMimeTypes = [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "image/bmp",
    "application/pdf"
  ];

  const allowedExtensions = [
    ".jpg",
    ".jpeg",
    ".png",
    ".webp",
    ".gif",
    ".bmp",
    ".pdf"
  ];

  const fileName =
    String(file.name || "").toLowerCase();

  const hasAllowedMimeType =
    allowedMimeTypes.includes(file.type);

  const hasAllowedExtension =
    allowedExtensions.some(function (extension) {
      return fileName.endsWith(extension);
    });

  if (
    !hasAllowedMimeType &&
    !hasAllowedExtension
  ) {
    status.innerHTML =
      "<span style='color:red'>" +
      "Please select a JPEG, PNG, WebP, GIF, BMP, or PDF file." +
      "</span>";

    return;
  }

  currentImageFile = file;
processImageButton.disabled = false;
  status.innerHTML =
    "<b>Image source selected:</b> " +
    escapeHtml(file.name) +
    "<br><br>" +
    "<b>Type:</b> " +
    escapeHtml(file.type || "Unknown") +
    "<br>" +
    "<b>Size:</b> " +
    formatFileSize(file.size) +
    "<br><br>" +
    "Image processing is not yet implemented.";
}
function formatFileSize(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) {
    return "Unknown";
  }

  if (bytes < 1024) {
    return bytes + " bytes";
  }

  if (bytes < 1024 * 1024) {
    return (bytes / 1024).toFixed(1) + " KB";
  }

  return (
    bytes / (1024 * 1024)
  ).toFixed(1) + " MB";
}

async function processExtractedHebrew() {
  if (!extractedJson) {
    status.innerHTML =
      "<span style='color:red'>" +
      "No extracted Hebrew is available to process." +
      "</span>";
    return;
  }

  processExtractedButton.disabled = true;
  downloadButton.disabled = true;

  status.innerHTML =
    "<b>Transliterating extracted Hebrew...</b>";

  try {
    currentJson =
      await transliterateLyricsJson(extractedJson);

    displayProcessedLines(currentJson);

    downloadButton.disabled = false;

    status.innerHTML =
      "<b>Transliteration complete.</b><br><br>" +
      "<b>Title:</b> " +
      escapeHtml(currentJson.title || "");
  } catch (error) {
    console.error(error);

    status.innerHTML =
      "<span style='color:red'>" +
      "The extracted Hebrew could not be transliterated: " +
      escapeHtml(error.message) +
      "</span>";
  } finally {
    processExtractedButton.disabled = false;
  }
}

function cleanLineText(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function downloadReviewJson() {
  if (!reviewJson) {
    return;
  }

  const jsonText = JSON.stringify(
    reviewJson,
    null,
    2
  );

  const blob = new Blob(
    [jsonText],
    { type: "application/json" }
  );

  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;

  const safeTitle = String(
    reviewJson.title || "review"
  )
    .trim()
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "_")
    .replace(/\s+/g, "_");

  link.download =
    safeTitle + "_Review.json";

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}

async function loadReviewFile() {
  const file = reviewFileInput.files[0];

  if (!file) {
    return;
  }

  const text = await file.text();

  const loadedReviewJson =
    JSON.parse(text);

  if (
    !loadedReviewJson.reviewVersion ||
    !loadedReviewJson.lines
  ) {
    alert("This is not a valid Review JSON file.");
    return;
  }

  reviewJson = loadedReviewJson;
  downloadButton.disabled = false;
  startReviewButton.disabled = false;
  displayExtractedHebrew(reviewJson);
  downloadReviewButton.disabled = false;
}
function isReviewBaseCharacter(character) {
  return (
    /[\u05D0-\u05EA]/.test(character) ||
    character === "\uFB2A" || // Shin with Shin Dot
    character === "\uFB2B" || // Shin with Sin Dot
    character === "\uFB35" || // Shuruk
    character === "\uFB4B"    // Holam Male
  );
}
function parseReviewGraphemes(hebrewText) {
  const graphemes = [];
  let currentGrapheme = null;

  Array.from(String(hebrewText || "")).forEach(function(character) {

    if (isReviewBaseCharacter(character)) {
      currentGrapheme = {
        base: character,
        marks: []
      };

      graphemes.push(currentGrapheme);
      return;
    }

    if (
      currentGrapheme &&
      /[\u0591-\u05BD\u05BF-\u05C7]/.test(character)
    ) {
      currentGrapheme.marks.push(character);
    }
  });

  return graphemes;
}
function detectReviewVowelCombinations(graphemes) {
  const matches = [];

  const vowelYodPairs = {
    "\u05B4": "Hiriq + Yod",
    "\u05B7": "Patach + Yod",
    "\u05B8": "Qamatz + Yod",
    "\u05B5": "Tzere + Yod",
    "\u05B6": "Segol + Yod",
    "\u05B9": "Holam + Yod",
    "\u05BB": "Qubutz + Yod"
  };

 
  graphemes.forEach(function(grapheme, index) {
    const next = graphemes[index + 1];

    if (!next) {
      return;
    }

    const nextBase = next.base;

    grapheme.marks.forEach(function(mark) {
      if (
        nextBase === "\u05D9" &&
        vowelYodPairs[mark]
      ) {
        matches.push({
          startIndex: index,
          followingIndex: index + 1,
          type: vowelYodPairs[mark],
          elementType: "compoundVowel",
          mark: mark,
          includesFollowingBase: true
        });
      }

    });

    if (
      grapheme.base === "\uFB35" &&
      nextBase === "\u05D9"
    ) {
      matches.push({
        startIndex: index,
        followingIndex: index + 1,
        type: "Shuruk + Yod",
        elementType: "compoundVowel",
        mark: null,
        includesFollowingBase: true
      });
    }

    if (
      grapheme.base === "\uFB4B" &&
      nextBase === "\u05D9"
    ) {
      matches.push({
        startIndex: index,
        followingIndex: index + 1,
        type: "Holam Male + Yod",
        elementType: "compoundVowel",
        mark: null,
        includesFollowingBase: true
      });
    }
  });

  return matches;
}
function populateReviewExistingElements() {
  const positionSelect =
    document.getElementById(
      "reviewCharacterPosition"
    );

  const elementTypeSelect =
    document.getElementById(
      "reviewElementType"
    );

  const existingSelect =
    document.getElementById(
      "reviewExistingElement"
    );

  existingSelect.innerHTML =
    '<option value="">Choose existing element</option>';

  if (positionSelect.value === "") {
    return;
  }

  const currentText =
    document.getElementById(
      "reviewCurrentWord"
    ).textContent;

  const graphemes =
    parseReviewGraphemes(
      currentText
    );

  const selectedIndex =
    Number(positionSelect.value);

  const grapheme =
    graphemes[selectedIndex];

  if (!grapheme) {
    return;
  }

  /*
   * BASE LETTER
   */
  if (
    elementTypeSelect.value === "base"
  ) {
    const option =
      document.createElement(
        "option"
      );

    option.value =
      grapheme.base;

    option.textContent =
      grapheme.base;

    existingSelect.appendChild(
      option
    );

    existingSelect.value =
      grapheme.base;

    return;
  }

  /*
   * TROPE
   *
   * Hebrew cantillation marks occupy
   * U+0591 through U+05AF.
   *
   * Only trope marks attached to the
   * selected base are shown.
   */
  if (
    elementTypeSelect.value === "trope"
  ) {
    const tropeElements =
      getReviewTropeElements();

    grapheme.marks.forEach(
      function(mark, markIndex) {
        const codePoint =
          mark.codePointAt(0);

        if (
          codePoint < 0x0591 ||
          codePoint > 0x05AF
        ) {
          return;
        }

        const tropeElement =
          tropeElements.find(
            function(element) {
              return (
                element.mark === mark
              );
            }
          );

        const tropeName =
          tropeElement
            ? tropeElement.name
            : "Trope";

        const option =
          document.createElement(
            "option"
          );

        /*
         * Keep the actual marks[] index.
         * This allows the existing Remove
         * logic to address the correct mark.
         */
        option.value =
          String(markIndex);

        option.textContent =
          grapheme.base +
          mark +
          "   " +
          tropeName;

        existingSelect.appendChild(
          option
        );
      }
    );

    return;
  }

  /*
   * VOWEL
   *
   * Everything below this point is the
   * existing vowel/symbol functionality.
   */

  const vowelCombinations =
    detectReviewVowelCombinations(
      graphemes
    );

  const compound =
    vowelCombinations.find(
      function(item) {
        return (
          item.startIndex ===
          selectedIndex
        );
      }
    );

  /*
   * Compound vowel such as Hiriq + Yod.
   */
  if (
    compound &&
    compound.elementType ===
      "compoundVowel"
  ) {
    const option =
      document.createElement(
        "option"
      );

    option.value =
      "compound:" +
      compound.startIndex +
      ":" +
      compound.followingIndex;

    const followingBase =
      graphemes[
        compound.followingIndex
      ].base;

    const displayText =
      compound.mark !== null
        ? grapheme.base +
          compound.mark +
          followingBase
        : grapheme.base +
          followingBase;

    option.textContent =
      displayText +
      "   " +
      compound.type;

    existingSelect.appendChild(
      option
    );
  }

  /*
   * Atomic Shuruk / Holam Male
   * associated with this base.
   */
  const atomicVowelIndexes =
    getReviewAssociatedAtomicVowels(
      graphemes,
      selectedIndex
    );

  atomicVowelIndexes.forEach(
    function(index) {
      const atomicGrapheme =
        graphemes[index];

      const option =
        document.createElement(
          "option"
        );

      option.value =
        "atomic:" + index;

      const atomicName =
        atomicGrapheme.base ===
        "\uFB35"
          ? "Shuruk"
          : "Holam Male";

      const displayText =
        index < selectedIndex
          ? atomicGrapheme.base +
            grapheme.base
          : grapheme.base +
            atomicGrapheme.base;

      option.textContent =
        displayText +
        "   " +
        atomicName;

      existingSelect.appendChild(
        option
      );
    }
  );

  /*
   * Ordinary vowel/symbol marks.
   *
   * Explicitly exclude all cantillation
   * marks because those now belong in
   * Trope mode.
   */
grapheme.marks.forEach(
  function(mark, markIndex) {
    const codePoint =
      mark.codePointAt(0);

    const isTrope =
      codePoint >= 0x0591 &&
      codePoint <= 0x05AF;

    const isShinSinDot =
      codePoint === 0x05C1 ||
      codePoint === 0x05C2;

    /*
     * If this mark is already represented
     * by a compound vowel entry such as
     * Hiriq + Yod, do not also show the
     * vowel mark separately.
     */
    const isCompoundMark =
      compound &&
      compound.mark === mark;

    if (
      isTrope ||
      isShinSinDot ||
      isCompoundMark
    ) {
      return;
    }

    const option =
      document.createElement(
        "option"
      );

    option.value =
      String(markIndex);

    option.textContent =
      grapheme.base +
      mark +
      "   " +
      getReviewMarkName(mark);

    existingSelect.appendChild(
      option
    );
  }
);
}
function getReviewMarkName(mark) {
  const names = {
    "\u05B0": "Sh'va",
    "\u05B1": "Hataf Segol",
    "\u05B2": "Hataf Patach",
    "\u05B3": "Hataf Kamatz",
    "\u05B4": "Hirik",
    "\u05B5": "Tzere",
    "\u05B6": "Segol",
    "\u05B7": "Patach",
    "\u05B8": "Kamatz",
    "\u05B9": "Holam",
    "\u05BA": "Holam Haser for Vav",
    "\u05BB": "Kubutz",
    "\u05BC": "Dagesh or Mappiq",
    "\u05BD": "Meteg",
    "\u05BF": "Rafe",
     "\u05C4": "Upper Dot",
    "\u05C5": "Lower Dot",
    "\u05C7": "Kamatz Katan"
  };

  return names[mark] || getReviewTropeName(mark);
}

function getReviewTropeName(mark) {
  const codePoint = mark.codePointAt(0);

  if (
    codePoint >= 0x0591 &&
    codePoint <= 0x05AF
  ) {
    return (
      "Trope U+" +
      codePoint
        .toString(16)
        .toUpperCase()
        .padStart(4, "0")
    );
  }

  return (
    "Mark U+" +
    codePoint
      .toString(16)
      .toUpperCase()
      .padStart(4, "0")
  );
}

function populateReviewCharacterPositions(hebrewText) {
  const positionSelect =
    document.getElementById("reviewCharacterPosition");

  positionSelect.innerHTML =
    '<option value="">Choose character</option>';

  const graphemes =
    parseReviewGraphemes(hebrewText);

  /*
   * Identify dependent base characters that are
   * already functioning as part of a compound vowel,
   * such as Hiriq + Yod.
   *
   * Those dependent characters must NOT also appear
   * as independently selectable base letters.
   */
  const vowelCombinations =
    detectReviewVowelCombinations(graphemes);

  const dependentIndexes =
    new Set();

  vowelCombinations.forEach(function(item) {
    if (
      item.elementType === "compoundVowel" &&
      Number.isInteger(item.followingIndex)
    ) {
      dependentIndexes.add(
        item.followingIndex
      );
    }
  });

  let displayPosition = 0;

  graphemes.forEach(
    function(grapheme, graphemeIndex) {

      /*
       * Atomic vowel forms are not
       * selectable consonantal bases.
       */
      if (
        grapheme.base === "\uFB35" || // Shuruk
        grapheme.base === "\uFB4B"    // Holam Male
      ) {
        return;
      }

      /*
       * A dependent Yod or other following
       * base that belongs to a recognized
       * compound vowel is also not an
       * independent selectable base.
       */
      if (
        dependentIndexes.has(
          graphemeIndex
        )
      ) {
        return;
      }

      displayPosition++;

      const option =
        document.createElement("option");

      /*
       * Store the REAL grapheme-array index,
       * even though the displayed position
       * excludes vowel-only graphemes.
       */
      option.value =
        graphemeIndex;

      option.textContent =
        "Position " +
        displayPosition +
        " — " +
        grapheme.base;

      positionSelect.appendChild(
        option
      );
    }
  );
}
function startReview() {
  if (
    !reviewJson ||
    !Array.isArray(reviewJson.lines) ||
    reviewJson.lines.length === 0
  ) {
    alert(
      "No review data is available."
    );
    return;
  }

  const firstLine =
    reviewJson.lines[0];

  if (
    !Array.isArray(firstLine.words) ||
    firstLine.words.length === 0
  ) {
    alert(
      "Line 1 contains no words to review."
    );
    return;
  }

  activeReviewWord =
    firstLine.words[0];

  openReviewModal(
    activeReviewWord.originalHebrew,
    activeReviewWord.hebrew
  );
}
function reviewNextWord() {
  if (!activeReviewWord || !reviewJson) {
    return;
  }

  const line =
    reviewJson.lines.find(function(line) {
      return (
        Array.isArray(line.words) &&
        line.words.includes(activeReviewWord)
      );
    });

  if (!line) {
    return;
  }

  const currentIndex =
    line.words.indexOf(activeReviewWord);

  if (
    currentIndex >=
    line.words.length - 1
  ) {
    alert(
      "This is the last word in the line."
    );
    return;
  }

  activeReviewWord =
    line.words[currentIndex + 1];

  openReviewModal(
    activeReviewWord.originalHebrew,
    activeReviewWord.hebrew
  );
}
function reviewPreviousWord() {
  if (!activeReviewWord || !reviewJson) {
    return;
  }

  const line = reviewJson.lines.find(function (line) {
    return Array.isArray(line.words) &&
      line.words.includes(activeReviewWord);
  });

  if (!line) {
    return;
  }

  const currentIndex =
    line.words.indexOf(activeReviewWord);

  if (currentIndex <= 0) {
    alert("This is the first word in the line.");
    return;
  }

  activeReviewWord =
    line.words[currentIndex - 1];

  openReviewModal(
    activeReviewWord.originalHebrew,
    activeReviewWord.hebrew
  );
}

function reviewPreviousLine() {
  if (!activeReviewWord || !reviewJson) {
    return;
  }

  const currentLineIndex =
    reviewJson.lines.findIndex(function (line) {
      return Array.isArray(line.words) &&
        line.words.includes(activeReviewWord);
    });

  if (currentLineIndex === -1) {
    return;
  }

  if (currentLineIndex <= 0) {
    alert("This is the first line.");
    return;
  }

  const previousLine =
    reviewJson.lines[currentLineIndex - 1];

  if (
    !Array.isArray(previousLine.words) ||
    previousLine.words.length === 0
  ) {
    alert("The previous line contains no words.");
    return;
  }

  activeReviewWord =
    previousLine.words[0];

  openReviewModal(
    activeReviewWord.originalHebrew,
    activeReviewWord.hebrew
  );
}
function reviewNextLine() {
  if (!activeReviewWord || !reviewJson) {
    return;
  }

  const currentLineIndex =
    reviewJson.lines.findIndex(function (line) {
      return Array.isArray(line.words) &&
        line.words.includes(activeReviewWord);
    });

  if (currentLineIndex === -1) {
    return;
  }

  if (
    currentLineIndex >=
    reviewJson.lines.length - 1
  ) {
    alert("This is the last line.");
    return;
  }

  const nextLine =
    reviewJson.lines[currentLineIndex + 1];

  if (
    !Array.isArray(nextLine.words) ||
    nextLine.words.length === 0
  ) {
    alert("The next line contains no words.");
    return;
  }

  activeReviewWord = nextLine.words[0];

  openReviewModal(
    activeReviewWord.originalHebrew,
    activeReviewWord.hebrew
  );
}
function openReviewModal(originalText, currentText) {
  reviewModalWorkingHebrew =
    String(currentText || "");

  document.getElementById(
    "reviewOriginalWord"
  ).textContent = originalText;

  renderReviewCurrentWord(
    reviewModalWorkingHebrew
  );

  populateReviewCharacterPositions(
    reviewModalWorkingHebrew
  );

  document.getElementById(
    "reviewReplaceButton"
  ).disabled =
    document.getElementById(
      "reviewElementType"
    ).value !== "base";const reviewGraphemes =
  parseReviewGraphemes(currentText);

const detectedDiphthongs =
  detectReviewVowelCombinations(reviewGraphemes);

console.log(
  "Detected review diphthongs:",
  detectedDiphthongs
);  document.getElementById(
    "reviewModalOverlay"
  ).style.display = "flex";
if (activeReviewWord && activeReviewWord.id) {
  const match =
    activeReviewWord.id.match(/^L(\d+)W(\d+)$/);

  if (match) {
    populateReviewLineSelector();

document.getElementById(
  "reviewLineNumber"
).value =
  String(Number(match[1]) - 1);

    document.getElementById(
      "reviewWordNumber"
    ).textContent = match[2];
  }
}

}
/*
function discardReviewSessionChanges() {
  if (
    activeReviewWord &&
    reviewWordSessionOriginal !== null
  ) {
    activeReviewWord.hebrew =
      reviewWordSessionOriginal;
  }

  reviewWordSessionOriginal = null;
}
*/

function closeReviewModal() {
  /*
   * Nothing is copied into activeReviewWord.
   * Therefore all uncommitted modal edits
   * are discarded.
   */
  reviewModalWorkingHebrew = null;

  if (reviewJson) {
    displayExtractedHebrew(
      reviewJson
    );
  }

  document.getElementById(
    "reviewModalOverlay"
  ).style.display = "none";
}
function rebuildReviewWord(graphemes) {
  return graphemes
    .map(function(grapheme) {
      return (
        grapheme.base +
        grapheme.marks.join("")
      );
    })
    .join("");
}

function commitReviewChanges() {
  if (
    activeReviewWord &&
    reviewModalWorkingHebrew !== null
  ) {
    activeReviewWord.hebrew =
      reviewModalWorkingHebrew;

    activeReviewWord.reviewStatus =
      "modified";

    activeReviewWord.repair =
      true;
  }

  reviewModalWorkingHebrew = null;

  if (reviewJson) {
    displayExtractedHebrew(
      reviewJson
    );
  }

  document.getElementById(
    "reviewModalOverlay"
  ).style.display = "none";
}
function restoreReviewWord() {
  if (!activeReviewWord) {
    return;
  }

  activeReviewWord.hebrew =
    activeReviewWord.originalHebrew;

  activeReviewWord.reviewStatus =
    "unreviewed";

  activeReviewWord.repair =
    false;

  renderReviewCurrentWord(
    activeReviewWord.hebrew
  );

  populateReviewCharacterPositions(
    activeReviewWord.hebrew
  );

  document.getElementById(
    "reviewCharacterPosition"
  ).value = "";

  document.getElementById(
    "reviewExistingElement"
  ).innerHTML =
    '<option value="">Choose existing element</option>';

  document.getElementById(
    "reviewNewElement"
  ).value = "";
}
function replaceReviewElement() {
console.log("replaceReviewElement fired");
  const positionSelect =
    document.getElementById("reviewCharacterPosition");

  const elementTypeSelect =
    document.getElementById("reviewElementType");

  const existingSelect =
    document.getElementById("reviewExistingElement");

  const newElementSelect =
    document.getElementById("reviewNewElement");

  if (
    positionSelect.value === "" ||
    existingSelect.value === "" ||
    newElementSelect.value === ""
  ) {
    alert(
      "Please choose a character, existing element, and replacement."
    );
    return;
  }

  if (elementTypeSelect.value === "base") {
  replaceReviewBaseLetter();
  return;
}

  const currentWordElement =
    document.getElementById("reviewCurrentWord");

  const graphemes =
    parseReviewGraphemes(
      currentWordElement.textContent
    );

  const position =
    Number(positionSelect.value);

  const grapheme =
    graphemes[position];

  if (!grapheme) {
    return;
  }

  const replacements =
    getReviewReplacementElements();

  const replacement =
    replacements[
      Number(newElementSelect.value)
    ];

  if (!replacement) {
    return;
  }

  const selectedValue =
    String(existingSelect.value);

  if (selectedValue.startsWith("compound:")) {
    const parts =
      selectedValue.split(":");

    const startIndex =
      Number(parts[1]);

    const followingIndex =
      Number(parts[2]);

    const vowelCombinations =
      detectReviewVowelCombinations(
        graphemes
      );

    const compound =
      vowelCombinations.find(function(item) {
        return (
          item.startIndex === startIndex &&
          item.followingIndex ===
            followingIndex
        );
      });

    if (!compound) {
      return;
    }

    if (compound.mark !== null) {
      const markIndex =
        graphemes[startIndex]
          .marks
          .indexOf(compound.mark);

      if (markIndex !== -1) {
        graphemes[startIndex]
          .marks
          .splice(markIndex, 1);
      }
    }

    graphemes.splice(
      followingIndex,
      1
    );

  } else {
    const markIndex =
      Number(selectedValue);

    grapheme.marks.splice(
      markIndex,
      1
    );
  }

  applyReviewReplacementElement(
    graphemes,
    position,
    replacement
  );

  const updatedWord =
    rebuildReviewWord(graphemes);

  reviewModalWorkingHebrew =
  updatedWord;
  populateReviewCharacterPositions(
    updatedWord
  );

  populateReviewExistingElements();

document.getElementById(
  "reviewNewElement"
).value = "";

}

function addReviewVowelOrSymbol() {
  console.log("addReviewBaseLetter fired");
  const positionSelect =
    document.getElementById("reviewCharacterPosition");

  const newElementSelect =
    document.getElementById("reviewNewElement");

  if (
    positionSelect.value === "" ||
    newElementSelect.value === ""
  ) {
    alert(
      "Please choose a character and a vowel or symbol to add."
    );
    return;
  }

  const currentWordElement =
    document.getElementById("reviewCurrentWord");

  const graphemes =
    parseReviewGraphemes(
      currentWordElement.textContent
    );

  const baseIndex =
    Number(positionSelect.value);

  const baseGrapheme =
    graphemes[baseIndex];

  if (!baseGrapheme) {
    return;
  }

  const elements =
    getReviewReplacementElements();

  const newElement =
    elements[
      Number(newElementSelect.value)
    ];

  if (!newElement) {
    return;
  }

  const vowelMarks = new Set([
    "\u05B0",
    "\u05B1",
    "\u05B2",
    "\u05B3",
    "\u05B4",
    "\u05B5",
    "\u05B6",
    "\u05B7",
    "\u05B8",
    "\u05B9",
    "\u05BA",
    "\u05BB",
    "\u05C7"
  ]);

  const isVowelElement =
    newElement.kind === "compoundVowel" ||
    newElement.kind === "atomicVowel" ||
    (
      newElement.kind === "mark" &&
      vowelMarks.has(newElement.mark)
    );

  if (
    isVowelElement &&
    doesReviewBaseHaveVowel(
      graphemes,
      baseIndex
    )
  ) {
    alert(
      "This character already has a vowel. " +
      "Remove or replace the existing vowel first."
    );
    return;
  }

  /*
    Dagesh/Mappiq:
    do not add a duplicate on the same base.
  */
  if (
    newElement.kind === "mark" &&
    newElement.mark === "\u05BC" &&
    baseGrapheme.marks.includes("\u05BC")
  ) {
    alert(
      "This character already has a dagesh or mappiq."
    );
    return;
  }

  /*
    Atomic Shuruk/Holam Male on the first
    selectable base may be inserted before
    or after that base.
  */
  if (
    newElement.kind === "atomicVowel"
  ) {
    let insertIndex =
      baseIndex + 1;

    const atomicVowels =
      getReviewAssociatedAtomicVowels(
        graphemes,
        baseIndex
      );

    if (atomicVowels.length > 0) {
      alert(
        "This character already has an atomic vowel."
      );
      return;
    }

    let firstBaseIndex = -1;

    for (
      let index = 0;
      index < graphemes.length;
      index++
    ) {
      if (
        graphemes[index].base !== "\uFB35" &&
        graphemes[index].base !== "\uFB4B"
      ) {
        firstBaseIndex = index;
        break;
      }
    }

    if (baseIndex === firstBaseIndex) {
      const insertBefore =
        confirm(
          "Insert this vowel before the first base letter?\n\n" +
          "Click OK for before or Cancel for after."
        );

      if (insertBefore) {
        insertIndex = baseIndex;
      }
    }

    graphemes.splice(
      insertIndex,
      0,
      {
        base: newElement.base,
        marks: []
      }
    );

  } else {
    applyReviewReplacementElement(
      graphemes,
      baseIndex,
      newElement
    );
  }

  const updatedWord =
    rebuildReviewWord(graphemes);

  reviewModalWorkingHebrew =
  updatedWord;
  renderReviewCurrentWord(
    updatedWord
  );

  populateReviewCharacterPositions(
    updatedWord
  );

  document.getElementById(
    "reviewExistingElement"
  ).innerHTML =
    '<option value="">Choose existing element</option>';

  document.getElementById(
    "reviewNewElement"
  ).value = "";
}

function addReviewBaseLetter() {
  const positionSelect =
    document.getElementById("reviewCharacterPosition");

  const elementTypeSelect =
    document.getElementById("reviewElementType");

  const newElementSelect =
    document.getElementById("reviewNewElement");

  if (
    positionSelect.value === "" ||
    newElementSelect.value === ""
  ) {
    alert(
      "Please choose a character and a new element."
    );
    return;
  }

  /*
   * Route Vowel and Trope to their own
   * Add handlers before running any
   * base-letter-specific logic.
   */
  if (elementTypeSelect.value === "mark") {
    addReviewVowelOrSymbol();
    return;
  }

  if (elementTypeSelect.value === "trope") {
    addReviewTrope();
    return;
  }

  /*
   * Everything below here is Base Letter only.
   */

  const currentWordElement =
    document.getElementById("reviewCurrentWord");

  const graphemes =
    parseReviewGraphemes(
      currentWordElement.textContent
    );

  const selectedIndex =
    Number(positionSelect.value);

  const selectedGrapheme =
    graphemes[selectedIndex];

  if (!selectedGrapheme) {
    return;
  }

  const baseLetters =
    getReviewBaseLetterElements();

  let newLetter =
    baseLetters[
      Number(newElementSelect.value)
    ];

  if (!newLetter) {
    return;
  }

  /*
   * Determine where "after the selected base"
   * really is. Skip vowel structures belonging
   * to the selected base.
   */
  let insertIndex =
    selectedIndex + 1;

  const vowelCombinations =
    detectReviewVowelCombinations(graphemes);

  const compound =
    vowelCombinations.find(function(item) {
      return item.startIndex === selectedIndex;
    });

  if (compound) {
    insertIndex =
      compound.followingIndex + 1;
  }

  /*
   * Skip an atomic Shuruk or Holam Male
   * immediately following the selected base.
   */
  if (
    graphemes[selectedIndex + 1] &&
    (
      graphemes[selectedIndex + 1].base === "\uFB35" ||
      graphemes[selectedIndex + 1].base === "\uFB4B"
    )
  ) {
    insertIndex =
      selectedIndex + 2;

    const atomicCompound =
      vowelCombinations.find(function(item) {
        return (
          item.startIndex ===
          selectedIndex + 1
        );
      });

    if (atomicCompound) {
      insertIndex =
        atomicCompound.followingIndex + 1;
    }
  }

  /*
   * If the first selectable base is selected,
   * allow insertion before it.
   */
  if (selectedIndex === 0) {
    const insertBefore =
      confirm(
        "Insert the new letter before the first character?\n\n" +
        "Click OK for before or Cancel for after."
      );

    if (insertBefore) {
      insertIndex = 0;
    }
  }

  /*
   * Do not insert another letter after an
   * existing final-form letter.
   */
  const finalBases = [
    "\u05DA", // ך
    "\u05DD", // ם
    "\u05DF", // ן
    "\u05E3", // ף
    "\u05E5"  // ץ
  ];

  if (
    insertIndex > selectedIndex &&
    finalBases.includes(
      selectedGrapheme.base
    )
  ) {
    alert(
      "A letter cannot be inserted after a final-form letter."
    );
    return;
  }

  /*
   * A newly selected final form may only
   * be inserted at the end of the word.
   */
  if (
    newLetter.final &&
    insertIndex < graphemes.length
  ) {
    const useNormal =
      confirm(
        newLetter.name +
        " cannot be inserted at this position.\n\n" +
        "Insert the normal form instead?"
      );

    if (!useNormal) {
      return;
    }

    newLetter = {
      name: newLetter.name,
      base: newLetter.normalBase
    };
  }

  graphemes.splice(
    insertIndex,
    0,
    {
      base: newLetter.base,
      marks: []
    }
  );

  const updatedWord =
    rebuildReviewWord(graphemes);

  reviewModalWorkingHebrew =
  updatedWord;
  renderReviewCurrentWord(
    updatedWord
  );

  populateReviewCharacterPositions(
    updatedWord
  );

  document.getElementById(
    "reviewExistingElement"
  ).innerHTML =
    '<option value="">Choose existing element</option>';

  document.getElementById(
    "reviewNewElement"
  ).value = "";
}
function addReviewTrope() {
  const positionSelect =
    document.getElementById(
      "reviewCharacterPosition"
    );

  const newElementSelect =
    document.getElementById(
      "reviewNewElement"
    );

  if (
    positionSelect.value === "" ||
    newElementSelect.value === ""
  ) {
    alert(
      "Please choose a character and a trope."
    );
    return;
  }

  const currentWordElement =
    document.getElementById(
      "reviewCurrentWord"
    );

  const graphemes =
    parseReviewGraphemes(
      currentWordElement.textContent
    );

  const selectedIndex =
    Number(positionSelect.value);

  const grapheme =
    graphemes[selectedIndex];

  if (!grapheme) {
    return;
  }

  const tropeElements =
    getReviewTropeElements();

  const selectedTrope =
    tropeElements[
      Number(newElementSelect.value)
    ];

  if (!selectedTrope) {
    return;
  }

  /*
   * Check ONLY for an existing trope.
   *
   * An ordinary vowel, dagesh, meteg, etc.
   * does not prevent adding trope.
   */
  const existingTrope =
    grapheme.marks.some(function(mark) {
      const codePoint =
        mark.codePointAt(0);

      return (
        codePoint >= 0x0591 &&
        codePoint <= 0x05AF
      );
    });

  if (existingTrope) {
    alert(
      "A trope is already present on this character."
    );
    return;
  }

  grapheme.marks.push(
    selectedTrope.mark
  );

  const updatedWord =
    rebuildReviewWord(
      graphemes
    );

  reviewModalWorkingHebrew =
  updatedWord;
  renderReviewCurrentWord(
    updatedWord
  );

  populateReviewCharacterPositions(
    updatedWord
  );

  /*
   * Restore the same selected character.
   */
  document.getElementById(
    "reviewCharacterPosition"
  ).value =
    String(selectedIndex);

  populateReviewExistingElements();
  populateReviewNewElementOptions();

  document.getElementById(
    "reviewNewElement"
  ).value = "";
}
function removeReviewElement() {
  console.log("removeReviewElement fired");
  const positionSelect =
    document.getElementById("reviewCharacterPosition");

  const elementTypeSelect =
    document.getElementById("reviewElementType");

  const existingSelect =
    document.getElementById("reviewExistingElement");

  if (
    positionSelect.value === "" ||
    existingSelect.value === ""
  ) {
    alert("Please choose a character and an existing element.");
    return;
  }

  const currentWordElement =
    document.getElementById("reviewCurrentWord");

  const graphemes =
    parseReviewGraphemes(currentWordElement.textContent);

  let position =
  Number(positionSelect.value);

  const grapheme =
    graphemes[position];

  if (!grapheme) {
    return;
  }

  if (elementTypeSelect.value === "base") {
  const vowelCombinations =
    detectReviewVowelCombinations(graphemes);

  const compound =
    vowelCombinations.find(function(item) {
      return item.startIndex === position;
    });

  if (compound) {
    graphemes.splice(
      compound.followingIndex,
      1
    );
  }
const atomicVowelIndexes =
  getReviewAssociatedAtomicVowels(
    graphemes,
    position
  );

atomicVowelIndexes
  .sort(function(a, b) {
    return b - a;
  })
  .forEach(function(index) {
    graphemes.splice(index, 1);

    if (index < position) {
      position--;
    }
  });
  graphemes.splice(position, 1);
  } else {
  const selectedValue =
    String(existingSelect.value);

 if (selectedValue.startsWith("atomic:")) {
  const parts =
    selectedValue.split(":");

  const atomicIndex =
    Number(parts[1]);

  if (
    Number.isInteger(atomicIndex) &&
    graphemes[atomicIndex]
  ) {
    graphemes.splice(
      atomicIndex,
      1
    );
  }

} else if (
  selectedValue.startsWith("compound:")
) {
    const parts =
      selectedValue.split(":");

    const startIndex =
      Number(parts[1]);

    const followingIndex =
      Number(parts[2]);

    const vowelCombinations =
      detectReviewVowelCombinations(graphemes);

    const compound =
      vowelCombinations.find(function(item) {
        return (
          item.startIndex === startIndex &&
          item.followingIndex === followingIndex
        );
      });

    if (!compound) {
      return;
    }

    if (compound.mark !== null) {
      const markIndex =
        graphemes[startIndex].marks.indexOf(
          compound.mark
        );

      if (markIndex !== -1) {
        graphemes[startIndex].marks.splice(
          markIndex,
          1
        );
      }
    }

    graphemes.splice(followingIndex, 1);

  } else {
    const markIndex =
      Number(selectedValue);

    grapheme.marks.splice(markIndex, 1);
  }
}

  const updatedWord =
    rebuildReviewWord(graphemes);

  renderReviewCurrentWord(updatedWord);

reviewModalWorkingHebrew =
  updatedWord;

renderReviewCurrentWord(
  reviewModalWorkingHebrew
);

populateReviewCharacterPositions(
  reviewModalWorkingHebrew
);

populateReviewExistingElements();}


window.addEventListener(
  "load",
  function () {

    document.getElementById(
      "reviewNextWordButton"
    ).addEventListener(
      "click",
      reviewNextWord
    );
enableTransliterationEditing.addEventListener(
  "change",
  function () {
    if (this.checked) {
      transliterationSummary.readOnly = false;

      commitTransliterationEditsButton.disabled =
        false;

      alert(
        "Editing is enabled.\n\n" +
        "You may add, delete, replace, cut, copy, and paste " +
        "characters within a line.\n\n" +
        "Line breaks are fixed and cannot be added, removed, " +
        "cut, or pasted."
      );

      transliterationSummary.focus();
    } else {
      transliterationSummary.readOnly = true;

      commitTransliterationEditsButton.disabled =
        true;
    }
  }
);
    document.getElementById(
      "reviewLineNumber"
    ).addEventListener(
      "change",
      reviewJumpToLine
    );
transliterationSummary.addEventListener(
  "keydown",
  function (event) {
    if (this.readOnly) return;

    // Do not allow new line breaks.
    if (event.key === "Enter") {
      event.preventDefault();
      alert("Line breaks cannot be added.");
      return;
    }

    const start = this.selectionStart;
    const end = this.selectionEnd;
    const value = this.value;

    // If selected text contains a line break,
    // Backspace/Delete would remove structure.
    if (
      (event.key === "Backspace" ||
       event.key === "Delete") &&
      start !== end
    ) {
      const selectedText =
        value.substring(start, end);

      if (/[\r\n]/.test(selectedText)) {
        event.preventDefault();
        alert("Line breaks cannot be removed.");
        return;
      }
    }

    // Backspace immediately after a newline.
    if (
      event.key === "Backspace" &&
      start === end &&
      start > 0 &&
      value[start - 1] === "\n"
    ) {
      event.preventDefault();
      alert("Line breaks cannot be removed.");
      return;
    }

    // Delete immediately before a newline.
    if (
      event.key === "Delete" &&
      start === end &&
      value[start] === "\n"
    ) {
      event.preventDefault();
      alert("Line breaks cannot be removed.");
    }
  }
);
commitTransliterationEditsButton.addEventListener(
  "click",
  commitTransliterationEdits
);

transliterationSummary.addEventListener(
  "paste",
  function (event) {
    if (this.readOnly) return;

    const pastedText =
      event.clipboardData.getData("text");

    if (/[\r\n]/.test(pastedText)) {
      event.preventDefault();

      alert(
        "The pasted text contains one or more line breaks.\n\n" +
        "Paste is allowed only for text that does not " +
        "change the existing line structure."
      );
    }
  }
);

transliterationSummary.addEventListener(
  "cut",
  function (event) {
    if (this.readOnly) return;

    const selectedText =
      this.value.substring(
        this.selectionStart,
        this.selectionEnd
      );

    if (/[\r\n]/.test(selectedText)) {
      event.preventDefault();

      alert(
        "The selected text contains a line break.\n\n" +
        "It cannot be cut because line structure " +
        "must remain unchanged."
      );
    }
  }
);

    document.getElementById(
      "linePunctuationModalCloseX"
    ).addEventListener(
      "click",
      closeLinePunctuationModal
    );

    document.getElementById(
      "linePunctuationAddButton"
    ).addEventListener(
      "click",
      addLinePunctuation
    );

    document.getElementById(
      "linePunctuationReplaceButton"
    ).addEventListener(
      "click",
      replaceLinePunctuation
    );

    document.getElementById(
      "linePunctuationRemoveButton"
    ).addEventListener(
      "click",
      removeLinePunctuation
    );

    document.getElementById(
      "linePunctuationRestoreButton"
    ).addEventListener(
      "click",
      restoreLinePunctuation
    );

    document.getElementById(
      "linePunctuationCommitButton"
    ).addEventListener(
      "click",
      commitLinePunctuationChanges
    );

    document.getElementById(
      "linePunctuationModalCloseButton"
    ).addEventListener(
      "click",
      closeLinePunctuationModal
    );

    document.getElementById(
      "reviewAddMetegButton"
    ).addEventListener(
      "click",
      addReviewMeteg
    );

    document.getElementById(
      "reviewAddButton"
    ).addEventListener(
      "click",
      addReviewBaseLetter
    );

    document.getElementById(
      "reviewCommitButton"
    ).addEventListener(
      "click",
      commitReviewChanges
    );

    document.getElementById(
      "reviewReplaceButton"
    ).addEventListener(
      "click",
      replaceReviewElement
    );

    document.getElementById(
      "reviewRestoreButton"
    ).addEventListener(
      "click",
      restoreReviewWord
    );

    document.getElementById(
      "reviewPreviousLineButton"
    ).addEventListener(
      "click",
      reviewPreviousLine
    );

    document.getElementById(
      "reviewPreviousWordButton"
    ).addEventListener(
      "click",
      reviewPreviousWord
    );

    document.getElementById(
      "reviewCharacterPosition"
    ).addEventListener(
      "change",
      function () {
        populateReviewExistingElements();
        populateReviewNewElementOptions();
      }
    );

    document.getElementById(
      "reviewNextLineButton"
    ).addEventListener(
      "click",
      reviewNextLine
    );

    document.getElementById(
      "reviewRemoveButton"
    ).addEventListener(
      "click",
      removeReviewElement
    );

    document.getElementById(
      "reviewElementType"
    ).addEventListener(
      "change",
      function () {
        populateReviewExistingElements();
        populateReviewNewElementOptions();

        const replaceButton =
          document.getElementById(
            "reviewReplaceButton"
          );

        replaceButton.disabled =
          this.value !== "base";
      }
    );

    document.getElementById(
      "reviewModalCloseX"
    ).onclick =
      closeReviewModal;

    document.getElementById(
      "reviewModalCloseButton"
    ).onclick =
      closeReviewModal;


    /*
     * =========================================
     * LINE STRUCTURE REVIEW CONTROLS
     * =========================================
     */

    const lineStructureNumber =
      document.getElementById(
        "lineStructureNumber"
      );

    const mergeFollowingLineButton =
      document.getElementById(
        "mergeFollowingLineButton"
      );

    const duplicateLineButton =
      document.getElementById(
        "duplicateLineButton"
      );

    const deleteLineButton =
      document.getElementById(
        "deleteLineButton"
      );

    const restoreAllLinesButton =
      document.getElementById(
        "restoreAllLinesButton"
      );

    if (
      lineStructureNumber &&
      mergeFollowingLineButton &&
      duplicateLineButton &&
      deleteLineButton &&
      restoreAllLinesButton
    ) {
      lineStructureNumber.addEventListener(
        "input",
        refreshLineStructureControls
      );

      lineStructureNumber.addEventListener(
        "change",
        refreshLineStructureControls
      );

      mergeFollowingLineButton.addEventListener(
        "click",
        mergeReviewLineWithFollowing
      );

      duplicateLineButton.addEventListener(
        "click",
        duplicateReviewLine
      );

      deleteLineButton.addEventListener(
        "click",
        deleteReviewLine
      );

      restoreAllLinesButton.addEventListener(
        "click",
        restoreAllOriginalReviewLines
      );

      refreshLineStructureControls();

      console.log(
        "Line structure review controls ready."
      );
    } else {
      console.error(
        "Line structure review controls were not found."
      );
    }


    populateReviewNewElementOptions();

    // Temporary test
    // openReviewModal("אָֽנֹכִי", "אָֽנֹכִי");

  }
);
function renderReviewCurrentWord(currentText) {
  const currentWordElement =
    document.getElementById("reviewCurrentWord");

  currentWordElement.innerHTML = "";

  const graphemes =
    parseReviewGraphemes(currentText);

  const diphthongs =
    detectReviewVowelCombinations(graphemes);

  const dependentIndexes =
    new Set(
      diphthongs.map(function(item) {
        return item.followingIndex;
      })
    );

  graphemes.forEach(function(grapheme, index) {
    const span =
      document.createElement("span");

    span.textContent =
      grapheme.base +
      grapheme.marks.join("");

    if (dependentIndexes.has(index)) {
      span.style.color = "red";
    }

    currentWordElement.appendChild(span);
  });
}
function getReviewBaseLetterElements() {
  return [
    { name: "Aleph", base: "\u05D0" },
    { name: "Bet", base: "\u05D1" },
    { name: "Gimel", base: "\u05D2" },
    { name: "Dalet", base: "\u05D3" },
    { name: "He", base: "\u05D4" },
    { name: "Vav", base: "\u05D5" },
    { name: "Zayin", base: "\u05D6" },
    { name: "Het", base: "\u05D7" },
    { name: "Tet", base: "\u05D8" },
    { name: "Yod", base: "\u05D9" },
    { name: "Kaf", base: "\u05DB" },
    { name: "Final Kaf", base: "\u05DA", final: true, normalBase: "\u05DB" },
    { name: "Lamed", base: "\u05DC" },
    { name: "Mem", base: "\u05DE" },
    { name: "Final Mem", base: "\u05DD", final: true, normalBase: "\u05DE" },
    { name: "Nun", base: "\u05E0" },
    { name: "Final Nun", base: "\u05DF", final: true, normalBase: "\u05E0" },
    { name: "Samekh", base: "\u05E1" },
    { name: "Ayin", base: "\u05E2" },
    { name: "Pe", base: "\u05E4" },
    { name: "Final Pe", base: "\u05E3", final: true, normalBase: "\u05E4" },
    { name: "Tsadi", base: "\u05E6" },
    { name: "Final Tsadi", base: "\u05E5", final: true, normalBase: "\u05E6" },
    { name: "Qof", base: "\u05E7" },
    { name: "Resh", base: "\u05E8" },

    // Plain U+05E9 Shin is intentionally excluded.
    { name: "Shin", base: "\uFB2A" },
    { name: "Sin", base: "\uFB2B" },

    { name: "Tav", base: "\u05EA" }
  ];
}
function getReviewTropeElements() {
  return [
    {
      name: "Etnahta",
      kind: "trope",
      mark: "\u0591"
    },
    {
      name: "Segol",
      kind: "trope",
      mark: "\u0592"
    },
    {
      name: "Shalshelet",
      kind: "trope",
      mark: "\u0593"
    },
    {
      name: "Zaqef Qatan",
      kind: "trope",
      mark: "\u0594"
    },
    {
      name: "Zaqef Gadol",
      kind: "trope",
      mark: "\u0595"
    },
    {
      name: "Tipcha",
      kind: "trope",
      mark: "\u0596"
    },
    {
      name: "Revia",
      kind: "trope",
      mark: "\u0597"
    },
    {
      name: "Zarqa",
      kind: "trope",
      mark: "\u0598"
    },
    {
      name: "Pashta",
      kind: "trope",
      mark: "\u0599",
      placement: "postpositive"
    },
    {
      name: "Yetiv",
      kind: "trope",
      mark: "\u059A"
    },
    {
      name: "Tevir",
      kind: "trope",
      mark: "\u059B"
    },
    {
      name: "Geresh",
      kind: "trope",
      mark: "\u059C"
    },
    {
      name: "Geresh Muqdam",
      kind: "trope",
      mark: "\u059D"
    },
    {
      name: "Gershayim",
      kind: "trope",
      mark: "\u059E"
    },
    {
      name: "Qarne Farah",
      kind: "trope",
      mark: "\u059F"
    },
    {
      name: "Telisha Gedolah",
      kind: "trope",
      mark: "\u05A0",
      placement: "prepositive"
    },
    {
      name: "Pazer",
      kind: "trope",
      mark: "\u05A1"
    },
    {
      name: "Munach",
      kind: "trope",
      mark: "\u05A3"
    },
    {
      name: "Mahapach",
      kind: "trope",
      mark: "\u05A4"
    },
    {
      name: "Mercha",
      kind: "trope",
      mark: "\u05A5"
    },
    {
      name: "Mercha Kefulah",
      kind: "trope",
      mark: "\u05A6"
    },
    {
      name: "Darga",
      kind: "trope",
      mark: "\u05A7"
    },
    {
      name: "Kadma",
      kind: "trope",
      mark: "\u05A8"
    },
    {
      name: "Telisha Ketanah",
      kind: "trope",
      mark: "\u05A9",
      placement: "postpositive"
    },
    {
      name: "Yerach Ben Yomo",
      kind: "trope",
      mark: "\u05AA"
    }
  ];
}
function getReviewReplacementElements() {
  return [
    {
      name: "Sh'va",
      kind: "mark",
      mark: "\u05B0"
    },
    {
      name: "Hataf Segol",
      kind: "mark",
      mark: "\u05B1"
    },
    {
      name: "Hataf Patach",
      kind: "mark",
      mark: "\u05B2"
    },
    {
      name: "Hataf Qamatz",
      kind: "mark",
      mark: "\u05B3"
    },
    {
      name: "Hiriq",
      kind: "mark",
      mark: "\u05B4"
    },
    {
      name: "Tzere",
      kind: "mark",
      mark: "\u05B5"
    },
    {
      name: "Segol",
      kind: "mark",
      mark: "\u05B6"
    },
    {
      name: "Patach",
      kind: "mark",
      mark: "\u05B7"
    },
    {
      name: "Qamatz",
      kind: "mark",
      mark: "\u05B8"
    },
    {
      name: "Holam",
      kind: "mark",
      mark: "\u05B9"
    },
    {
      name: "Qubutz",
      kind: "mark",
      mark: "\u05BB"
    },
    {
      name: "Qamatz Qatan",
      kind: "mark",
      mark: "\u05C7"
    },
{
  name: "Dagesh or Mappiq",
  kind: "mark",
  mark: "\u05BC"
},
{
  name: "Meteg or Silluq",
  kind: "mark",
  mark: "\u05BD"
},
    {
      name: "Hiriq + Yod",
      kind: "compoundVowel",
      mark: "\u05B4",
      followingBase: "\u05D9"
    },
    {
      name: "Tzere + Yod",
      kind: "compoundVowel",
      mark: "\u05B5",
      followingBase: "\u05D9"
    },
    {
      name: "Segol + Yod",
      kind: "compoundVowel",
      mark: "\u05B6",
      followingBase: "\u05D9"
    },
    {
      name: "Patach + Yod",
      kind: "compoundVowel",
      mark: "\u05B7",
      followingBase: "\u05D9"
    },
    {
      name: "Qamatz + Yod",
      kind: "compoundVowel",
      mark: "\u05B8",
      followingBase: "\u05D9"
    },
    {
      name: "Holam + Yod",
      kind: "compoundVowel",
      mark: "\u05B9",
      followingBase: "\u05D9"
    },
    {
      name: "Qubutz + Yod",
      kind: "compoundVowel",
      mark: "\u05BB",
      followingBase: "\u05D9"
    },

       {
      name: "Shuruk",
      kind: "atomicVowel",
      base: "\uFB35"
    },
    {
      name: "Holam Male",
      kind: "atomicVowel",
      base: "\uFB4B"
    }
  ];
}
function populateReviewNewElementOptions() {
  const newElementSelect =
    document.getElementById("reviewNewElement");

  const positionSelect =
    document.getElementById("reviewCharacterPosition");

  newElementSelect.innerHTML =
    '<option value="">Choose replacement or new element</option>';

  if (positionSelect.value === "") {
    return;
  }

  const currentText =
    document.getElementById(
      "reviewCurrentWord"
    ).textContent;

  const graphemes =
    parseReviewGraphemes(currentText);

  const baseIndex =
    Number(positionSelect.value);

  const baseGrapheme =
    graphemes[baseIndex];

  if (!baseGrapheme) {
    return;
  }

  const previewBase =
    baseGrapheme.base;

  const elementTypeSelect =
    document.getElementById("reviewElementType");

  let elements;

if (elementTypeSelect.value === "base") {
  elements =
    getReviewBaseLetterElements();

} else if (
  elementTypeSelect.value === "trope"
) {
  elements =
    getReviewTropeElements();

} else {
  elements =
    getReviewReplacementElements();
}

  const nbsp = "\u00A0";
  const rtlMark = "\u200F";
  const ltrMark = "\u200E";

  elements.forEach(function(element, index) {
    const option =
      document.createElement("option");

    option.value = String(index);

    let symbol = "";

    if (elementTypeSelect.value === "base") {
      symbol =
        element.base;
    } else {
      if (element.kind === "mark") {
        symbol =
          previewBase +
          element.mark;
      }
if (element.kind === "trope") {
  symbol =
    previewBase +
    element.mark;
}
      if (element.kind === "compoundVowel") {
        symbol =
          previewBase +
          element.mark +
          element.followingBase;
      }

      if (element.kind === "atomicVowel") {
        symbol =
          previewBase +
          element.base;
      }
    }

    option.textContent =
      rtlMark +
      symbol +
      ltrMark +
      nbsp +
      nbsp +
      nbsp +
      "—" +
      nbsp +
      element.name;

    option.style.fontFamily =
      '"Times New Roman", Times, serif';

    option.style.fontSize =
      "14pt";

    option.style.fontWeight =
      "bold";

    newElementSelect.appendChild(option);
  });
}
function applyReviewReplacementElement(
  graphemes,
  baseIndex,
  replacement
) {
  const baseGrapheme =
    graphemes[baseIndex];

  if (!baseGrapheme || !replacement) {
    return;
  }

  if (replacement.kind === "mark") {
    baseGrapheme.marks.push(
      replacement.mark
    );

    return;
  }

  if (
    replacement.kind ===
    "compoundVowel"
  ) {
    baseGrapheme.marks.push(
      replacement.mark
    );

    graphemes.splice(
      baseIndex + 1,
      0,
      {
        base:
          replacement.followingBase,
        marks: []
      }
    );

    return;
  }

  if (
    replacement.kind ===
    "atomicVowel"
  ) {
    graphemes.splice(
      baseIndex + 1,
      0,
      {
        base: replacement.base,
        marks: []
      }
    );
  }
}

function replaceReviewBaseLetter() {
  const positionSelect =
    document.getElementById("reviewCharacterPosition");

  const newElementSelect =
    document.getElementById("reviewNewElement");


  if (
    positionSelect.value === "" ||
    newElementSelect.value === ""
  ) {
    alert(
      "Please choose a character and a replacement base letter."
    );
    return;
  }

  const currentWordElement =
    document.getElementById("reviewCurrentWord");

  const graphemes =
    parseReviewGraphemes(
      currentWordElement.textContent
    );

  const position =
    Number(positionSelect.value);

  const selectedGrapheme =
    graphemes[position];

  if (!selectedGrapheme) {
    return;
  }

  const baseLetters =
    getReviewBaseLetterElements();

  let replacement =
    baseLetters[
      Number(newElementSelect.value)
    ];

  if (!replacement) {
    return;
  }

  /*
    If replacing with a final form,
    it may only be used at the final
    logical base position.
  */
  const isFinalPosition =
    position === graphemes.length - 1;

  if (
    replacement.final &&
    !isFinalPosition
  ) {
    const useNormal =
      confirm(
        replacement.name +
        " cannot be used at this position.\n\n" +
        "Use the normal form instead?"
      );

    if (!useNormal) {
      return;
    }

    replacement = {
      name: replacement.name,
      base: replacement.normalBase
    };
  }

  /*
    Remove any detected compound
    vowel dependent on this base.
  */
  const vowelCombinations =
    detectReviewVowelCombinations(graphemes);

  const compound =
    vowelCombinations.find(function(item) {
      return item.startIndex === position;
    });

  if (compound) {
    graphemes.splice(
      compound.followingIndex,
      1
    );
  }

 const atomicVowelIndexes =
  getReviewAssociatedAtomicVowels(
    graphemes,
    position
  );

let adjustedPosition =
  position;

atomicVowelIndexes
  .sort(function(a, b) {
    return b - a;
  })
  .forEach(function(index) {
    graphemes.splice(index, 1);

    if (index < adjustedPosition) {
      adjustedPosition--;
    }
  });

  /*
    Replace the selected base with
    a clean, unmarked base letter.
  */
 graphemes[adjustedPosition] = {
  base: replacement.base,
  marks: []
};

  const updatedWord =
    rebuildReviewWord(graphemes);

  reviewModalWorkingHebrew =
  updatedWord;
  renderReviewCurrentWord(
    updatedWord
  );

  populateReviewCharacterPositions(
    updatedWord
  );

  document.getElementById(
    "reviewExistingElement"
  ).innerHTML =
    '<option value="">Choose existing element</option>';

  document.getElementById(
    "reviewNewElement"
  ).value = "";
}
function normalizeReviewUnicode(text) {
  return String(text || "")
    .replace(/\u05E9\u05C1/g, "\uFB2A")
    .replace(/\u05E9\u05C2/g, "\uFB2B")
    .replace(/\u05D5\u05B9/g, "\uFB4B")
    .replace(/\u05D5\u05BC/g, "\uFB35");
}
function getReviewAssociatedAtomicVowels(
  graphemes,
  baseIndex
) {
  const indexes = [];

  const isAtomicVowel = function(grapheme) {
    return (
      grapheme &&
      (
        grapheme.base === "\uFB35" || // Shuruk
        grapheme.base === "\uFB4B"    // Holam Male
      )
    );
  };

  // Normal case:
  // atomic vowel immediately following the base.
  if (
    isAtomicVowel(
      graphemes[baseIndex + 1]
    )
  ) {
    indexes.push(baseIndex + 1);
  }

  /*
    Special leading case:
    if this is the first actual consonantal base
    in the word, allow an atomic vowel immediately
    before it to belong to this base.
  */
  let firstBaseIndex = -1;

  for (
    let index = 0;
    index < graphemes.length;
    index++
  ) {
    if (!isAtomicVowel(graphemes[index])) {
      firstBaseIndex = index;
      break;
    }
  }

  if (
    baseIndex === firstBaseIndex &&
    isAtomicVowel(
      graphemes[baseIndex - 1]
    )
  ) {
    indexes.push(baseIndex - 1);
  }

  return indexes;
}
function doesReviewBaseHaveVowel(
  graphemes,
  baseIndex
) {
  const grapheme =
    graphemes[baseIndex];

  if (!grapheme) {
    return false;
  }

  const vowelMarks = new Set([
    "\u05B0", // Sh'va
    "\u05B1", // Hataf Segol
    "\u05B2", // Hataf Patach
    "\u05B3", // Hataf Qamatz
    "\u05B4", // Hiriq
    "\u05B5", // Tzere
    "\u05B6", // Segol
    "\u05B7", // Patach
    "\u05B8", // Qamatz
    "\u05B9", // Holam
    "\u05BA", // Holam Haser for Vav
    "\u05BB", // Qubutz
    "\u05C7"  // Qamatz Qatan
  ]);

  const hasSimpleVowel =
    grapheme.marks.some(function(mark) {
      return vowelMarks.has(mark);
    });

  if (hasSimpleVowel) {
    return true;
  }

  const vowelCombinations =
    detectReviewVowelCombinations(
      graphemes
    );

  const hasCompound =
    vowelCombinations.some(function(item) {
      return item.startIndex === baseIndex;
    });

  if (hasCompound) {
    return true;
  }

  const atomicVowels =
    getReviewAssociatedAtomicVowels(
      graphemes,
      baseIndex
    );

  return atomicVowels.length > 0;
}
function populateReviewLineSelector() {
  const lineSelect =
    document.getElementById("reviewLineNumber");

  lineSelect.innerHTML = "";

  if (
    !reviewJson ||
    !Array.isArray(reviewJson.lines)
  ) {
    return;
  }

  reviewJson.lines.forEach(function(line, index) {
    const option =
      document.createElement("option");

    option.value = index;

    option.textContent =
      String(index + 1);

    lineSelect.appendChild(option);
  });
}

function reviewJumpToLine() {
  if (
    !reviewJson ||
    !Array.isArray(reviewJson.lines)
  ) {
    return;
  }

  const lineSelect =
    document.getElementById("reviewLineNumber");

  const lineIndex =
    Number(lineSelect.value);

  const targetLine =
    reviewJson.lines[lineIndex];

  if (
    !targetLine ||
    !Array.isArray(targetLine.words) ||
    targetLine.words.length === 0
  ) {
    alert(
      "The selected line contains no words."
    );
    return;
  }

  activeReviewWord =
    targetLine.words[0];

  openReviewModal(
    activeReviewWord.originalHebrew,
    activeReviewWord.hebrew
  );
}
function addReviewMeteg() {
  const positionSelect =
    document.getElementById(
      "reviewCharacterPosition"
    );

  if (positionSelect.value === "") {
    alert(
      "Please choose a character first."
    );
    return;
  }

  const currentWordElement =
    document.getElementById(
      "reviewCurrentWord"
    );

  const graphemes =
    parseReviewGraphemes(
      currentWordElement.textContent
    );

  const position =
    Number(positionSelect.value);

  const grapheme =
    graphemes[position];

  if (!grapheme) {
    return;
  }

  /*
   * Do not add a duplicate Meteg/Silluq
   * to the same selected base.
   *
   * We intentionally do NOT check
   * whether another character in the
   * word already contains a Meteg.
   */
  if (
    grapheme.marks.includes(
      "\u05BD"
    )
  ) {
    alert(
      "This character already contains a Meteg/Silluq."
    );
    return;
  }

  grapheme.marks.push(
    "\u05BD"
  );

  const updatedWord =
    rebuildReviewWord(
      graphemes
    );

  reviewModalWorkingHebrew =
  updatedWord;
  renderReviewCurrentWord(
    updatedWord
  );

  populateReviewCharacterPositions(
    updatedWord
  );

  /*
   * Keep the same selected base
   * when possible so repeated review
   * remains convenient.
   */
  if (
    position <
    parseReviewGraphemes(
      updatedWord
    ).length
  ) {
    document.getElementById(
      "reviewCharacterPosition"
    ).value =
      String(position);
  }

  populateReviewExistingElements();
  populateReviewNewElementOptions();
}
function buildReviewLineText(line) {
  const words =
    Array.isArray(line.words)
      ? line.words
      : [];

  const gaps =
    Array.isArray(line.gaps)
      ? line.gaps
      : [];

  let text =
    gaps[0]
      ? String(gaps[0].punctuation || "")
      : "";

  words.forEach(function(word, index) {
    text +=
      String(word.hebrew || "");

    const gap =
      gaps[index + 1];

    if (gap) {
      text +=
        String(gap.punctuation || "");
    }

    if (index < words.length - 1) {
      text += " ";
    }
  });

  return text;
}
function openLinePunctuationModal(line) {
  if (
    !line ||
    !Array.isArray(line.words) ||
    !Array.isArray(line.gaps)
  ) {
    return;
  }

  activeReviewLine = line;
  selectedReviewGapId = null;
document.getElementById(
  "linePunctuationSelectedGap"
).textContent = "None";

document.getElementById(
  "linePunctuationCurrent"
).textContent = "None";

document.getElementById(
  "linePunctuationNew"
).value = "";
  /*
   * Make a temporary working copy.
   * Nothing in reviewJson changes until
   * the future line-level Commit action.
   */
  reviewLineWorkingGaps =
    line.gaps.map(function(gap) {
      return {
        id: gap.id,

        punctuation:
          String(
            gap.punctuation || ""
          ),

        originalPunctuation:
          String(
            gap.originalPunctuation || ""
          )
      };
    });

  const display =
    document.getElementById(
      "linePunctuationDisplay"
    );

  display.innerHTML = "";

  const gaps =
    reviewLineWorkingGaps;

  /*
   * Gap 0 occurs before the first word.
   */
  if (gaps[0]) {
    const gapSpan =
      document.createElement("span");

    gapSpan.className =
      "line-punctuation-gap";

    gapSpan.dataset.gapId =
      gaps[0].id;

    gapSpan.style.direction =
      "ltr";

    gapSpan.style.unicodeBidi =
      "isolate";

    gapSpan.style.display =
      "inline-block";

    gapSpan.onclick = function () {
      document.querySelectorAll(
        ".line-punctuation-gap"
      ).forEach(function(span) {
        span.classList.remove(
          "line-punctuation-gap-selected"
        );
      });

      selectedReviewGapId =
        this.dataset.gapId;
const selectedGap =
  reviewLineWorkingGaps.find(
    function(gap) {
      return (
        gap.id ===
        selectedReviewGapId
      );
    }
  );

document.getElementById(
  "linePunctuationSelectedGap"
).textContent =
  selectedReviewGapId;

document.getElementById(
  "linePunctuationCurrent"
).textContent =
  selectedGap &&
  selectedGap.punctuation
    ? selectedGap.punctuation
    : "None";
      this.classList.add(
        "line-punctuation-gap-selected"
      );

      console.log(
        "Selected punctuation gap:",
        selectedReviewGapId
      );
    };

    gapSpan.textContent =
  "[" +
  gaps[0].id +
  "  " +
  (gaps[0].punctuation || "∅") + "]";

    display.appendChild(
      gapSpan
    );
  }

  /*
   * Display each word followed by
   * its corresponding gap.
   */
  line.words.forEach(
    function(word, index) {
      const wordSpan =
        document.createElement("span");

      wordSpan.style.direction =
        "rtl";

      wordSpan.style.unicodeBidi =
        "isolate";

      wordSpan.style.display =
        "inline-block";

      wordSpan.textContent =
        String(word.hebrew || "");

      display.appendChild(
        wordSpan
      );

      const gap =
        gaps[index + 1];

      if (!gap) {
        return;
      }

      const gapSpan =
        document.createElement("span");

      gapSpan.className =
        "line-punctuation-gap";

      gapSpan.dataset.gapId =
        gap.id;

      gapSpan.style.direction =
        "ltr";

      gapSpan.style.unicodeBidi =
        "isolate";

      gapSpan.style.display =
        "inline-block";

      gapSpan.onclick = function () {
        document.querySelectorAll(
          ".line-punctuation-gap"
        ).forEach(function(span) {
          span.classList.remove(
            "line-punctuation-gap-selected"
          );
        });

        selectedReviewGapId =
          this.dataset.gapId;
const selectedGap =
  reviewLineWorkingGaps.find(
    function(gap) {
      return (
        gap.id ===
        selectedReviewGapId
      );
    }
  );

document.getElementById(
  "linePunctuationSelectedGap"
).textContent =
  selectedReviewGapId;

document.getElementById(
  "linePunctuationCurrent"
).textContent =
  selectedGap &&
  selectedGap.punctuation
    ? selectedGap.punctuation
    : "None";
        this.classList.add(
          "line-punctuation-gap-selected"
        );

        console.log(
          "Selected punctuation gap:",
          selectedReviewGapId
        );
      };

      gapSpan.textContent =
  "[" +
  gap.id +
  ":" +
  (gap.punctuation || "∅") +
  "]";

      display.appendChild(
        gapSpan
      );
    }
  );

  document.getElementById(
    "linePunctuationModalOverlay"
  ).style.display = "flex";
}

function closeLinePunctuationModal() {
  reviewLineWorkingGaps = null;
  activeReviewLine = null;
  selectedReviewGapId = null;

  document.getElementById(
    "linePunctuationModalOverlay"
  ).style.display = "none";
}
function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
function getSelectedReviewGap() {
  if (
    !selectedReviewGapId ||
    !Array.isArray(reviewLineWorkingGaps)
  ) {
    return null;
  }

  return reviewLineWorkingGaps.find(
    function(gap) {
      return gap.id === selectedReviewGapId;
    }
  ) || null;
}

function refreshSelectedGapControls() {
  const gap =
    getSelectedReviewGap();

  document.getElementById(
    "linePunctuationSelectedGap"
  ).textContent =
    gap ? gap.id : "None";

  document.getElementById(
    "linePunctuationCurrent"
  ).textContent =
    gap && gap.punctuation
      ? gap.punctuation
      : "None";
}
function addLinePunctuation() {
  const gap =
    getSelectedReviewGap();

  const newValue =
    document.getElementById(
      "linePunctuationNew"
    ).value;

  if (!gap) {
    alert(
      "Please select a gap first."
    );
    return;
  }

  if (!newValue) {
    alert(
      "Please choose punctuation to add."
    );
    return;
  }

  /*
   * A gap may contain only one
   * punctuation value.
   */
  if (gap.punctuation) {
    alert(
      "This gap already contains punctuation. " +
      "Use Replace or Remove instead."
    );
    return;
  }

  gap.punctuation =
    newValue;

  renderLinePunctuationDisplay();
  refreshSelectedGapControls();
if (newValue === "\u05C3") {
  alert(
    "Sof Pasuq added.\n\n" +
    "If required, use the Word Review editor " +
    "to add Silluq/Meteg to the appropriate " +
    "letter of the final word."
  );
}
  document.getElementById(
    "linePunctuationNew"
  ).value = "";
}
function replaceLinePunctuation() {
  const gap =
    getSelectedReviewGap();

  const newValue =
    document.getElementById(
      "linePunctuationNew"
    ).value;

  if (!gap) {
    alert(
      "Please select a gap first."
    );
    return;
  }

  if (!gap.punctuation) {
    alert(
      "This gap contains no punctuation. " +
      "Use Add instead."
    );
    return;
  }

  if (!newValue) {
    alert(
      "Please choose replacement punctuation."
    );
    return;
  }

  gap.punctuation =
    newValue;

  renderLinePunctuationDisplay();
  refreshSelectedGapControls();
if (newValue === "\u05C3") {
  alert(
    "Sof Pasuq added.\n\n" +
    "If required, use the Word Review editor " +
    "to add Silluq/Meteg to the appropriate " +
    "letter of the final word."
  );
}
  document.getElementById(
    "linePunctuationNew"
  ).value = "";
}
function removeLinePunctuation() {
  const gap =
    getSelectedReviewGap();

  if (!gap) {
    alert(
      "Please select a gap first."
    );
    return;
  }

  gap.punctuation = "";

 renderLinePunctuationDisplay();
refreshSelectedGapControls();
}

function restoreLinePunctuation() {
  const gap =
    getSelectedReviewGap();

  if (!gap) {
    alert(
      "Please select a gap first."
    );
    return;
  }

  gap.punctuation =
    String(
      gap.originalPunctuation || ""
    );

  renderLinePunctuationDisplay();
refreshSelectedGapControls();

  document.getElementById(
    "linePunctuationNew"
  ).value = "";
}


function commitLinePunctuationChanges() {
  if (
    !activeReviewLine ||
    !Array.isArray(activeReviewLine.gaps) ||
    !Array.isArray(reviewLineWorkingGaps)
  ) {
    return;
  }

  activeReviewLine.gaps.forEach(
    function(gap) {
      const workingGap =
        reviewLineWorkingGaps.find(
          function(item) {
            return item.id === gap.id;
          }
        );

      if (workingGap) {
        gap.punctuation =
          workingGap.punctuation;
      }
    }
  );

  reviewLineWorkingGaps = null;
  activeReviewLine = null;
  selectedReviewGapId = null;

  displayExtractedHebrew(
    reviewJson
  );

  document.getElementById(
    "linePunctuationModalOverlay"
  ).style.display = "none";
}
function renderLinePunctuationDisplay() {
  if (
    !activeReviewLine ||
    !Array.isArray(activeReviewLine.words) ||
    !Array.isArray(reviewLineWorkingGaps)
  ) {
    return;
  }

  const display =
    document.getElementById(
      "linePunctuationDisplay"
    );

  display.innerHTML = "";

  const gaps =
    reviewLineWorkingGaps;

  function addGapSpan(gap) {
    if (!gap) {
      return;
    }

    const gapSpan =
      document.createElement("span");

    gapSpan.className =
      "line-punctuation-gap";

    gapSpan.dataset.gapId =
      gap.id;

    gapSpan.style.direction =
      "ltr";

    gapSpan.style.unicodeBidi =
      "isolate";

    gapSpan.style.display =
      "inline-block";

  gapSpan.textContent =
  "[" +
  gap.id +
  "  " +
  (gap.punctuation || "∅") +
  "]";

    /*
     * Preserve the selected gap after
     * the display is rebuilt.
     */
    if (
      gap.id ===
      selectedReviewGapId
    ) {
      gapSpan.classList.add(
        "line-punctuation-gap-selected"
      );
    }

    gapSpan.onclick = function () {
      selectedReviewGapId =
        this.dataset.gapId;

      renderLinePunctuationDisplay();
      refreshSelectedGapControls();

      console.log(
        "Selected punctuation gap:",
        selectedReviewGapId
      );
    };

    display.appendChild(
      gapSpan
    );
  }

  /*
   * Gap before Word 1.
   */
  addGapSpan(
    gaps[0]
  );

  /*
   * Each word followed by its gap.
   */
  activeReviewLine.words.forEach(
    function(word, index) {
      const wordSpan =
        document.createElement("span");

      wordSpan.style.direction =
        "rtl";

      wordSpan.style.unicodeBidi =
        "isolate";

      wordSpan.style.display =
        "inline-block";

      wordSpan.textContent =
        String(word.hebrew || "");

      display.appendChild(
        wordSpan
      );

      addGapSpan(
        gaps[index + 1]
      );
    }
  );
}
function cloneReviewJson(value) {
  if (!value) {
    return null;
  }

  return JSON.parse(
    JSON.stringify(value)
  );
}
function refreshLineStructureControls() {
  const numberInput =
    document.getElementById(
      "lineStructureNumber"
    );

  const actions =
    document.getElementById(
      "lineStructureActions"
    );

  const mergeButton =
    document.getElementById(
      "mergeFollowingLineButton"
    );

  if (
    !numberInput ||
    !actions ||
    !mergeButton
  ) {
    return;
  }

  if (
    !reviewJson ||
    !Array.isArray(reviewJson.lines) ||
    reviewJson.lines.length === 0
  ) {
    actions.style.display =
      "none";

    return;
  }

  const lineNumber =
    Number(
      numberInput.value
    );

  if (
    !Number.isInteger(lineNumber) ||
    lineNumber < 1 ||
    lineNumber >
      reviewJson.lines.length
  ) {
    actions.style.display =
      "none";

    return;
  }

  actions.style.display =
    "block";

  /*
   * The last line cannot be merged
   * with a following line.
   */
  mergeButton.disabled =
    lineNumber ===
    reviewJson.lines.length;
}
function renumberReviewStructure() {
  if (
    !reviewJson ||
    !Array.isArray(reviewJson.lines)
  ) {
    return;
  }

  reviewJson.lines.forEach(
    function(line, lineIndex) {
      const lineNumber =
        lineIndex + 1;

      line.lineName =
        "Line" + lineNumber;

      if (!Array.isArray(line.words)) {
        line.words = [];
      }

      line.words.forEach(
        function(word, wordIndex) {
          word.id =
            "L" +
            lineNumber +
            "W" +
            (wordIndex + 1);
        }
      );

      if (!Array.isArray(line.gaps)) {
        line.gaps = [];
      }

      line.gaps.forEach(
        function(gap, gapIndex) {
          gap.id =
            "L" +
            lineNumber +
            "G" +
            gapIndex;
        }
      );
    }
  );
}


function refreshReviewAfterStructureChange(
  selectedLineNumber
) {
  renumberReviewStructure();

  selectedReviewWordIds = [];
  activeReviewWord = null;
  activeReviewLine = null;
  selectedReviewGapId = null;

  displayExtractedHebrew(
    reviewJson
  );

  const numberInput =
    document.getElementById(
      "lineStructureNumber"
    );

  if (numberInput) {
    if (
      reviewJson.lines.length === 0
    ) {
      numberInput.value =
        "-1";
    } else {
      const safeLineNumber =
        Math.max(
          1,
          Math.min(
            selectedLineNumber,
            reviewJson.lines.length
          )
        );

      numberInput.value =
        String(
          safeLineNumber
        );
    }
  }

  refreshLineStructureControls();
}


function mergeReviewLineWithFollowing() {
  if (
    !reviewJson ||
    !Array.isArray(reviewJson.lines)
  ) {
    return;
  }

  const lineNumber =
    Number(
      document.getElementById(
        "lineStructureNumber"
      ).value
    );

  const lineIndex =
    lineNumber - 1;

  if (
    lineIndex < 0 ||
    lineIndex >=
      reviewJson.lines.length - 1
  ) {
    return;
  }

  const firstLine =
    reviewJson.lines[
      lineIndex
    ];

  const secondLine =
    reviewJson.lines[
      lineIndex + 1
    ];

  const firstWords =
    Array.isArray(firstLine.words)
      ? firstLine.words
      : [];

  const secondWords =
    Array.isArray(secondLine.words)
      ? secondLine.words
      : [];

  const firstGaps =
    Array.isArray(firstLine.gaps)
      ? firstLine.gaps
      : [];

  const secondGaps =
    Array.isArray(secondLine.gaps)
      ? secondLine.gaps
      : [];

  const firstFinalGap =
    firstGaps[
      firstWords.length
    ];

  const secondInitialGap =
    secondGaps[0];

  const boundaryPunctuation =
    String(
      firstFinalGap
        ? firstFinalGap.punctuation || ""
        : ""
    ) +
    String(
      secondInitialGap
        ? secondInitialGap.punctuation || ""
        : ""
    );

  const boundaryOriginalPunctuation =
    String(
      firstFinalGap
        ? firstFinalGap.originalPunctuation || ""
        : ""
    ) +
    String(
      secondInitialGap
        ? secondInitialGap.originalPunctuation || ""
        : ""
    );

  firstLine.words =
    firstWords.concat(
      secondWords
    );

  const mergedGaps =
    firstGaps.slice(
      0,
      firstWords.length
    );

  mergedGaps.push({
    id: "",
    punctuation:
      boundaryPunctuation,
    originalPunctuation:
      boundaryOriginalPunctuation
  });

  for (
    let index = 1;
    index < secondGaps.length;
    index++
  ) {
    mergedGaps.push(
      cloneReviewJson(
        secondGaps[index]
      )
    );
  }

  firstLine.gaps =
    mergedGaps;

  reviewJson.lines.splice(
    lineIndex + 1,
    1
  );

  refreshReviewAfterStructureChange(
    lineNumber
  );
}


function duplicateReviewLine() {
  if (
    !reviewJson ||
    !Array.isArray(reviewJson.lines)
  ) {
    return;
  }

  const lineNumber =
    Number(
      document.getElementById(
        "lineStructureNumber"
      ).value
    );

  const lineIndex =
    lineNumber - 1;

  const sourceLine =
    reviewJson.lines[
      lineIndex
    ];

  if (!sourceLine) {
    return;
  }

  const duplicatedLine =
    cloneReviewJson(
      sourceLine
    );

  reviewJson.lines.splice(
    lineIndex + 1,
    0,
    duplicatedLine
  );

  refreshReviewAfterStructureChange(
    lineNumber + 1
  );
}


function deleteReviewLine() {
  if (
    !reviewJson ||
    !Array.isArray(reviewJson.lines)
  ) {
    return;
  }

  const lineNumber =
    Number(
      document.getElementById(
        "lineStructureNumber"
      ).value
    );

  const lineIndex =
    lineNumber - 1;

  if (
    lineIndex < 0 ||
    lineIndex >=
      reviewJson.lines.length
  ) {
    return;
  }

  if (
    reviewJson.lines.length === 1
  ) {
    alert(
      "The only remaining line cannot be deleted."
    );

    return;
  }

  const confirmed =
    confirm(
      "Delete Line " +
      lineNumber +
      "?"
    );

  if (!confirmed) {
    return;
  }

  reviewJson.lines.splice(
    lineIndex,
    1
  );

  refreshReviewAfterStructureChange(
    lineNumber
  );
}


function restoreAllOriginalReviewLines() {
  if (!originalReviewJson) {
    return;
  }

  const confirmed =
    confirm(
      "Restore the complete review structure " +
      "to the original OCR or loaded-file result?\n\n" +
      "All review edits will be discarded."
    );

  if (!confirmed) {
    return;
  }

  reviewJson =
    cloneReviewJson(
      originalReviewJson
    );

  selectedReviewWordIds = [];
  activeReviewWord = null;
  activeReviewLine = null;
  selectedReviewGapId = null;

  document.getElementById(
    "lineStructureNumber"
  ).value =
    "-1";

  displayExtractedHebrew(
    reviewJson
  );

  refreshLineStructureControls();
}

function buildLyricsJsonFromReview() {
  if (
    !reviewJson ||
    !Array.isArray(reviewJson.lines)
  ) {
    return null;
  }

  return {
    title:
      String(
        reviewJson.title || ""
      ),

    lines:
      reviewJson.lines.map(
        function(line, lineIndex) {
          const words =
            Array.isArray(line.words)
              ? line.words
              : [];

          const gaps =
            Array.isArray(line.gaps)
              ? line.gaps
              : [];

          return {
            lineName:
              "Line" +
              (lineIndex + 1),

            words:
              words.map(
                function(word, wordIndex) {
                  const followingGap =
                    gaps[
                      wordIndex + 1
                    ];

                  return {
                    hebrew:
                      String(
                        word.hebrew || ""
                      ) +
                      String(
                        followingGap
                          ? followingGap.punctuation || ""
                          : ""
                      ),

                    translit:
                      String(
                        word.translit || ""
                      )
                  };
                }
              )
          };
        }
      )
  };
}
function commitTransliterationEdits() {
  if (
    !currentJson ||
    !Array.isArray(currentJson.lines)
  ) {
    alert(
      "There is no transliterated Lyrics JSON available."
    );
    return;
  }

  const editedLines =
    transliterationSummary.value
      .split(/\r?\n/);

  if (
    editedLines.length !==
    currentJson.lines.length
  ) {
    alert(
      "The number of transliteration lines has changed.\n\n" +
      "The edits cannot be committed."
    );
    return;
  }

  for (
    let lineIndex = 0;
    lineIndex < currentJson.lines.length;
    lineIndex++
  ) {
    const line =
      currentJson.lines[lineIndex];

    const words =
      Array.isArray(line.words)
        ? line.words
        : [];

    const editedTokens =
      editedLines[lineIndex]
        .trim()
        .split(/\s+/)
        .filter(Boolean);

    if (
      editedTokens.length !==
      words.length
    ) {
      alert(
        "Line " +
        (lineIndex + 1) +
        " no longer has the expected number of transliteration words.\n\n" +
        "Expected: " +
        words.length +
        "\nFound: " +
        editedTokens.length +
        "\n\n" +
        "No edits were committed."
      );

      return;
    }
  }

  /*
   * Validation succeeded for every line.
   * Now write the edited transliteration
   * back into the existing JSON.
   */
  currentJson.lines.forEach(
    function(line, lineIndex) {
      const editedTokens =
        editedLines[lineIndex]
          .trim()
          .split(/\s+/)
          .filter(Boolean);

      line.words.forEach(
        function(word, wordIndex) {
          word.translit =
            editedTokens[wordIndex];
        }
      );
    }
  );

  transliterationEditsCommitted =
    true;

  transliterationSummary.readOnly =
    true;

  enableTransliterationEditing.checked =
    false;

  commitTransliterationEditsButton.disabled =
    true;

  alert(
    "Transliteration edits have been committed.\n\n" +
    "Download Current Lyrics JSON will include the edits."
  );
}
