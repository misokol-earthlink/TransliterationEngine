const express = require("express");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const multer = require("multer");
const dotenv = require("dotenv");
const cors = require("cors");
const {
  createClient
} = require("@supabase/supabase-js");/*
 * Load the original application's .env first.
 * This currently supplies OPENAI_API_KEY.
 */

//dotenv.config({  path: path.join(__dirname, "..", ".env")});

/*
 * Load the WorkingFolder .env.
 * This supplies APP_ENCRYPTION_KEY.
 */
//dotenv.config({  path: path.join(__dirname, ".env")});

dotenv.config();
const supabase =
  createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SECRET_KEY,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    }
  );
//const {  transliterateJson} = require("../lib/transliterate");

//const {  processHebrewImage} = require("../lib/imageprocess");
const {
  transliterateJson
} = require("./lib/transliterate");

const {
  processHebrewImage
} = require("./lib/imageprocess");

const app = express();

const port =
  process.env.PORT || 3000;
app.use(
  cors({
    origin:
      "https://misokol-earthlink.github.io",
    credentials: true
  })
);

/*
 * File upload configuration.
 */
const upload = multer({
  storage: multer.memoryStorage(),

  limits: {
    fileSize: 20 * 1024 * 1024
  }
});


const dataDir =
  path.join(__dirname, "data");

const usersFile =
  path.join(dataDir, "users.json");

const sessionsFile =
  path.join(dataDir, "sessions.json");


// --------------------------------------------------
// Verify encryption key
// --------------------------------------------------

const encryptionKeyHex =
  process.env.APP_ENCRYPTION_KEY;

if (
  !encryptionKeyHex ||
  encryptionKeyHex.length !== 64
) {
  throw new Error(
    "APP_ENCRYPTION_KEY must be a 64-character hexadecimal value."
  );
}

const encryptionKey =
  Buffer.from(
    encryptionKeyHex,
    "hex"
  );


// --------------------------------------------------
// Create local data files if necessary
// --------------------------------------------------

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(
    dataDir,
    {
      recursive: true
    }
  );
}

if (!fs.existsSync(usersFile)) {
  fs.writeFileSync(
    usersFile,
    JSON.stringify({}, null, 2)
  );
}

if (!fs.existsSync(sessionsFile)) {
  fs.writeFileSync(
    sessionsFile,
    JSON.stringify({}, null, 2)
  );
}


// --------------------------------------------------
// Middleware
// --------------------------------------------------

app.use(
  express.json({
    limit: "5mb"
  })
);

app.use(
  express.static(
    path.join(__dirname, "public")
  )
);


// --------------------------------------------------
// JSON file helpers
// --------------------------------------------------

function readJsonFile(fileName) {
  return JSON.parse(
    fs.readFileSync(
      fileName,
      "utf8"
    )
  );
}


function writeJsonFile(
  fileName,
  data
) {
  fs.writeFileSync(
    fileName,
    JSON.stringify(
      data,
      null,
      2
    )
  );
}


// --------------------------------------------------
// API-key encryption
// --------------------------------------------------

function encryptApiKey(apiKey) {
  const iv =
    crypto.randomBytes(12);

  const cipher =
    crypto.createCipheriv(
      "aes-256-gcm",
      encryptionKey,
      iv
    );

  const encrypted =
    Buffer.concat([
      cipher.update(
        apiKey,
        "utf8"
      ),

      cipher.final()
    ]);

  const authTag =
    cipher.getAuthTag();

  return {
    iv:
      iv.toString("hex"),

    authTag:
      authTag.toString("hex"),

    encryptedKey:
      encrypted.toString("hex")
  };
}
function decryptApiKey(openaiKey) {
  const decipher =
    crypto.createDecipheriv(
      "aes-256-gcm",
      encryptionKey,
      Buffer.from(
        openaiKey.iv,
        "hex"
      )
    );

  decipher.setAuthTag(
    Buffer.from(
      openaiKey.authTag,
      "hex"
    )
  );

  const decrypted =
    Buffer.concat([
      decipher.update(
        Buffer.from(
          openaiKey.encryptedKey,
          "hex"
        )
      ),

      decipher.final()
    ]);

  return decrypted.toString(
    "utf8"
  );
}

