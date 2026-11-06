// server.ts
import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
var __filename = fileURLToPath(import.meta.url);
var __dirname = path.dirname(__filename);
var app = express();
var PORT = 3e3;
var DATA_FILE = path.join(__dirname, "data", "posts.json");
if (!fs.existsSync(path.join(__dirname, "data"))) {
  fs.mkdirSync(path.join(__dirname, "data"), { recursive: true });
}
if (!fs.existsSync(DATA_FILE)) {
  fs.writeFileSync(DATA_FILE, "[]", "utf-8");
}
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
function readPosts() {
  try {
    const raw = fs.readFileSync(DATA_FILE, "utf-8");
    return JSON.parse(raw);
  } catch {
    return [];
  }
}
function writePosts(posts) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(posts, null, 2), "utf-8");
  } catch (err) {
    console.error("Failed to write posts to file:", err);
  }
}
var LOGO_FILE = path.join(__dirname, "data", "logo.json");
function getStoredLogo() {
  try {
    if (fs.existsSync(LOGO_FILE)) {
      const data = JSON.parse(fs.readFileSync(LOGO_FILE, "utf-8"));
      if (data && data.logoUrl) return data.logoUrl;
    }
  } catch {
  }
  return "logo.png";
}
function setStoredLogo(logoUrl) {
  try {
    fs.writeFileSync(LOGO_FILE, JSON.stringify({ logoUrl }, null, 2), "utf-8");
    if (logoUrl.startsWith("data:image/")) {
      const base64Data = logoUrl.split(";base64,").pop();
      if (base64Data) {
        fs.writeFileSync(path.join(__dirname, "public", "logo.png"), Buffer.from(base64Data, "base64"));
      }
    }
  } catch (err) {
    console.error("Failed to save logo:", err);
  }
}
app.get("/api/logo", (_req, res) => {
  res.json({ logoUrl: getStoredLogo() });
});
app.post("/api/logo", (req, res) => {
  const { logoUrl } = req.body;
  if (!logoUrl) {
    res.status(400).json({ error: "logoUrl is required" });
    return;
  }
  setStoredLogo(logoUrl);
  res.json({ logoUrl: getStoredLogo() });
});
app.get("/api/posts", (_req, res) => {
  const posts = readPosts();
  res.json(posts);
});
app.post("/api/posts", (req, res) => {
  const body = req.body;
  if (!body.title || !body.category) {
    res.status(400).json({ error: "Title and category are required" });
    return;
  }
  const posts = readPosts();
  const newPost = {
    id: "post_" + Date.now().toString(),
    category: body.category,
    title: body.title,
    description: body.description || void 0,
    attachment: body.attachment || void 0,
    authorName: body.authorName || "ZeptaLabs Officials",
    authorAvatar: body.authorAvatar || "logo.png",
    createdAt: (/* @__PURE__ */ new Date()).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric"
    }) + " " + (/* @__PURE__ */ new Date()).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit"
    }),
    likes: 0,
    likedBy: [],
    shares: 0,
    comments: []
  };
  posts.unshift(newPost);
  writePosts(posts);
  res.status(201).json(newPost);
});
app.post("/api/posts/:id/like", (req, res) => {
  const { id } = req.params;
  const { clientId } = req.body;
  if (!clientId) {
    res.status(400).json({ error: "clientId is required" });
    return;
  }
  const posts = readPosts();
  let result = { likes: 0, isLiked: false };
  const updated = posts.map((p) => {
    if (p.id === id) {
      const alreadyLiked = (p.likedBy || []).includes(clientId);
      const newLikedBy = alreadyLiked ? (p.likedBy || []).filter((cid) => cid !== clientId) : [...p.likedBy || [], clientId];
      result = { likes: newLikedBy.length, isLiked: !alreadyLiked };
      return {
        ...p,
        likes: newLikedBy.length,
        likedBy: newLikedBy
      };
    }
    return p;
  });
  writePosts(updated);
  res.json(result);
});
app.post("/api/posts/:id/share", (req, res) => {
  const { id } = req.params;
  const posts = readPosts();
  let shares = 0;
  const updated = posts.map((p) => {
    if (p.id === id) {
      shares = (p.shares || 0) + 1;
      return { ...p, shares };
    }
    return p;
  });
  writePosts(updated);
  res.json({ shares });
});
app.post("/api/posts/:id/comments", (req, res) => {
  const { id } = req.params;
  const { authorName, content, authorAvatar } = req.body;
  if (!content || !content.trim()) {
    res.status(400).json({ error: "Content is required" });
    return;
  }
  const posts = readPosts();
  let createdComment = null;
  const updated = posts.map((p) => {
    if (p.id === id) {
      createdComment = {
        id: "comment_" + Date.now().toString(),
        authorName: authorName && authorName.trim() || "Visitor",
        authorAvatar: authorAvatar || "",
        content: content.trim(),
        createdAt: "Just now",
        likes: 0,
        likedBy: []
      };
      return {
        ...p,
        comments: [...p.comments || [], createdComment]
      };
    }
    return p;
  });
  writePosts(updated);
  res.status(201).json(createdComment);
});
app.post("/api/posts/:id/comments/:commentId/like", (req, res) => {
  const { id, commentId } = req.params;
  const { clientId } = req.body;
  if (!clientId) {
    res.status(400).json({ error: "clientId is required" });
    return;
  }
  const posts = readPosts();
  let result = { likes: 0, isLiked: false };
  const updated = posts.map((p) => {
    if (p.id === id) {
      const updatedComments = (p.comments || []).map((c) => {
        if (c.id === commentId) {
          const alreadyLiked = (c.likedBy || []).includes(clientId);
          const newLikedBy = alreadyLiked ? (c.likedBy || []).filter((cid) => cid !== clientId) : [...c.likedBy || [], clientId];
          result = { likes: newLikedBy.length, isLiked: !alreadyLiked };
          return {
            ...c,
            likes: newLikedBy.length,
            likedBy: newLikedBy
          };
        }
        return c;
      });
      return { ...p, comments: updatedComments };
    }
    return p;
  });
  writePosts(updated);
  res.json(result);
});
app.delete("/api/posts/:id", (req, res) => {
  const { id } = req.params;
  const posts = readPosts().filter((p) => p.id !== id);
  writePosts(posts);
  res.json({ success: true });
});
app.delete("/api/posts/:id/comments/:commentId", (req, res) => {
  const { id, commentId } = req.params;
  const posts = readPosts().map((p) => {
    if (p.id === id) {
      return {
        ...p,
        comments: (p.comments || []).filter((c) => c.id !== commentId)
      };
    }
    return p;
  });
  writePosts(posts);
  res.json({ success: true });
});
async function startServer() {
  const isProduction = process.env.NODE_ENV === "production";
  if (!isProduction) {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running at http://0.0.0.0:${PORT}`);
  });
}
startServer();
