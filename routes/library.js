import { Router } from "express";
import fs from "fs";
import path from "path";

const router = Router();
const MOVIES_DIR = process.env.MEDIA_MOVIES_DIR || "/media/movies";
const TV_DIR = process.env.MEDIA_TV_DIR || "/media/tv";

/**
 * Recursively read directory tree — safe, no shell commands
 * Returns { name, type, size?, children?, modified? }
 */
function readDirTree(dirPath, depth = 0, maxDepth = 3) {
  if (depth > maxDepth) return [];

  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    return entries
      .filter((e) => !e.name.startsWith(".")) // skip dotfiles
      .map((entry) => {
        const fullPath = path.join(dirPath, entry.name);
        if (entry.isDirectory()) {
          return {
            name: entry.name,
            type: "directory",
            children: readDirTree(fullPath, depth + 1, maxDepth),
          };
        }
        try {
          const stat = fs.statSync(fullPath);
          return {
            name: entry.name,
            type: "file",
            size: stat.size,
            modified: stat.mtime.toISOString(),
          };
        } catch {
          return { name: entry.name, type: "file", size: 0 };
        }
      })
      .sort((a, b) => {
        // Directories first, then alphabetical
        if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
  } catch {
    return [];
  }
}

// GET /api/library/movies
router.get("/movies", (_req, res) => {
  const tree = readDirTree(MOVIES_DIR);
  res.json({ root: MOVIES_DIR, items: tree });
});

// GET /api/library/tv
router.get("/tv", (_req, res) => {
  const tree = readDirTree(TV_DIR);
  res.json({ root: TV_DIR, items: tree });
});

// GET /api/library/stats
router.get("/stats", (_req, res) => {
  function countItems(dirPath) {
    try {
      return fs
        .readdirSync(dirPath, { withFileTypes: true })
        .filter((e) => e.isDirectory() && !e.name.startsWith(".")).length;
    } catch {
      return 0;
    }
  }

  function totalSize(dirPath) {
    let total = 0;
    try {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        if (entry.isDirectory()) {
          total += totalSize(fullPath);
        } else {
          try {
            total += fs.statSync(fullPath).size;
          } catch {
            /* skip */
          }
        }
      }
    } catch {
      /* skip */
    }
    return total;
  }

  res.json({
    movies: { count: countItems(MOVIES_DIR), size: totalSize(MOVIES_DIR) },
    tv: { count: countItems(TV_DIR), size: totalSize(TV_DIR) },
  });
});

export default router;
