const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const AdmZip = require("adm-zip");
const iconv = require("iconv-lite");
const jschardet = require("jschardet");
const { randomUUID } = require("crypto");
const next = require("next");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;
const HOST = process.env.HOST || "0.0.0.0";
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || "http://localhost:3000";
const frontendDirectory = path.join(__dirname, "..", "frontend");
const nextApp = next({
  dev: process.env.NODE_ENV !== "production",
  dir: frontendDirectory,
});
const handleNextRequest = nextApp.getRequestHandler();
const DATA_DIR = path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "store.json");
const UPLOADS_DIR = path.join(DATA_DIR, "uploads");
const PROFILE_UPLOAD_DIR = path.join(UPLOADS_DIR, "profile");
const PROFILE_UPLOAD_URL_PREFIX = "/uploads/profile/";
const MAX_PROFILE_IMAGE_SIZE_BYTES = 2 * 1024 * 1024;
const MAX_STORY_IMPORT_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const MAX_STORY_IMPORT_CONTENT_CHARS = 200000;
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const PROFILE_IMAGE_MIME_TO_EXTENSION = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};
const STORY_FILE_UPLOAD = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_STORY_IMPORT_FILE_SIZE_BYTES,
  },
});

const freeBoardStreams = new Set();

function sendSseEvent(response, event, payload) {
  response.write(`event: ${event}\n`);
  response.write(`data: ${JSON.stringify(payload)}\n\n`);
}

function broadcastFreeBoardMessage(message) {
  for (const client of freeBoardStreams) {
    try {
      sendSseEvent(client.response, "message", message);
    } catch {
      clearInterval(client.keepAliveTimer);
      freeBoardStreams.delete(client);
    }
  }
}

app.use(cors({ origin: FRONTEND_ORIGIN, credentials: true }));
const jsonParser = express.json({ limit: "6mb" });

app.use((req, res, next) => {
  if (req.path.startsWith("/api/admin/")) {
    return next();
  }

  return jsonParser(req, res, next);
});
app.use("/uploads", express.static(UPLOADS_DIR));

function nowIso() {
  return new Date().toISOString();
}

function createInitialStore() {
  const now = nowIso();
  return {
    profile: {
      id: "00000000-0000-0000-0000-000000000001",
      writer_name: null,
      profile_text: "",
      profile_image_url: null,
      created_at: now,
      updated_at: now,
    },
    subcategories: [],
    stories: [],
    comments: [],
    free_board_messages: [],
    free_board_bans: [],
    free_board_meta: {
      last_daily_reset_key: null,
      last_cleared_at: null,
      last_cleared_reason: null,
    },
  };
}

function ensureStoreFile() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!fs.existsSync(PROFILE_UPLOAD_DIR)) {
    fs.mkdirSync(PROFILE_UPLOAD_DIR, { recursive: true });
  }

  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(createInitialStore(), null, 2), "utf-8");
  }
}

function readStore() {
  ensureStoreFile();

  try {
    const raw = fs.readFileSync(DATA_FILE, "utf-8");
    const parsed = JSON.parse(raw);
    const initialStore = createInitialStore();
    const parsedProfile =
      parsed.profile && typeof parsed.profile === "object" ? parsed.profile : {};

    return {
      ...initialStore,
      ...parsed,
      profile: {
        ...initialStore.profile,
        ...parsedProfile,
        writer_name: parseNullableString(parsedProfile.writer_name),
        profile_text:
          typeof parsedProfile.profile_text === "string" ? parsedProfile.profile_text : "",
        profile_image_url: parseNullableString(parsedProfile.profile_image_url),
      },
      subcategories: Array.isArray(parsed.subcategories) ? parsed.subcategories : [],
      stories: Array.isArray(parsed.stories) ? parsed.stories : [],
      comments: Array.isArray(parsed.comments) ? parsed.comments : [],
      free_board_messages: Array.isArray(parsed.free_board_messages)
        ? parsed.free_board_messages
        : [],
      free_board_bans: Array.isArray(parsed.free_board_bans)
        ? parsed.free_board_bans
        : [],
      free_board_meta:
        parsed.free_board_meta && typeof parsed.free_board_meta === "object"
          ? parsed.free_board_meta
          : initialStore.free_board_meta,
    };
  } catch (error) {
    const initial = createInitialStore();
    fs.writeFileSync(DATA_FILE, JSON.stringify(initial, null, 2), "utf-8");
    return initial;
  }
}

function writeStore(store) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(store, null, 2), "utf-8");
}

