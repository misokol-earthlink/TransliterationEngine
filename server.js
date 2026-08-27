require("dotenv").config();

const express = require("express");
const path = require("path");
const multer = require("multer");
const cors = require("cors");
console.log("Running server from:", __filename);
console.log("Working directory:", process.cwd());
const {
  transliterateJson
} = require("./lib/transliterate");

const {
  processHebrewImage
} = require("./lib/imageprocess");
const app = express();
const port = process.env.PORT || 3000;
app.use(
  cors({
    origin:
      "https://misokol-earthlink.github.io"
  })
);
/*
 * Store uploaded image/PDF files in memory.
 * The uploaded file will be available as req.file.buffer.
 */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 20 * 1024 * 1024
  }
});

app.use(express.json({ limit: "5mb" }));

app.use(
  express.static(
    path.join(__dirname, "public")
  )
);

/*
 * Existing Lyrics JSON transliteration route.
 */
app.post("/process", async (req, res) => {
  try {
    const updatedJson =
      await transliterateJson(req.body);

    res.json(updatedJson);
  } catch (error) {
    console.error("Transliteration failed:");
    console.error(error);

    res.status(500).json({
      error: "Transliteration failed."
    });
  }
});

/*
 * New image/PDF extraction route.
 *
 * The browser must submit the file in a multipart
 * form-data field named "image".
 */

console.log("Registering /process-image route");
app.post(
  "/process-image",
  upload.single("image"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          error:
            "No image or PDF file was received."
        });
      }

      const extractedJson =
        await processHebrewImage(
          req.file.buffer,
          req.file.originalname,
          req.file.mimetype
        );

      res.json(extractedJson);
    } catch (error) {
      console.error(
        "Hebrew image processing failed:"
      );
      console.error(error);

      res.status(500).json({
        error:
          error.message ||
          "Hebrew image processing failed."
      });
    }
  }
);
/*
 * Handle Multer upload errors, including files
 * exceeding the configured size limit.
 */
app.use(function (
  error,
  req,
  res,
  next
) {
  if (error instanceof multer.MulterError) {
    console.error("File upload failed:");
    console.error(error);

    return res.status(400).json({
      error:
        error.code === "LIMIT_FILE_SIZE"
          ? "The selected file exceeds the 20 MB limit."
          : "The selected file could not be uploaded."
    });
  }

  next(error);
});

app.listen(port, () => {
  console.log(
    `Hebrew Transliteration app is running at http://localhost:${port}`
  );
});