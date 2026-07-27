import express from "express";
import cors from "cors";
import http from "http";
import { WebSocketServer, WebSocket } from "ws";
import { pool, initDb } from "./db.js";

const app = express();
const server = http.createServer(app);

// Use cors and JSON parser
app.use(cors({
  origin: "*",
  methods: "GET, HEAD, POST, PATCH, PUT, DELETE, OPTIONS",
  allowedHeaders: "Content-Type, X-Admin-Password, Authorization",
}));
app.use(express.json());

// Helper for generating custom UUID if not provided
function getUUID() {
  return crypto.randomUUID();
}

// Middleware: Admin password authorization check
function requireAdmin(req, res, next) {
  const passwordHeader = req.headers["x-admin-password"] || req.headers["authorization"];
  const expectedPassword = process.env.ADMIN_PASSWORD || "maid2024";

  if (passwordHeader === expectedPassword) {
    next();
  } else {
    res.status(401).json({ error: "Unauthorized access" });
  }
}

// ==========================================
// REST API ENDPOINTS
// ==========================================

// POST /api/admin/login
app.post("/api/admin/login", async (req, res) => {
  try {
    const { password } = req.body;
    const expectedPassword = process.env.ADMIN_PASSWORD || "maid2024";

    if (password === expectedPassword) {
      res.json({ success: true, token: expectedPassword });
    } else {
      res.status(401).json({ error: "Unauthorized access" });
    }
  } catch (err) {
    res.status(400).json({ error: "Bad request" });
  }
});

// GET /api/health
app.get("/api/health", async (req, res) => {
  try {
    // Check db connection
    await pool.query("SELECT 1");
    res.json({ ok: true, database: "postgresql" });
  } catch (err) {
    res.status(500).json({ ok: false, error: "Database connection failed" });
  }
});