function parseNullableString(value) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function parseProfileImageDataUrl(dataUrl) {
  if (typeof dataUrl !== "string") {
    return null;
  }

  const matched = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=\r\n]+)$/);

  if (!matched) {
    return null;
  }

  const mimeType = matched[1].toLowerCase();
  const extension = PROFILE_IMAGE_MIME_TO_EXTENSION[mimeType];

  if (!extension) {
    return null;
  }

  try {
    const base64Body = matched[2].replace(/\s/g, "");
    const buffer = Buffer.from(base64Body, "base64");

    if (buffer.length === 0) {
      return null;
    }

    return {
      mimeType,
      extension,
      buffer,
    };
  } catch {
    return null;
  }
}

function getProfileUploadFilePathFromUrl(imageUrl) {
  const parsed = parseNullableString(imageUrl);

  if (!parsed) {
    return null;
  }

  let pathname = parsed;

  if (parsed.startsWith("http://") || parsed.startsWith("https://")) {
    try {
      pathname = new URL(parsed).pathname || "";
    } catch {
      return null;
    }
  }

  if (!pathname.startsWith(PROFILE_UPLOAD_URL_PREFIX)) {
    return null;
  }

  const fileName = pathname.slice(PROFILE_UPLOAD_URL_PREFIX.length);

  if (!/^[a-zA-Z0-9._-]+$/.test(fileName)) {
    return null;
  }

  return path.join(PROFILE_UPLOAD_DIR, fileName);
}

function deleteProfileUploadByUrl(imageUrl) {
  const targetPath = getProfileUploadFilePathFromUrl(imageUrl);

  if (!targetPath || !fs.existsSync(targetPath)) {
    return;
  }

  try {
    fs.unlinkSync(targetPath);
  } catch {
    // Ignore cleanup failures so profile updates are not blocked.
  }
}

function decodeXmlEntities(value) {
  if (typeof value !== "string") {
    return "";
  }

  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_match, hex) => {
      const codePoint = Number.parseInt(hex, 16);

      if (!Number.isFinite(codePoint)) {
        return "";
      }

      return String.fromCodePoint(codePoint);
    })
    .replace(/&#([0-9]+);/g, (_match, decimal) => {
      const codePoint = Number.parseInt(decimal, 10);

      if (!Number.isFinite(codePoint)) {
        return "";
      }

      return String.fromCodePoint(codePoint);
    });
}