// --------------------------------------------------
// Cookie helper
// --------------------------------------------------

function getCookie(
  req,
  cookieName
) {
  const cookieHeader =
    req.headers.cookie;

  if (!cookieHeader) {
    return null;
  }

  const cookies =
    cookieHeader.split(";");

  for (const cookie of cookies) {
    const parts =
      cookie.trim().split("=");

    const name =
      parts.shift();

    const value =
      parts.join("=");

    if (name === cookieName) {
      return decodeURIComponent(
        value
      );
    }
  }

  return null;
}


// --------------------------------------------------
// Session helpers
// --------------------------------------------------

function createSession(email) {
  const sessionToken =
    crypto
      .randomBytes(32)
      .toString("hex");

  const sessionHash =
    crypto
      .createHash("sha256")
      .update(sessionToken)
      .digest("hex");

  const sessions =
    readJsonFile(
      sessionsFile
    );

  const expiresAt =
    Date.now() +
    30 * 24 * 60 * 60 * 1000;

  sessions[sessionHash] = {
    email,
    expiresAt
  };

  writeJsonFile(
    sessionsFile,
    sessions
  );

  return sessionToken;
}


function findSession(
  sessionToken
) {
  if (!sessionToken) {
    return null;
  }

  const sessionHash =
    crypto
      .createHash("sha256")
      .update(sessionToken)
      .digest("hex");

  const sessions =
    readJsonFile(
      sessionsFile
    );

  const session =
    sessions[sessionHash];

  if (!session) {
    return null;
  }

  if (
    session.expiresAt <
    Date.now()
  ) {
    delete sessions[
      sessionHash
    ];

    writeJsonFile(
      sessionsFile,
      sessions
    );

    return null;
  }

  return session;
}


// --------------------------------------------------
// Session check
// --------------------------------------------------

app.get(
  "/session",
  (req, res) => {
    const sessionToken =
      getCookie(
        req,
        "transliteration_session"
      );

    const session =
      findSession(
        sessionToken
      );

    if (!session) {
      return res.json({
        authenticated: false
      });
    }

    res.json({
      authenticated: true,
      email: session.email
    });
  }
);


// --------------------------------------------------
// Registration
// --------------------------------------------------

app.post(
  "/register",
  (req, res) => {
    const email =
      String(
        req.body.email || ""
      )
        .trim()
        .toLowerCase();

    const apiKey =
  String(
    req.body.apiKey || ""
  ).trim();

const isTester =
  email ===
  String(
    process.env.TEST_ACCESS_CODE || ""
  )
    .trim()
    .toLowerCase();
const isDeveloper =
  email ===
  String(
    process.env.DEVELOPER_USER || ""
  )
    .trim()
    .toLowerCase();
if (!email) {
  return res
    .status(400)
    .json({
      success: false,
      message:
        "User ID is required."
    });
}

const users =
  readJsonFile(
    usersFile
  );

const existingUser =
  users[email];

if (
  !isTester &&
  !isDeveloper &&
  !apiKey &&
  !existingUser?.openaiKey
) {
  return res
    .status(400)
    .json({
      success: false,
      message:
        "OpenAI API key is required for a new user."
    });
} if (isTester) {
  users[email] = {
    email,
    tester: true,
    developer: false,

    createdAt:
      users[email]?.createdAt ||
      new Date().toISOString(),

    updatedAt:
      new Date().toISOString()
  };

} else if (isDeveloper) {
  users[email] = {
    email,
    tester: false,
    developer: true,

    createdAt:
      users[email]?.createdAt ||
      new Date().toISOString(),

    updatedAt:
      new Date().toISOString()
  };

} else {
  users[email] = {
    email,
    tester: false,
    developer: false,

    openaiKey:
      apiKey
        ? encryptApiKey(apiKey)
        : existingUser.openaiKey,

    createdAt:
      existingUser?.createdAt ||
      new Date().toISOString(),

    updatedAt:
      new Date().toISOString()
  };
}
    writeJsonFile(
      usersFile,
      users
    );

    const sessionToken =
      createSession(email);

    res.setHeader(
      "Set-Cookie",

      "transliteration_session=" +
        encodeURIComponent(
          sessionToken
        ) +
       "; HttpOnly" +
"; Secure" +
"; SameSite=None" +
"; Path=/" +
        "; Max-Age=" +
        (30 * 24 * 60 * 60)
    );

    console.log(
      "Registered user:",
      email
    );

    res.json({
      success: true,
      email
    });
  }
);

