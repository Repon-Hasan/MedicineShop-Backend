// middleware/verifyToken.js
const jwt = require("jsonwebtoken");

const v = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Unauthorized access" });
  }

  const token = authHeader.split(" ")[1];

  jwt.verify(token, process.env.JWT_SECRET_KEY, (err, decoded) => {
    if (err) return res.status(403).json({ message: "Forbidden access" });

    req.user = decoded; // { email: userEmail }
    next();
  });
};

module.exports = verifyToken;