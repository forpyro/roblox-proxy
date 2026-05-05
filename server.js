const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());

const PORT = process.env.PORT || 3000;

async function fetchJson(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

app.get("/profile/:userId", async (req, res) => {
  const id = req.params.userId;

  const user = await fetchJson(`https://users.roblox.com/v1/users/${id}`);
  const avatar = await fetchJson(`https://thumbnails.roblox.com/v1/users/avatar?userIds=${id}&size=720x720&format=Png&isCircular=false`);

  res.json({
    user,
    avatar
  });
});

app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
