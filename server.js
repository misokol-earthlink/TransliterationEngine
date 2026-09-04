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

const supabaseAuth =
  createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_PUBLISHABLE_KEY,
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

async function getOrCreateSupabaseAuthUser(
  email
) {
  const {
    data: listData,
    error: listError
  } =
    await supabase.auth.admin.listUsers();

  if (listError) {
    throw listError;
  }

  const existingUser =
    listData.users.find(
      function(user) {
        return (
          String(
            user.email || ""
          )
            .trim()
            .toLowerCase() ===
          email
        );
      }
    );

  if (existingUser) {
    return existingUser;
  }

  const {
    data: createData,
    error: createError
  } =
    await supabase.auth.admin.createUser({
      email,
      email_confirm: true
    });

  if (createError) {
    throw createError;
  }

  return createData.user;
}

// --------------------------------------------------
// Start Supabase email authentication
// --------------------------------------------------

app.post(
  "/auth/start",
  async (req, res) => {
    try {
      const email =
        String(
          req.body.email || ""
        )
          .trim()
          .toLowerCase();

      if (!email) {
        return res
          .status(400)
          .json({
            success: false,
            message:
              "Email address is required."
          });
      }

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

      /*
       * Developer and tester/backdoor users
       * do not use Supabase email verification.
       */
      if (
        isTester ||
        isDeveloper
      ) {
        return res.json({
          success: true,
          bypass: true
        });
      }

      const {
        error
      } =
       await supabaseAuth.auth.signInWithOtp({
  email,
  options: {
    shouldCreateUser: true,
    emailRedirectTo:
      "https://misokol-earthlink.github.io/TransliterationEngine/"
  }
});

      if (error) {
        throw error;
      }

      res.json({
        success: true,
        bypass: false
      });

    } catch (error) {
      console.error(
        "Supabase OTP start failed:"
      );

      console.error(error);

      res.status(500).json({
        success: false,
        message:
          "Unable to send verification code."
      });
    }
  }
);

// --------------------------------------------------
// Check Supabase magic-link authentication status
// --------------------------------------------------

app.post(
  "/auth/status",
  async (req, res) => {
    try {
      const accessToken =
        String(
          req.body.accessToken || ""
        ).trim();

      if (!accessToken) {
        return res
          .status(400)
          .json({
            success: false,
            message:
              "Authentication token is required."
          });
      }

      const {
        data,
        error
      } =
        await supabaseAuth.auth.getUser(
          accessToken
        );

      if (
        error ||
        !data.user
      ) {
        return res
          .status(401)
          .json({
            success: false,
            message:
              "Unable to verify sign-in."
          });
      }

      const email =
        String(
          data.user.email || ""
        )
          .trim()
          .toLowerCase();

      if (!email) {
        return res
          .status(401)
          .json({
            success: false,
            message:
              "Verified email address was not returned."
          });
      }

      const {
        data: existingUserRecord,
        error: existingUserRecordError
      } =
        await supabase
          .from("te_users")
          .select(
            "access_allowed"
          )
          .eq(
            "auth_user_id",
            data.user.id
          )
          .maybeSingle();

      if (existingUserRecordError) {
        throw existingUserRecordError;
      }

      if (
        existingUserRecord &&
        existingUserRecord.access_allowed !== true
      ) {
        return res
          .status(403)
          .json({
            success: false,
            message:
              "User access has been disabled."
          });
      }

      res.json({
        success: true,
        email,
        existingUser:
          !!existingUserRecord
      });

    } catch (error) {
      console.error(
        "Supabase auth status check failed:"
      );

      console.error(error);

      res.status(500).json({
        success: false,
        message:
          "Unable to check registration status."
      });
    }
  }
);

// --------------------------------------------------
// Verify Supabase email authentication
// --------------------------------------------------

