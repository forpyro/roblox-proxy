const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

async function fetchJson(url, options = {}) {
  try {
    const res = await fetch(url, {
      method: options.method || "GET",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "RobloxProfileProxy/1.0"
      },
      body: options.body ? JSON.stringify(options.body) : undefined
    });

    if (!res.ok) {
      return { error: true, status: res.status, url };
    }

    return await res.json();
  } catch (err) {
    return { error: true, message: err.message, url };
  }
}

app.get("/", (req, res) => {
  res.send("Roblox proxy running.");
});

app.get("/username/:username", async (req, res) => {
  const username = req.params.username;

  const result = await fetchJson("https://users.roblox.com/v1/usernames/users", {
    method: "POST",
    body: {
      usernames: [username],
      excludeBannedUsers: false
    }
  });

  if (!result || !result.data || !result.data[0]) {
    return res.json({ error: true, message: "User not found" });
  }

  res.json(result.data[0]);
});

app.get("/friends/:userId", async (req, res) => {
  const userId = Number(req.params.userId);
  if (!userId) return res.status(400).json({ error: "Invalid userId" });

  const friends = await fetchJson(`https://friends.roblox.com/v1/users/${userId}/friends`);
  res.json(friends);
});

app.get("/profile/:userId", async (req, res) => {
  const userId = Number(req.params.userId);
  if (!userId) return res.status(400).json({ error: "Invalid userId" });

  const [
    user,
    friends,
    followers,
    following,
    avatar,
    headshot,
    wearing,
    groups,
    robloxBadges,
    createdGames,
    favoriteGames
  ] = await Promise.all([
    fetchJson(`https://users.roblox.com/v1/users/${userId}`),
    fetchJson(`https://friends.roblox.com/v1/users/${userId}/friends/count`),
    fetchJson(`https://friends.roblox.com/v1/users/${userId}/followers/count`),
    fetchJson(`https://friends.roblox.com/v1/users/${userId}/followings/count`),
    fetchJson(`https://thumbnails.roblox.com/v1/users/avatar?userIds=${userId}&size=720x720&format=Png&isCircular=false`),
    fetchJson(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=420x420&format=Png&isCircular=false`),
    fetchJson(`https://avatar.roblox.com/v1/users/${userId}/currently-wearing`),
    fetchJson(`https://groups.roblox.com/v2/users/${userId}/groups/roles`),
    fetchJson(`https://accountinformation.roblox.com/v1/users/${userId}/roblox-badges`),
    fetchJson(`https://games.roblox.com/v2/users/${userId}/games?accessFilter=Public&limit=10&sortOrder=Asc`),
    fetchJson(`https://games.roblox.com/v2/users/${userId}/favorite/games?accessFilter=Public&limit=10&sortOrder=Asc`)
  ]);

  const presence = await fetchJson("https://presence.roblox.com/v1/presence/users", {
    method: "POST",
    body: { userIds: [userId] }
  });

  let itemThumbnails = null;

  if (wearing && wearing.assetIds && wearing.assetIds.length > 0) {
    const ids = wearing.assetIds.slice(0, 20).join(",");
    itemThumbnails = await fetchJson(
      `https://thumbnails.roblox.com/v1/assets?assetIds=${ids}&size=420x420&format=Png&isCircular=false`
    );
  }

  res.json({
    userId,
    user,
    counts: { friends, followers, following },
    thumbnails: { avatar, headshot, itemThumbnails },
    avatarData: { wearing },
    groups,
    robloxBadges,
    games: { createdGames, favoriteGames },
    presence
  });
});

app.listen(PORT, () => {
  console.log(`Roblox proxy running on port ${PORT}`);
});