// --------------------------------------------------
// Logout
// --------------------------------------------------

app.post(
  "/logout",
  (req, res) => {

    res.setHeader(
      "Set-Cookie",

      "transliteration_session=" +
        "; HttpOnly" +
        "; Secure" +
        "; SameSite=None" +
        "; Path=/" +
        "; Max-Age=0"
    );

    res.json({
      success: true
    });
  }
);
// --------------------------------------------------
// Lyrics JSON transliteration
// --------------------------------------------------

app.post(
  "/process",
  async (req, res) => {
 console.log(
  "POST /process received"
);
    try {
      const sessionToken =
        getCookie(
          req,
          "transliteration_session"
        );

      const session =
        findSession(
          sessionToken
        );

      if (!session) {
        return res
          .status(401)
          .json({
            error:
              "Authentication required."
          });
      }

      const users =
        readJsonFile(
          usersFile
        );

      const user =
        users[session.email];

      if (!user) {
        return res
          .status(401)
          .json({
            error:
              "User record not found."
          });
      }

      let apiKey;

      if (
        user.tester ||
        user.developer
      ) {
        apiKey =
          process.env.OPENAI_API_KEY;
      } else {
        apiKey =
          decryptApiKey(
            user.openaiKey
          );
      }

      const updatedJson =
        await transliterateJson(
          req.body,
          apiKey
        );

      res.json(updatedJson);

    } catch (error) {
      console.error(
        "Transliteration failed:"
      );

      console.error(error);

      res.status(500).json({
        error:
          "Transliteration failed."
      });
    }
  }
);
// --------------------------------------------------
// Image/PDF extraction
// --------------------------------------------------

console.log(
  "Registering /process-image route"
);

app.post(
  "/process-image",
  upload.single("image"),

  async (req, res) => {
    try {
      const sessionToken =
        getCookie(
          req,
          "transliteration_session"
        );

      const session =
        findSession(
          sessionToken
        );

      if (!session) {
        return res
          .status(401)
          .json({
            error:
              "Authentication required."
          });
      }

      const users =
        readJsonFile(
          usersFile
        );

      const user =
        users[session.email];

      if (!user) {
        return res
          .status(401)
          .json({
            error:
              "User record not found."
          });
      }

      let apiKey;

      if (
        user.tester ||
        user.developer
      ) {
        apiKey =
          process.env.OPENAI_API_KEY;
      } else {
        apiKey =
          decryptApiKey(
            user.openaiKey
          );
      }
      if (!req.file) {
        return res
          .status(400)
          .json({
            error:
              "No image or PDF file was received."
          });
      }

      const extractedJson =
      const extractedJson =
  await processHebrewImage(
    req.file.buffer,
    req.file.originalname,
    req.file.mimetype,
    apiKey
  );

      res.json(
        extractedJson
      );

    } catch (error) {
      console.error(
        "Hebrew image processing failed:"
      );

      console.error(error);

      res
        .status(500)
        .json({
          error:
            error.message ||
            "Hebrew image processing failed."
        });
    }
  }
);


// --------------------------------------------------
// Multer upload errors
// --------------------------------------------------

app.use(function (
  error,
  req,
  res,
  next
) {
  if (
    error instanceof
    multer.MulterError
  ) {
    console.error(
      "File upload failed:"
    );

    console.error(error);

    return res
      .status(400)
      .json({
        error:
          error.code ===
          "LIMIT_FILE_SIZE"
            ? "The selected file exceeds the 20 MB limit."
            : "The selected file could not be uploaded."
      });
  }

  next(error);
});


// --------------------------------------------------
// Start server
// --------------------------------------------------

app.listen(
  port,
  () => {
    console.log(
      `Front-end test server running at http://localhost:${port}`
    );
  }
);