app.post(
  "/auth/verify",
  async (req, res) => {
    try {
      const email =
        String(
          req.body.email || ""
        )
          .trim()
          .toLowerCase();

      const token =
        String(
          req.body.token || ""
        )
          .trim();

      if (
        !email ||
        !token
      ) {
        return res
          .status(400)
          .json({
            success: false,
            message:
              "Email address and verification code are required."
          });
      }

      const {
        data,
        error
      } =
        await supabaseAuth.auth.verifyOtp({
          email,
          token,
          type: "email"
        });

      if (error) {
        return res
          .status(400)
          .json({
            success: false,
            message:
              "The verification code is invalid or has expired."
          });
      }

      if (
        !data.user ||
        !data.session
      ) {
        throw new Error(
          "Supabase did not return an authenticated user session."
        );
      }

      const {
  data: existingUserRecord,
  error: existingUserRecordError
} =
  await supabase
    .from("te_users")
    .select(
      "access_allowed"
    )
    .eq(
      "auth_user_id",
      data.user.id
    )
    .maybeSingle();

if (existingUserRecordError) {
  throw existingUserRecordError;
}

if (
  existingUserRecord &&
  existingUserRecord.access_allowed !== true
) {
  return res
    .status(403)
    .json({
      success: false,
      message:
        "User access has been disabled."
    });
}

res.json({
  success: true,

  accessToken:
    data.session.access_token,

  existingUser:
    !!existingUserRecord
});

    } catch (error) {
      console.error(
        "Supabase OTP verification failed:"
      );

      console.error(error);

      res.status(500).json({
        success: false,
        message:
          "Unable to verify the email address."
      });
    }
  }
);
// --------------------------------------------------
// Registration
// --------------------------------------------------