function normalizeImportedStoryContent(content) {
  if (typeof content !== "string") {
    return "";
  }

  return content
    .replace(/\u0000/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function decodeTextBuffer(buffer) {
  const detected = jschardet.detect(buffer);
  const rawEncoding =
    detected && typeof detected.encoding === "string"
      ? detected.encoding.toLowerCase()
      : "utf-8";

  let targetEncoding = "utf-8";

  if (
    rawEncoding.includes("euc-kr") ||
    rawEncoding.includes("cp949") ||
    rawEncoding.includes("ks_c_5601")
  ) {
    targetEncoding = "cp949";
  } else if (rawEncoding.includes("utf-16le")) {
    targetEncoding = "utf16-le";
  } else if (rawEncoding.includes("utf-16be")) {
    targetEncoding = "utf16-be";
  } else if (iconv.encodingExists(rawEncoding)) {
    targetEncoding = rawEncoding;
  }

  try {
    return iconv.decode(buffer, targetEncoding);
  } catch {
    return buffer.toString("utf8");
  }
}

function extractTextFromZipXml(xml, options = {}) {
  const {
    paragraphClosePattern = /<\/w:p>/g,
    lineBreakPattern = /<w:br[^>]*\/>/g,
    tabPattern = /<w:tab[^>]*\/>/g,
  } = options;

  const plainText = xml
    .replace(paragraphClosePattern, "\n")
    .replace(lineBreakPattern, "\n")
    .replace(tabPattern, "\t")
    .replace(/<[^>]+>/g, "");

  return decodeXmlEntities(plainText);
}

function extractTextFromDocxBuffer(buffer) {
  const zip = new AdmZip(buffer);
  const documentEntry = zip.getEntry("word/document.xml");

  if (!documentEntry) {
    throw new Error("docx 파일에서 본문을 찾을 수 없습니다.");
  }

  const xml = documentEntry.getData().toString("utf8");
  return extractTextFromZipXml(xml);
}

function extractTextFromHwpxBuffer(buffer) {
  const zip = new AdmZip(buffer);
  const sectionEntries = zip
    .getEntries()
    .filter((entry) => /Contents\/section\d+\.xml$/i.test(entry.entryName))
    .sort((a, b) => a.entryName.localeCompare(b.entryName, undefined, { numeric: true }));

  if (sectionEntries.length === 0) {
    throw new Error("hwpx 파일에서 본문 섹션을 찾을 수 없습니다.");
  }

  const mergedText = sectionEntries
    .map((entry) => {
      const xml = entry.getData().toString("utf8");

      return extractTextFromZipXml(xml, {
        paragraphClosePattern: /<\/hp:p>/g,
        lineBreakPattern: /<hp:lineBreak[^>]*\/>/g,
        tabPattern: /<hp:tab[^>]*\/>/g,
      });
    })
    .join("\n\n");

  return mergedText;
}

function buildStoryImportResult(fileName, rawContent) {
  const normalizedContent = normalizeImportedStoryContent(rawContent);

  if (!normalizedContent) {
    throw new Error("파일에서 읽을 수 있는 텍스트가 없습니다.");
  }

  const limitedContent =
    normalizedContent.length > MAX_STORY_IMPORT_CONTENT_CHARS
      ? normalizedContent.slice(0, MAX_STORY_IMPORT_CONTENT_CHARS)
      : normalizedContent;

  const fileBaseName = path.basename(fileName, path.extname(fileName)).trim();
  const firstLine =
    limitedContent
      .split("\n")
      .map((line) => line.trim())
      .find(Boolean) || "";
  const suggestedTitle = (fileBaseName || firstLine || "업로드 작품").slice(0, 120);

  return {
    suggested_title: suggestedTitle,
    content: limitedContent,
  };
}

function normalizeStoryCategory(category) {
  if (category === "short") {
    return "short_story";
  }

  if (category === "long") {
    return "long_story";
  }

  if (category === "synopsis" || category === "short_story" || category === "long_story") {
    return category;
  }

  return null;
}

function toArray(value) {
  if (Array.isArray(value)) {
    return value;
  }

  if (value === undefined || value === null) {
    return [];
  }

  return [value];
}

function sortSubcategories(subcategories) {
  return [...subcategories].sort((a, b) => {
    if (a.parent_category === b.parent_category) {
      return (a.sort_order || 0) - (b.sort_order || 0);
    }

    return a.parent_category.localeCompare(b.parent_category);
  });
}

function sortStoriesByCreatedAt(stories, order = "newest") {
  return [...stories].sort((a, b) => {
    const aTime = new Date(a.created_at).getTime();
    const bTime = new Date(b.created_at).getTime();

    if (order === "oldest") {
      return aTime - bTime;
    }

    return bTime - aTime;
  });
}

function sortMessagesByCreatedAtAsc(messages) {
  return [...messages].sort((a, b) => {
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });
}

function isAdminRequest(req) {
  return req.get("x-admin-session") === "authenticated";
}

function isActiveBan(ban, nowTimestamp = Date.now()) {
  if (!ban || !ban.client_id) {
    return false;
  }

  if (ban.ban_type === "permanent") {
    return true;
  }

  if (!ban.banned_until) {
    return false;
  }

  return new Date(ban.banned_until).getTime() > nowTimestamp;
}

function getActiveBanForClient(bans, clientId) {
  const nowTimestamp = Date.now();
  const clientBans = [...bans]
    .filter((ban) => ban.client_id === clientId)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return clientBans.find((ban) => isActiveBan(ban, nowTimestamp)) || null;
}

function formatTemporaryBanMessage(bannedUntil) {
  const remainingMs = new Date(bannedUntil).getTime() - Date.now();
  const remainingMinutes = Math.max(1, Math.ceil(remainingMs / (60 * 1000)));
  return `채팅이 제한되었습니다. 약 ${remainingMinutes}분 뒤에 다시 시도해주세요.`;
}

function toKstPseudoDate(date = new Date()) {
  return new Date(date.getTime() + KST_OFFSET_MS);
}

function toDateKey(date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getKstDailyResetKey(referenceDate = new Date()) {
  const kstNow = toKstPseudoDate(referenceDate);
  const hour = kstNow.getUTCHours();

  if (hour < 9) {
    kstNow.setUTCDate(kstNow.getUTCDate() - 1);
  }

  return toDateKey(kstNow);
}

function getNextKst9amDelayMs(referenceDate = new Date()) {
  const now = referenceDate;
  const kstNow = toKstPseudoDate(now);
  const nextKst9 = new Date(kstNow);
  nextKst9.setUTCHours(9, 0, 0, 0);

  if (kstNow.getTime() >= nextKst9.getTime()) {
    nextKst9.setUTCDate(nextKst9.getUTCDate() + 1);
  }

  const nextUtcMillis = nextKst9.getTime() - KST_OFFSET_MS;
  return Math.max(1000, nextUtcMillis - now.getTime());
}

function ensureFreeBoardMeta(store) {
  if (!store.free_board_meta || typeof store.free_board_meta !== "object") {
    store.free_board_meta = {
      last_daily_reset_key: null,
      last_cleared_at: null,
      last_cleared_reason: null,
    };
  }

  return store.free_board_meta;
}

function clearFreeBoardMessages(store, reason, options = {}) {
  const { dailyResetKey } = options;
  const removedCount = Array.isArray(store.free_board_messages) ? store.free_board_messages.length : 0;
  store.free_board_messages = [];

  const meta = ensureFreeBoardMeta(store);
  meta.last_cleared_at = nowIso();
  meta.last_cleared_reason = reason;

  if (dailyResetKey) {
    meta.last_daily_reset_key = dailyResetKey;
  }

  return removedCount;
}

function ensureDailyFreeBoardReset(store, referenceDate = new Date()) {
  const targetKey = getKstDailyResetKey(referenceDate);
  const meta = ensureFreeBoardMeta(store);

  if (!meta.last_daily_reset_key) {
    meta.last_daily_reset_key = targetKey;
    return "initialized";
  }

  if (meta.last_daily_reset_key === targetKey) {
    return "none";
  }

  clearFreeBoardMessages(store, "daily-9am-kst", { dailyResetKey: targetKey });
  return "reset";
}

function runDailyFreeBoardReset() {
  const store = readStore();
  const resetState = ensureDailyFreeBoardReset(store);

  if (resetState !== "none") {
    writeStore(store);
  }

  if (resetState === "reset") {
    console.log("Free board messages were reset by daily KST 9AM rule.");
  }
}

function scheduleNextDailyFreeBoardReset() {
  const delayMs = getNextKst9amDelayMs();

  setTimeout(() => {
    runDailyFreeBoardReset();
    scheduleNextDailyFreeBoardReset();
  }, delayMs);
}

function initializeFreeBoardDailyReset() {
  runDailyFreeBoardReset();
  scheduleNextDailyFreeBoardReset();
}

ensureStoreFile();
initializeFreeBoardDailyReset();

app.get("/favicon.ico", (req, res) => {
  res.redirect(302, "/icon.svg");
});

app.get("/api/health", (req, res) => {
  res.status(200).json({ ok: true });
});

app.get("/api/profile", (req, res) => {
  const store = readStore();
  res.status(200).json(store.profile || null);
});

app.post("/api/profile/image", (req, res) => {
  const uploaded = parseProfileImageDataUrl(req.body?.data_url);

  if (!uploaded) {
    res.status(400).json({
      message: "지원하지 않는 이미지 형식입니다. jpeg, png, webp, gif 파일을 사용해 주세요.",
    });
    return;
  }

  if (uploaded.buffer.length > MAX_PROFILE_IMAGE_SIZE_BYTES) {
    res.status(400).json({ message: "이미지 크기는 2MB 이하여야 합니다." });
    return;
  }

  const fileName = `${Date.now()}-${randomUUID()}.${uploaded.extension}`;
  const filePath = path.join(PROFILE_UPLOAD_DIR, fileName);

  try {
    fs.writeFileSync(filePath, uploaded.buffer);
  } catch {
    res.status(500).json({ message: "이미지 파일 저장 중 오류가 발생했습니다." });
    return;
  }

  res.status(201).json({
    url: `${PROFILE_UPLOAD_URL_PREFIX}${fileName}`,
  });
});

app.put("/api/profile", (req, res) => {
  const store = readStore();
  const now = nowIso();

  const currentProfile = store.profile || {
    id: randomUUID(),
    created_at: now,
  };

  const nextProfileImageUrl = parseNullableString(req.body.profile_image_url);

  if (nextProfileImageUrl && nextProfileImageUrl.startsWith("data:")) {
    res.status(400).json({ message: "이미지는 URL 또는 업로드 경로만 저장할 수 있습니다." });
    return;
  }

  const currentProfileImageUrl = parseNullableString(currentProfile.profile_image_url);

  if (currentProfileImageUrl && currentProfileImageUrl !== nextProfileImageUrl) {
    deleteProfileUploadByUrl(currentProfileImageUrl);
  }

  const nextProfile = {
    id: currentProfile.id,
    writer_name: parseNullableString(req.body.writer_name),
    profile_text: typeof req.body.profile_text === "string" ? req.body.profile_text : "",
    profile_image_url: nextProfileImageUrl,
    created_at: currentProfile.created_at || now,
    updated_at: now,
  };

  store.profile = nextProfile;
  writeStore(store);

  res.status(200).json(nextProfile);
});

app.get("/api/subcategories", (req, res) => {
  const store = readStore();
  const parentCategory = typeof req.query.parent_category === "string" ? req.query.parent_category : null;

  let subcategories = sortSubcategories(store.subcategories);

  if (parentCategory === "short" || parentCategory === "long") {
    subcategories = subcategories.filter((subcategory) => subcategory.parent_category === parentCategory);
  }

  res.status(200).json(subcategories);
});

app.get("/api/subcategories/:id", (req, res) => {
  const store = readStore();
  const subcategory = store.subcategories.find((item) => item.id === req.params.id) || null;

  if (!subcategory) {
    res.status(404).json({ message: "세부 카테고리를 찾을 수 없습니다." });
    return;
  }

  res.status(200).json(subcategory);
});

app.post("/api/subcategories", (req, res) => {
  const name = typeof req.body.name === "string" ? req.body.name.trim() : "";
  const parentCategory = req.body.parent_category;

  if (!name) {
    res.status(400).json({ message: "카테고리명은 필수입니다." });
    return;
  }

  if (parentCategory !== "short" && parentCategory !== "long") {
    res.status(400).json({ message: "상위 카테고리는 short 또는 long 이어야 합니다." });
    return;
  }

  const store = readStore();
  const maxSortOrder = store.subcategories
    .filter((subcategory) => subcategory.parent_category === parentCategory)
    .reduce((max, subcategory) => Math.max(max, Number(subcategory.sort_order || 0)), -1);

  const now = nowIso();
  const nextSubcategory = {
    id: randomUUID(),
    name,
    parent_category: parentCategory,
    sort_order:
      typeof req.body.sort_order === "number" ? req.body.sort_order : maxSortOrder + 1,
    created_at: now,
  };

  store.subcategories.push(nextSubcategory);
  store.subcategories = sortSubcategories(store.subcategories);
  writeStore(store);

  res.status(201).json(nextSubcategory);
});

app.put("/api/subcategories/:id", (req, res) => {
  const store = readStore();
  const index = store.subcategories.findIndex((item) => item.id === req.params.id);

  if (index < 0) {
    res.status(404).json({ message: "세부 카테고리를 찾을 수 없습니다." });
    return;
  }

  const current = store.subcategories[index];
  const nextName = typeof req.body.name === "string" ? req.body.name.trim() : current.name;
  const nextParentCategory =
    req.body.parent_category === "short" || req.body.parent_category === "long"
      ? req.body.parent_category
      : current.parent_category;
  const nextSortOrder =
    typeof req.body.sort_order === "number" ? req.body.sort_order : current.sort_order;

  if (!nextName) {
    res.status(400).json({ message: "카테고리명은 비어 있을 수 없습니다." });
    return;
  }

  const updated = {
    ...current,
    name: nextName,
    parent_category: nextParentCategory,
    sort_order: nextSortOrder,
  };

  store.subcategories[index] = updated;
  store.subcategories = sortSubcategories(store.subcategories);
  writeStore(store);

  res.status(200).json(updated);
});

app.delete("/api/subcategories/:id", (req, res) => {
  const store = readStore();
  const existing = store.subcategories.find((item) => item.id === req.params.id);

  if (!existing) {
    res.status(404).json({ message: "세부 카테고리를 찾을 수 없습니다." });
    return;
  }

  store.subcategories = store.subcategories.filter((item) => item.id !== req.params.id);
  store.stories = store.stories.map((story) => {
    if (story.subcategory_id === req.params.id) {
      return { ...story, subcategory_id: null, updated_at: nowIso() };
    }

    return story;
  });

  writeStore(store);
  res.status(204).send();
});

app.get("/api/stories", (req, res) => {
  const store = readStore();
  const rawCategories = toArray(req.query.category)
    .flatMap((value) => String(value).split(","))
    .map((value) => value.trim())
    .filter(Boolean);
  const normalizedCategories = rawCategories
    .map((category) => normalizeStoryCategory(category))
    .filter(Boolean);
  const subcategoryId = typeof req.query.subcategory_id === "string" ? req.query.subcategory_id : null;
  const sortOrder = req.query.sort === "oldest" ? "oldest" : "newest";

  let stories = [...store.stories];

  if (normalizedCategories.length > 0) {
    stories = stories.filter((story) => normalizedCategories.includes(normalizeStoryCategory(story.category)));
  }

  if (subcategoryId) {
    stories = stories.filter((story) => story.subcategory_id === subcategoryId);
  }

  stories = sortStoriesByCreatedAt(stories, sortOrder);
  res.status(200).json(stories);
});

app.get("/api/stories/:id", (req, res) => {
  const store = readStore();
  const story = store.stories.find((item) => item.id === req.params.id) || null;

  if (!story) {
    res.status(404).json({ message: "작품을 찾을 수 없습니다." });
    return;
  }

  res.status(200).json(story);
});

app.post("/api/stories/import-file", (req, res) => {
  STORY_FILE_UPLOAD.single("file")(req, res, (uploadError) => {
    if (uploadError) {
      if (uploadError instanceof multer.MulterError && uploadError.code === "LIMIT_FILE_SIZE") {
        res.status(400).json({
          message: "파일 크기는 10MB 이하여야 합니다.",
        });
        return;
      }

      res.status(400).json({ message: "파일 업로드 중 오류가 발생했습니다." });
      return;
    }

    if (!req.file || !req.file.buffer) {
      res.status(400).json({ message: "업로드된 파일이 없습니다." });
      return;
    }

    const originalName = req.file.originalname || "story-file";
    const extension = path.extname(originalName).toLowerCase();
    let rawContent = "";

    try {
      if ([".txt", ".md", ".markdown"].includes(extension)) {
        rawContent = decodeTextBuffer(req.file.buffer);
      } else if (extension === ".docx") {
        rawContent = extractTextFromDocxBuffer(req.file.buffer);
      } else if (extension === ".hwpx") {
        rawContent = extractTextFromHwpxBuffer(req.file.buffer);
      } else if (extension === ".hwp") {
        res.status(400).json({
          message:
            "hwp 파일은 직접 변환이 어려워요. 한글에서 hwpx 또는 txt 형식으로 저장한 뒤 업로드해 주세요.",
        });
        return;
      } else {
        res.status(400).json({
          message: "지원하지 않는 파일 형식입니다. hwpx, docx, txt, md 파일만 업로드할 수 있습니다.",
        });
        return;
      }

      const imported = buildStoryImportResult(originalName, rawContent);

      res.status(200).json({
        ...imported,
        file_name: originalName,
        file_extension: extension || "unknown",
      });
    } catch (error) {
      res.status(400).json({
        message: error && error.message ? error.message : "파일 내용을 변환하지 못했습니다.",
      });
    }
  });
});

app.post("/api/stories", (req, res) => {
  const title = typeof req.body.title === "string" ? req.body.title.trim() : "";
  const content = typeof req.body.content === "string" ? req.body.content.trim() : "";
  const category = normalizeStoryCategory(req.body.category);

  if (!title || !content) {
    res.status(400).json({ message: "제목과 내용은 필수입니다." });
    return;
  }

  if (!category) {
    res.status(400).json({ message: "카테고리가 올바르지 않습니다." });
    return;
  }

  const now = nowIso();
  const story = {
    id: randomUUID(),
    title,
    content,
    category,
    subcategory_id:
      category === "synopsis" ? null : parseNullableString(req.body.subcategory_id),
    thumbnail_url: parseNullableString(req.body.thumbnail_url),
    cover_image_url:
      parseNullableString(req.body.cover_image_url) || parseNullableString(req.body.thumbnail_url),
    images: Array.isArray(req.body.images) ? req.body.images : [],
    is_published:
      typeof req.body.is_published === "boolean" ? req.body.is_published : true,
    created_at: now,
    updated_at: now,
  };

  const store = readStore();
  store.stories.push(story);
  writeStore(store);

  res.status(201).json(story);
});

app.put("/api/stories/:id", (req, res) => {
  const store = readStore();
  const index = store.stories.findIndex((item) => item.id === req.params.id);

  if (index < 0) {
    res.status(404).json({ message: "작품을 찾을 수 없습니다." });
    return;
  }

  const current = store.stories[index];
  const nextCategory = req.body.category
    ? normalizeStoryCategory(req.body.category)
    : normalizeStoryCategory(current.category);

  if (!nextCategory) {
    res.status(400).json({ message: "카테고리가 올바르지 않습니다." });
    return;
  }

  const updated = {
    ...current,
    title: typeof req.body.title === "string" ? req.body.title.trim() : current.title,
    content: typeof req.body.content === "string" ? req.body.content : current.content,
    category: nextCategory,
    subcategory_id:
      nextCategory === "synopsis"
        ? null
        : req.body.subcategory_id === undefined
          ? current.subcategory_id
          : parseNullableString(req.body.subcategory_id),
    thumbnail_url:
      req.body.thumbnail_url === undefined
        ? current.thumbnail_url
        : parseNullableString(req.body.thumbnail_url),
    cover_image_url:
      req.body.cover_image_url === undefined
        ? current.cover_image_url
        : parseNullableString(req.body.cover_image_url),
    images: Array.isArray(req.body.images) ? req.body.images : current.images,
    is_published:
      typeof req.body.is_published === "boolean"
        ? req.body.is_published
        : current.is_published,
    updated_at: nowIso(),
  };

  store.stories[index] = updated;
  writeStore(store);

  res.status(200).json(updated);
});

app.delete("/api/stories/:id", (req, res) => {
  const store = readStore();
  const exists = store.stories.some((item) => item.id === req.params.id);

  if (!exists) {
    res.status(404).json({ message: "작품을 찾을 수 없습니다." });
    return;
  }

  store.stories = store.stories.filter((item) => item.id !== req.params.id);
  store.comments = store.comments.filter((comment) => comment.story_id !== req.params.id);
  writeStore(store);

  res.status(204).send();
});

app.get("/api/comments", (req, res) => {
  const store = readStore();
  const storyId = typeof req.query.story_id === "string" ? req.query.story_id : null;

  let comments = [...store.comments];

  if (storyId) {
    comments = comments.filter((comment) => comment.story_id === storyId);
  }

  comments.sort((a, b) => {
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });

  res.status(200).json(comments);
});

app.post("/api/comments", (req, res) => {
  const storyId = parseNullableString(req.body.story_id);
  const authorName = parseNullableString(req.body.author_name);
  const content = parseNullableString(req.body.content);

  if (!storyId || !authorName || !content) {
    res.status(400).json({ message: "story_id, author_name, content는 필수입니다." });
    return;
  }

  const store = readStore();
  const storyExists = store.stories.some((story) => story.id === storyId);

  if (!storyExists) {
    res.status(404).json({ message: "댓글을 등록할 작품을 찾을 수 없습니다." });
    return;
  }

  const comment = {
    id: randomUUID(),
    story_id: storyId,
    author_name: authorName,
    content,
    created_at: nowIso(),
  };

  store.comments.push(comment);
  writeStore(store);

  res.status(201).json(comment);
});

app.get("/api/free-board/messages", (req, res) => {
  const store = readStore();
  const resetState = ensureDailyFreeBoardReset(store);

  if (resetState !== "none") {
    writeStore(store);
  }

  const messages = sortMessagesByCreatedAtAsc(store.free_board_messages);
  res.status(200).json(messages);
});

app.get("/api/free-board/stream", (req, res) => {
  res.status(200);
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  if (typeof res.flushHeaders === "function") {
    res.flushHeaders();
  }

  res.write(": connected\n\n");

  const keepAliveTimer = setInterval(() => {
    res.write(": keep-alive\n\n");
  }, 20000);

  const client = { response: res, keepAliveTimer };
  freeBoardStreams.add(client);

  req.on("close", () => {
    clearInterval(keepAliveTimer);
    freeBoardStreams.delete(client);
  });
});

app.post("/api/free-board/messages", (req, res) => {
  const clientId = parseNullableString(req.body.client_id);
  const content = parseNullableString(req.body.content);
  const adminRequest = isAdminRequest(req);
  const authorName = parseNullableString(req.body.author_name) || (adminRequest ? "관리자" : "익명");

  if (!clientId) {
    res.status(400).json({ message: "사용자 식별값이 필요합니다." });
    return;
  }

  if (!content) {
    res.status(400).json({ message: "내용은 필수입니다." });
    return;
  }

  const store = readStore();
  const resetState = ensureDailyFreeBoardReset(store);

  if (resetState !== "none") {
    writeStore(store);
  }

  if (!adminRequest) {
    const activeBan = getActiveBanForClient(store.free_board_bans || [], clientId);

    if (activeBan) {
      const message =
        activeBan.ban_type === "permanent"
          ? "영구적으로 채팅이 금지된 사용자입니다."
          : formatTemporaryBanMessage(activeBan.banned_until);

      res.status(403).json({
        message,
        ban: {
          ban_type: activeBan.ban_type,
          banned_until: activeBan.banned_until,
        },
      });
      return;
    }
  }

  const message = {
    id: randomUUID(),
    client_id: clientId.slice(0, 120),
    author_name: authorName.slice(0, 20),
    content: content.slice(0, 500),
    is_admin: adminRequest,
    created_at: nowIso(),
  };

  store.free_board_messages.push(message);
  writeStore(store);

  broadcastFreeBoardMessage(message);

  res.status(201).json(message);
});

app.post("/api/free-board/messages/clear", (req, res) => {
  if (!isAdminRequest(req)) {
    res.status(403).json({ message: "관리자 권한이 필요합니다." });
    return;
  }

  const store = readStore();
  const clearedCount = clearFreeBoardMessages(store, "admin-manual");
  writeStore(store);

  res.status(200).json({
    message: "채팅 내역을 삭제했습니다.",
    cleared_count: clearedCount,
  });
});

app.get("/api/free-board/bans", (req, res) => {
  if (!isAdminRequest(req)) {
    res.status(403).json({ message: "관리자 권한이 필요합니다." });
    return;
  }

  const store = readStore();
  const nowTimestamp = Date.now();
  const bans = [...(store.free_board_bans || [])]
    .filter((ban) => isActiveBan(ban, nowTimestamp))
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  res.status(200).json(bans);
});

app.post("/api/free-board/bans", (req, res) => {
  if (!isAdminRequest(req)) {
    res.status(403).json({ message: "관리자 권한이 필요합니다." });
    return;
  }

  const clientId = parseNullableString(req.body.client_id);
  const authorNameSnapshot = parseNullableString(req.body.author_name);
  const reason = parseNullableString(req.body.reason);
  const banType = req.body.ban_type === "permanent" ? "permanent" : "temporary";
  const durationMinutes = Number(req.body.duration_minutes || 0);

  if (!clientId) {
    res.status(400).json({ message: "차단할 사용자 식별값이 필요합니다." });
    return;
  }

  if (banType === "temporary" && (!Number.isFinite(durationMinutes) || durationMinutes <= 0)) {
    res.status(400).json({ message: "시간제 금지는 duration_minutes가 필요합니다." });
    return;
  }

  const createdAt = nowIso();
  const bannedUntil =
    banType === "permanent"
      ? null
      : new Date(Date.now() + durationMinutes * 60 * 1000).toISOString();

  const ban = {
    id: randomUUID(),
    client_id: clientId.slice(0, 120),
    author_name_snapshot: authorNameSnapshot ? authorNameSnapshot.slice(0, 20) : null,
    ban_type: banType,
    banned_until: bannedUntil,
    reason,
    created_at: createdAt,
    created_by: "admin",
  };

  const store = readStore();
  store.free_board_bans = (store.free_board_bans || []).filter((item) => item.client_id !== ban.client_id);
  store.free_board_bans.push(ban);
  writeStore(store);

  res.status(201).json(ban);
});

app.delete("/api/free-board/bans/:clientId", (req, res) => {
  if (!isAdminRequest(req)) {
    res.status(403).json({ message: "관리자 권한이 필요합니다." });
    return;
  }

  const store = readStore();
  const targetClientId = req.params.clientId;
  const beforeCount = (store.free_board_bans || []).length;

  store.free_board_bans = (store.free_board_bans || []).filter((ban) => ban.client_id !== targetClientId);

  if (store.free_board_bans.length === beforeCount) {
    res.status(404).json({ message: "해당 사용자의 채팅 금지 정보가 없습니다." });
    return;
  }

  writeStore(store);
  res.status(204).send();
});

function startServer(port, host) {
  const server = app.listen(port, host, () => {
    console.log(`Backend server running on http://${host}:${port}`);
  });

  server.on("error", (error) => {
    if (error.code === "EADDRINUSE") {
      const nextPort = Number(port) + 1;
      console.warn(`Port ${port} is in use. Retrying on ${nextPort}...`);
      startServer(nextPort, host);
      return;
    }

    throw error;
  });

  return server;
}

let nextRouteRegistered = false;

async function bootstrap() {
  await nextApp.prepare();

  if (!nextRouteRegistered) {
    app.use((req, res, nextMiddleware) => {
      const isApiRequest = req.path === "/api" || req.path.startsWith("/api/");
      const isFrontendAdminRoute = req.path.startsWith("/api/admin/");

      if (isApiRequest && !isFrontendAdminRoute) {
        res.status(404).json({ message: "찾을 수 없습니다." });
        return;
      }

      nextMiddleware();
    });

    app.use((req, res) => {
      handleNextRequest(req, res);
    });
    nextRouteRegistered = true;
  }

  startServer(Number(PORT), HOST);
}

bootstrap().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});

module.exports = app;
