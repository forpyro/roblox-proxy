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
        "User-Agent": "RobloxPublicProfileViewer/1.0"
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
  res.send("Roblox public profile viewer proxy is running.");
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

  if (!result || result.error || !result.data || !result.data[0]) {
    return res.json({ error: true, message: "User not found" });
  }

  res.json(result.data[0]);
});

app.get("/friends/:userId", async (req, res) => {
  const userId = Number(req.params.userId);
  if (!userId) return res.status(400).json({ error: "Invalid userId" });

  const friends = await fetchJson(`https://friends.roblox.com/v1/users/${userId}/friends`);

  if (!friends || friends.error || !friends.data) {
    return res.json({ data: [] });
  }

  const ids = friends.data.map(f => f.id);

  const userInfos = await fetchJson("https://users.roblox.com/v1/users", {
    method: "POST",
    body: {
      userIds: ids,
      excludeBannedUsers: false
    }
  });

  const infoMap = {};

  if (userInfos && userInfos.data) {
    for (const u of userInfos.data) {
      infoMap[u.id] = u;
    }
  }

  const fixedFriends = friends.data.map(f => {
    const info = infoMap[f.id] || {};
    return {
      id: f.id,
      name: info.name || f.name || "Unknown",
      displayName: info.displayName || f.displayName || info.name || f.name || "Unknown"
    };
  });

  res.json({ data: fixedFriends });
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
    const ids = wearing.assetIds.slice(0, 40).join(",");
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

// FIXED: uses v2 endpoint, normalizes response to always return { data: [...] }
app.get("/outfits/:userId", async (req, res) => {
  const userId = Number(req.params.userId);
  if (!userId) return res.status(400).json({ error: "Invalid userId" });

  const outfits = await fetchJson(
    `https://avatar.roblox.com/v2/outfits/search?userId=${userId}&itemsPerPage=50&page=1`
  );

  // Normalize: always return { data: [...] }
  if (!outfits || outfits.error || !outfits.data) {
    return res.json({ data: [] });
  }

  const normalized = outfits.data.map(o => ({
    id: o.id,
    name: o.name,
    isEditable: o.isEditable
  }));

  res.json({ data: normalized });
});

// FIXED: normalize outfit details to always return { assets: [...] }
app.get("/outfit/:outfitId", async (req, res) => {
  const outfitId = Number(req.params.outfitId);
  if (!outfitId) return res.status(400).json({ error: "Invalid outfitId" });

  const outfit = await fetchJson(
    `https://avatar.roblox.com/v1/outfits/${outfitId}/details`
  );

  if (!outfit || outfit.error) {
    return res.json({ assets: [] });
  }

  // Normalize assets array
  const assets = (outfit.assets || []).map(a => ({
    id: a.id,
    name: a.name,
    assetType: a.assetType && a.assetType.name
  }));

  res.json({ ...outfit, assets });
});

app.listen(PORT, () => {
  console.log(`Proxy running on port ${PORT}`);
});