// GET /api/rooms
app.get("/api/rooms", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM rooms ORDER BY created_date DESC");
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/rooms/:id
app.get("/api/rooms/:id", async (req, res) => {
  const roomId = req.params.id;
  try {
    const result = await pool.query("SELECT * FROM rooms WHERE id = $1", [roomId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Room not found" });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/rooms-with-guests (Atomic Unified API, Requires Admin)
app.post("/api/rooms-with-guests", requireAdmin, async (req, res) => {
  const { roomName, guests } = req.body;

  if (!roomName) {
    return res.status(400).json({ error: "roomName is required" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // 1. Create Room
    const roomId = getUUID();
    const roomPhase = "WAITING";
    const createdDate = new Date();

    const roomRes = await client.query(
      "INSERT INTO rooms (id, name, phase, created_date) VALUES ($1, $2, $3, $4) RETURNING *",
      [roomId, roomName, roomPhase, createdDate]
    );
    const roomRow = roomRes.rows[0];

    // 2. Register Guests
    const guestsResponse = [];
    const guestsArray = Array.isArray(guests) ? guests : [];

    // Dynamically resolve the protocol and host for the guestUrl
    const protocol = req.headers["x-forwarded-proto"] || "http";
    const host = req.headers.host || "localhost:8787";

    for (const guestName of guestsArray) {
      if (!guestName || typeof guestName !== "string") continue;

      const guestId = getUUID();
      const sessionToken = getUUID();

      const guestRes = await client.query(
        "INSERT INTO guest_users (id, name, room_id, session_token, is_active, is_online, created_date) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *",
        [guestId, guestName, roomId, sessionToken, true, false, createdDate]
      );
      const row = guestRes.rows[0];

      guestsResponse.push({
        id: row.id,
        name: row.name,
        roomId: row.room_id,
        sessionToken: row.session_token,
        isActive: row.is_active,
        isOnline: row.is_online,
        lastSeen: row.last_seen,
        created_date: row.created_date,
        guestUrl: `${protocol}://${host}/guest?token=${sessionToken}`,
      });
    }

    await client.query("COMMIT");

    res.status(201).json({
      ok: true,
      room: {
        id: roomRow.id,
        name: roomRow.name,
        phase: roomRow.phase,
        created_date: roomRow.created_date,
      },
      guests: guestsResponse,
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  } finally {
    client.release();
  }
});

// POST /api/rooms (Requires Admin)
app.post("/api/rooms", requireAdmin, async (req, res) => {
  const { id, name, phase } = req.body;

  if (!name) {
    return res.status(400).json({ error: "name is required" });
  }

  const roomId = id || getUUID();
  const roomPhase = phase || "WAITING";
  const createdDate = new Date();

  try {
    const result = await pool.query(
      "INSERT INTO rooms (id, name, phase, created_date) VALUES ($1, $2, $3, $4) RETURNING *",
      [roomId, name, roomPhase, createdDate]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /api/rooms/:id (Requires Admin)
app.patch("/api/rooms/:id", requireAdmin, async (req, res) => {
  const roomId = req.params.id;
  const { name, phase } = req.body;

  try {
    const currentRes = await pool.query("SELECT * FROM rooms WHERE id = $1", [roomId]);
    if (currentRes.rows.length === 0) {
      return res.status(404).json({ error: "Room not found" });
    }
    const current = currentRes.rows[0];

    const newName = name !== undefined ? name : current.name;
    const newPhase = phase !== undefined ? phase : current.phase;

    const result = await pool.query(
      "UPDATE rooms SET name = $1, phase = $2 WHERE id = $3 RETURNING *",
      [newName, newPhase, roomId]
    );

    // Broadcast phase update via Active WebSockets
    if (phase !== undefined) {
      broadcastToRoom(roomId, { type: "PHASE_UPDATE", phase: newPhase });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/rooms/:id (Requires Admin)
app.delete("/api/rooms/:id", requireAdmin, async (req, res) => {
  const roomId = req.params.id;
  try {
    // guest_users are ON DELETE CASCADE
    await pool.query("DELETE FROM rooms WHERE id = $1", [roomId]);
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/guests
app.get("/api/guests", async (req, res) => {
  const { sessionToken, roomId } = req.query;

  // Authentication logic:
  // If no params (full list) -> require admin authentication
  if (!sessionToken && !roomId) {
    const authHeader = req.headers["x-admin-password"] || req.headers["authorization"];
    const expectedPassword = process.env.ADMIN_PASSWORD || "maid2024";
    if (authHeader !== expectedPassword) {
      return res.status(401).json({ error: "Unauthorized access" });
    }
  }

  try {
    let result;
    if (sessionToken) {
      result = await pool.query("SELECT * FROM guest_users WHERE session_token = $1 ORDER BY created_date DESC", [sessionToken]);
    } else if (roomId) {
      result = await pool.query("SELECT * FROM guest_users WHERE room_id = $1 ORDER BY created_date DESC", [roomId]);
    } else {
      result = await pool.query("SELECT * FROM guest_users ORDER BY created_date DESC");
    }

    const enriched = result.rows.map(row => ({
      id: row.id,
      name: row.name,
      roomId: row.room_id,
      sessionToken: row.session_token,
      isActive: row.is_active,
      isOnline: row.is_online,
      lastSeen: row.last_seen,
      created_date: row.created_date,
    }));

    res.json(enriched);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/guests (Requires Admin)
app.post("/api/guests", requireAdmin, async (req, res) => {
  const { id, name, roomId, sessionToken, isActive, isOnline } = req.body;
  const guestId = id || getUUID();
  const createdDate = new Date();
  const activeVal = isActive !== false;
  const onlineVal = isOnline === true;

  try {
    const result = await pool.query(
      "INSERT INTO guest_users (id, name, room_id, session_token, is_active, is_online, created_date) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *",
      [guestId, name, roomId, sessionToken, activeVal, onlineVal, createdDate]
    );

    const row = result.rows[0];
    res.status(201).json({
      id: row.id,
      name: row.name,
      roomId: row.room_id,
      sessionToken: row.session_token,
      isActive: row.is_active,
      isOnline: row.is_online,
      lastSeen: row.last_seen,
      created_date: row.created_date,
    });
  } catch (err) {
    console.error(err);
    if (err.code === "23505") { // Unique constraint violation in pg
      res.status(500).json({ error: "Unique constraint failed" });
    } else {
      res.status(500).json({ error: "Internal server error" });
    }
  }
});

// PATCH /api/guests/:id (Requires Admin or public self-updates)
app.patch("/api/guests/:id", async (req, res) => {
  const guestId = req.params.id;
  const { name, roomId, sessionToken, isActive, isOnline, lastSeen } = req.body;

  // Security check: Only allow anonymous patch if header is empty (which indicates self-update client)
  // or requireAdmin if they are updating restricted fields. To align with API.md / previous Worker.
  const hasAdminHeader = req.headers["x-admin-password"] || req.headers["authorization"];
  if (!hasAdminHeader) {
    // If guest is updating themselves, typically online status etc.
    // In this stack, WS handles online updates. If REST does it, we allow self patches.
  } else {
    // If they have admin header, verify it.
    const expectedPassword = process.env.ADMIN_PASSWORD || "maid2024";
    if (hasAdminHeader !== expectedPassword) {
      return res.status(401).json({ error: "Unauthorized access" });
    }
  }

  try {
    const currentRes = await pool.query("SELECT * FROM guest_users WHERE id = $1", [guestId]);
    if (currentRes.rows.length === 0) {
      return res.status(404).json({ error: "Guest not found" });
    }
    const current = currentRes.rows[0];

    const newName = name !== undefined ? name : current.name;
    const newRoomId = roomId !== undefined ? roomId : current.room_id;
    const newSessionToken = sessionToken !== undefined ? sessionToken : current.session_token;
    const newIsActive = isActive !== undefined ? isActive : current.is_active;
    const newIsOnline = isOnline !== undefined ? isOnline : current.is_online;
    const newLastSeen = lastSeen !== undefined ? lastSeen : current.last_seen;

    const result = await pool.query(
      "UPDATE guest_users SET name = $1, room_id = $2, session_token = $3, is_active = $4, is_online = $5, last_seen = $6 WHERE id = $7 RETURNING *",
      [newName, newRoomId, newSessionToken, newIsActive, newIsOnline, newLastSeen, guestId]
    );

    const row = result.rows[0];

    // Broadcast online status to the room
    broadcastToRoom(newRoomId, { type: "GUEST_UPDATE", guestId, isOnline: newIsOnline });

    res.json({
      id: row.id,
      name: row.name,
      roomId: row.room_id,
      sessionToken: row.session_token,
      isActive: row.is_active,
      isOnline: row.is_online,
      lastSeen: row.last_seen,
      created_date: row.created_date,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/guests/:id (Requires Admin)
app.delete("/api/guests/:id", requireAdmin, async (req, res) => {
  const guestId = req.params.id;
  try {
    await pool.query("DELETE FROM guest_users WHERE id = $1", [guestId]);
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/menu-items
app.get("/api/menu-items", async (req, res) => {
  const limit = parseInt(req.query.limit, 10) || 100;
  try {
    const result = await pool.query("SELECT * FROM menu_items ORDER BY order_index ASC, created_date ASC LIMIT $1", [limit]);
    const mapped = result.rows.map(row => ({
      id: row.id,
      name: row.name,
      price: Number(row.price),
      category: row.category,
      description: row.description,
      imageUrl: row.image_url,
      order: row.order_index,
      created_date: row.created_date,
    }));
    res.json(mapped);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/menu-items (Requires Admin)
app.post("/api/menu-items", requireAdmin, async (req, res) => {
  const { id, name, price, category, description, imageUrl, order } = req.body;
  const itemId = id || getUUID();
  const createdDate = new Date();

  try {
    const result = await pool.query(
      "INSERT INTO menu_items (id, name, price, category, description, image_url, order_index, created_date) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *",
      [itemId, name, price, category, description, imageUrl, order, createdDate]
    );
    const row = result.rows[0];
    res.status(201).json({
      id: row.id,
      name: row.name,
      price: Number(row.price),
      category: row.category,
      description: row.description,
      imageUrl: row.image_url,
      order: row.order_index,
      created_date: row.created_date,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /api/menu-items/:id (Requires Admin)
app.patch("/api/menu-items/:id", requireAdmin, async (req, res) => {
  const itemId = req.params.id;
  const { name, price, category, description, imageUrl, order } = req.body;

  try {
    const currentRes = await pool.query("SELECT * FROM menu_items WHERE id = $1", [itemId]);
    if (currentRes.rows.length === 0) {
      return res.status(404).json({ error: "Menu item not found" });
    }
    const current = currentRes.rows[0];

    const newName = name !== undefined ? name : current.name;
    const newPrice = price !== undefined ? price : current.price;
    const newCategory = category !== undefined ? category : current.category;
    const newDesc = description !== undefined ? description : current.description;
    const newImg = imageUrl !== undefined ? imageUrl : current.image_url;
    const newOrder = order !== undefined ? order : current.order_index;

    const result = await pool.query(
      "UPDATE menu_items SET name = $1, price = $2, category = $3, description = $4, image_url = $5, order_index = $6 WHERE id = $7 RETURNING *",
      [newName, newPrice, newCategory, newDesc, newImg, newOrder, itemId]
    );

    const row = result.rows[0];
    res.json({
      id: row.id,
      name: row.name,
      price: Number(row.price),
      category: row.category,
      description: row.description,
      imageUrl: row.image_url,
      order: row.order_index,
      created_date: row.created_date,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/menu-items/:id (Requires Admin)
app.delete("/api/menu-items/:id", requireAdmin, async (req, res) => {
  const itemId = req.params.id;
  try {
    await pool.query("DELETE FROM menu_items WHERE id = $1", [itemId]);
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Fallback all other REST API requests
app.use("/api", (req, res) => {
  res.status(404).json({ error: "Not Found" });
});

// ==========================================
// WEBSOCKET MANAGEMENT
// ==========================================

const wss = new WebSocketServer({ noServer: true });
const sessions = []; // array of { ws, roomId, guestId }

wss.on("connection", async (ws, request, clientInfo) => {
  const { roomId, guestId } = clientInfo;

  const session = { ws, roomId, guestId };
  sessions.push(session);

  console.log(`[WebSocket] Client connected: roomId=${roomId}, guestId=${guestId || "N/A"}`);

  // Set guest online status in database
  if (guestId) {
    try {
      await pool.query("UPDATE guest_users SET is_online = TRUE, last_seen = $1 WHERE id = $2", [new Date(), guestId]);
      // Notify other clients in the room
      broadcastToRoom(roomId, { type: "GUEST_UPDATE", guestId, isOnline: true });
    } catch (err) {
      console.error("[WebSocket] Failed to update guest online status on connect:", err);
    }
  }

  // Instantly send current phase to client
  try {
    const roomRes = await pool.query("SELECT * FROM rooms WHERE id = $1", [roomId]);
    if (roomRes.rows.length > 0) {
      ws.send(JSON.stringify({ type: "PHASE_UPDATE", phase: roomRes.rows[0].phase }));
    }
  } catch (err) {
    console.error("[WebSocket] Failed to fetch current phase:", err);
  }

  // Handle client disconnect or error
  const cleanup = async () => {
    const index = sessions.indexOf(session);
    if (index !== -1) {
      sessions.splice(index, 1);
    }

    if (guestId) {
      console.log(`[WebSocket] Client disconnected: guestId=${guestId}`);
      try {
        await pool.query("UPDATE guest_users SET is_online = FALSE, last_seen = $1 WHERE id = $2", [new Date(), guestId]);
        broadcastToRoom(roomId, { type: "GUEST_UPDATE", guestId, isOnline: false });
      } catch (err) {
        console.error("[WebSocket] Failed to update guest online status on disconnect:", err);
      }
    }
  };

  ws.on("close", cleanup);
  ws.on("error", cleanup);
});

// Broadcast to active WebSocket clients in specific room
export function broadcastToRoom(roomId, message) {
  const payload = JSON.stringify(message);

  sessions.forEach(session => {
    if (session.roomId === roomId) {
      if (session.ws.readyState === WebSocket.OPEN) {
        try {
          session.ws.send(payload);
        } catch (err) {
          console.error("[WebSocket] Failed to send message to client:", err);
        }
      }
    }
  });
}

// Handle HTTP upgrade requests for WebSocket server
server.on("upgrade", (request, socket, head) => {
  const url = new URL(request.url, `http://${request.headers.host}`);
  const pathname = url.pathname;

  if (pathname === "/api/ws") {
    const roomId = url.searchParams.get("roomId");
    const guestId = url.searchParams.get("guestId");

    if (!roomId) {
      socket.write("HTTP/1.1 400 Bad Request\r\n\r\n");
      socket.destroy();
      return;
    }

    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit("connection", ws, request, { roomId, guestId });
    });
  } else {
    socket.write("HTTP/1.1 404 Not Found\r\n\r\n");
    socket.destroy();
  }
});

// Start Node.js application
const port = process.env.PORT || 8080;
initDb().then(() => {
  server.listen(port, () => {
    console.log(`[Server] Node.js backend active and listening on port ${port}`);
  });
}).catch(err => {
  console.error("[Server] Bootstrapping failed due to database init error:", err);
  process.exit(1);
});