app.post(
  "/register",
  async (req, res) => {
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


const acceptedTerms =
  req.body.acceptedTerms === true;

const accessToken =
  String(
    req.body.accessToken || ""
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

if (
  !isTester &&
  !isDeveloper &&
  !accessToken
) {
  return res
    .status(401)
    .json({
      success: false,
      message:
        "Email verification is required."
    });
}
let authUser = null;

if (
  !isTester &&
  !isDeveloper
) {
  const {
    data,
    error
  } =
    await supabaseAuth.auth.getUser(
      accessToken
    );

  if (
    error ||
    !data.user
  ) {
    return res
      .status(401)
      .json({
        success: false,
        message:
          "Email verification could not be confirmed."
      });
  }

  authUser =
    data.user;

  if (
    String(
      authUser.email || ""
    )
      .trim()
      .toLowerCase() !==
    email
  ) {
    return res
      .status(401)
      .json({
        success: false,
        message:
          "Verified email does not match the registration email."
      });
  }
}
let openaiSecretId = null;

if (
  !isTester &&
  !isDeveloper
) {
  const {
    data: existingSupabaseUser,
    error: existingSupabaseUserError
  } =
    await supabase
      .from("te_users")
      .select(
        "openai_secret_id, access_allowed"
      )
      .eq(
        "auth_user_id",
        authUser.id
      )
      .maybeSingle();

  if (existingSupabaseUserError) {
    console.error(
      "TEUsers lookup failed:"
    );

    console.error(
      existingSupabaseUserError
    );

    return res
      .status(500)
      .json({
        success: false,
        message:
          "Unable to check user registration."
      });
  }

  /*
   * Existing user:
   * reuse the already stored Vault secret.
   */
  if (existingSupabaseUser) {
    if (
      existingSupabaseUser.access_allowed !== true
    ) {
      return res
        .status(403)
        .json({
          success: false,
          message:
            "User access has been disabled."
        });
    }

    if (
      !existingSupabaseUser.openai_secret_id
    ) {
      return res
        .status(500)
        .json({
          success: false,
          message:
            "No stored OpenAI API key was found for this user."
        });
    }

    openaiSecretId =
      existingSupabaseUser.openai_secret_id;

    const now =
      new Date().toISOString();

    const {
      error: updateError
    } =
      await supabase
        .from("te_users")
        .update({
          terms_accepted_at:
            now,

          updated_at:
            now
        })
        .eq(
          "auth_user_id",
          authUser.id
        );

    if (updateError) {
      console.error(
        "TEUsers update failed:"
      );

      console.error(
        updateError
      );

      return res
        .status(500)
        .json({
          success: false,
          message:
            "Unable to update user registration."
        });
    }

  } else {
    /*
     * New user:
     * an OpenAI API key is required.
     */
if (!acceptedTerms) {
  return res
    .status(400)
    .json({
      success: false,
      message:
        "You must accept the terms of use before continuing."
    });
}
    if (!apiKey) {
      return res
        .status(400)
        .json({
          success: false,
          message:
            "OpenAI API key is required for a new user."
        });
    }

    const {
      data: secretId,
      error: secretError
    } =
      await supabase.rpc(
        "store_openai_secret",
        {
          secret_value:
            apiKey,

          secret_name:
            "openai-" +
            authUser.id
        }
      );

    if (
      secretError ||
      !secretId
    ) {
      console.error(
        "OpenAI key Vault storage failed:"
      );

      console.error(
        secretError
      );

      return res
        .status(500)
        .json({
          success: false,
          message:
            "Unable to securely store the OpenAI API key."
        });
    }

    openaiSecretId =
      secretId;

    const now =
      new Date().toISOString();

    const {
      error: insertError
    } =
      await supabase
        .from("te_users")
        .insert({
          auth_user_id:
            authUser.id,

          email:
            email,

          openai_secret_id:
            openaiSecretId,

          access_allowed:
            true,

          terms_accepted_at:
            now,

          updated_at:
            now
        });

    if (insertError) {
      console.error(
        "TEUsers record storage failed:"
      );

      console.error(
        insertError
      );

      return res
        .status(500)
        .json({
          success: false,
          message:
            "Unable to complete user registration."
        });
    }
  }
}
if (
  isTester ||
  isDeveloper
) {
  const users =
    readJsonFile(
      usersFile
    );

  users[email] = {
    email,

    tester:
      isTester,

    developer:
      isDeveloper,

    createdAt:
      users[email]?.createdAt ||
      new Date().toISOString(),

    updatedAt:
      new Date().toISOString()
  };

  writeJsonFile(
    usersFile,
    users
  );
}
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

      let apiKey;

const sessionEmail =
  String(
    session.email || ""
  )
    .trim()
    .toLowerCase();

const isTester =
  sessionEmail ===
  String(
    process.env.TEST_ACCESS_CODE || ""
  )
    .trim()
    .toLowerCase();

const isDeveloper =
  sessionEmail ===
  String(
    process.env.DEVELOPER_USER || ""
  )
    .trim()
    .toLowerCase();

if (
  isTester ||
  isDeveloper
) {
  apiKey =
    process.env.OPENAI_API_KEY;

} else {
  const {
    data: userRecord,
    error: userRecordError
  } =
    await supabase
      .from("te_users")
      .select(
        "openai_secret_id, access_allowed"
      )
      .eq(
        "email",
        sessionEmail
      )
      .single();

  if (
    userRecordError ||
    !userRecord
  ) {
    return res
      .status(401)
      .json({
        error:
          "User record not found."
      });
  }

  if (
    userRecord.access_allowed !== true
  ) {
    return res
      .status(403)
      .json({
        error:
          "User access has been disabled."
      });
  }

  if (
    !userRecord.openai_secret_id
  ) {
    return res
      .status(500)
      .json({
        error:
          "No OpenAI API key is stored for this user."
      });
  }

  const {
    data: storedApiKey,
    error: secretError
  } =
    await supabase.rpc(
      "get_openai_secret",
      {
        secret_id:
          userRecord.openai_secret_id
      }
    );

  if (
    secretError ||
    !storedApiKey
  ) {
    console.error(
      "OpenAI key retrieval failed:"
    );

    console.error(
      secretError
    );

    return res
      .status(500)
      .json({
        error:
          "Unable to retrieve the OpenAI API key."
      });
  }

  apiKey =
    storedApiKey;
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

let apiKey;

const sessionEmail =
  String(
    session.email || ""
  )
    .trim()
    .toLowerCase();

const isTester =
  sessionEmail ===
  String(
    process.env.TEST_ACCESS_CODE || ""
  )
    .trim()
    .toLowerCase();

const isDeveloper =
  sessionEmail ===
  String(
    process.env.DEVELOPER_USER || ""
  )
    .trim()
    .toLowerCase();

if (
  isTester ||
  isDeveloper
) {
  apiKey =
    process.env.OPENAI_API_KEY;

} else {
  const {
    data: userRecord,
    error: userRecordError
  } =
    await supabase
      .from("te_users")
      .select(
        "openai_secret_id, access_allowed"
      )
      .eq(
        "email",
        sessionEmail
      )
      .single();

  if (
    userRecordError ||
    !userRecord
  ) {
    return res
      .status(401)
      .json({
        error:
          "User record not found."
      });
  }

  if (
    userRecord.access_allowed !== true
  ) {
    return res
      .status(403)
      .json({
        error:
          "User access has been disabled."
      });
  }

  if (
    !userRecord.openai_secret_id
  ) {
    return res
      .status(500)
      .json({
        error:
          "No OpenAI API key is stored for this user."
      });
  }

  const {
    data: storedApiKey,
    error: secretError
  } =
    await supabase.rpc(
      "get_openai_secret",
      {
        secret_id:
          userRecord.openai_secret_id
      }
    );

  if (
    secretError ||
    !storedApiKey
  ) {
    console.error(
      "OpenAI key retrieval failed:"
    );

    console.error(
      secretError
    );

    return res
      .status(500)
      .json({
        error:
          "Unable to retrieve the OpenAI API key."
      });
  }

  apiKey =
    storedApiKey;
}      if (!req.file) {
        return res
          .status(400)
          .json({
            error:
              "No image or PDF file was received."
          });
      }

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