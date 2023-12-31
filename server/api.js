const { initializeDatabase, queryDB, insertDB } = require("./database");
const { body } = require("express-validator");
const jwt = require('jsonwebtoken');
const AesEncryption = require("aes-encryption");


let db;
const jwtSecret = "supersecret";
const aes = new AesEncryption();
aes.setSecretKey(
  process.env.SECRET ||
    "11122233344455566677788822244455555555555555555231231321313aaaff"
);

const initializeAPI = async (app) => {
  db = await initializeDatabase();
  app.get("/api/feed", getFeed);
  app.post("/api/feed", postTweet);
  app.post(
    "/api/login",
    body("username")
      .notEmpty()
      .withMessage("Username is required.")
      .isEmail()
      .withMessage("Invalid email format."),
    body("password")
      .isLength({ min: 6, max: 64 })
      .withMessage("Password must be between 6 to 64 characters.")
      .escape(),
    login
  );
};

const getFeed = async (req, res) => {
  const query = "SELECT * FROM tweets ORDER BY id DESC;";
  const tweets = await queryDB(db, query);
  res.json(tweets);
};

function containsInjection(str) {
  const htmlAndSqlPattern = /<[^>]*>|(\bSELECT|INSERT|UPDATE|DELETE|FROM|WHERE|DROP|ALTER|CREATE|TABLE|script)\b/i;
  return htmlAndSqlPattern.test(str);
}
 
const postTweet = async (req, res) => {
  const { username, timestamp, text } = req.body;
  if (containsInjection(text) === true) {
 
    res.json({ status: "ok" });
  } else {
    const encryptedText = aes.encrypt(text);
    const query = `INSERT INTO tweets (username, timestamp, text) VALUES ('${username}', '${timestamp}', '${encryptedText}')`;    await queryDB(db, query);
    res.json({ status: "ok" });
  }
};

const login = async (req, res) => {
  const { username, password } = req.body;
  const query = `SELECT * FROM users WHERE username = '${username}' AND password = '${password}'`;
  const user = await queryDB(db, query);

  if (user.length === 1) {
    const username = user[0].username;

    const jwtSecret = "supersecret";
    const token = jwt.sign(
      {
        exp: Math.floor(Date.now() / 1000) + 60 * 60,
        data: username,
      },
      jwtSecret
    );
    req.log.info("User logged in successfully");
    res.json({ token });
  } else {
    req.log.error("Failed login attempt");
    res.status(401).json({ error: "Username or password invalid!" });
  }
};

module.exports = { initializeAPI };
