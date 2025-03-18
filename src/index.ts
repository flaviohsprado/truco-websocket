import { createClient } from "@supabase/supabase-js";
import "dotenv/config";
import { Hono } from "hono";
import { createServer } from "http";
import { Server } from "socket.io";
import { RoomService } from "./room.service.js";
import type {
   JoinByCode,
   JoinRoom,
   LeaveRoom,
   UpdatePlayerStatus,
} from "./types.js";

const app = new Hono();
const httpServer = createServer();
const supabase = createClient(
   process.env.SUPABASE_URL!,
   process.env.SUPABASE_ANON_KEY!
);

const io = new Server(httpServer, {
   cors: {
      origin: "*",
      methods: ["GET", "POST"],
      allowedHeaders: ["*"],
      credentials: true,
   },
   transports: ["websocket", "polling"],
   path: "/socket.io",
});

// Create a single instance of RoomService to be shared across all connections
const roomService = new RoomService(supabase);

io.on("connection", (socket) => {
   console.log("Client connected:", socket.id);

   // Track per-socket room info
   let activeRoomId: string | null = null;

   socket.on("join-room", async ({ roomId, userId }: JoinRoom) => {
      console.log(`User ${userId} joining room:`, roomId);
      activeRoomId = roomId;

      try {
         const response = await roomService.joinRoom(roomId, userId);

         // Join the socket.io room
         socket.join(roomId);

         // Broadcast to everyone in the room
         io.to(roomId).emit("user-joined", {
            socketId: socket.id,
            userId,
         });
         io.to(roomId).emit("room-data", response);
      } catch (error) {
         console.error("Error joining room:", error);
         socket.emit("room-join-error", { message: "Failed to join room" });
      }
   });

   socket.on("join-by-code", async ({ code, userId }: JoinByCode) => {
      console.log(`Client ${userId} joining room by code:`, code);

      try {
         const response = await roomService.joinByCode(code, userId);

         activeRoomId = response.room.id;
         // Join the socket.io room
         socket.join(response.room.id);

         // Broadcast to everyone in the room
         io.to(response.room.id).emit("user-joined", {
            socketId: socket.id,
            userId,
         });
         io.to(response.room.id).emit("room-data", response);
      } catch (error) {
         console.error("Error joining room by code:", error);
         socket.emit("room-join-error", {
            message: "Failed to join room by code",
         });
      }
   });

   socket.on("leave-room", async ({ userId }: LeaveRoom) => {
      if (activeRoomId) {
         try {
            const response = await roomService.leaveRoom(activeRoomId, userId);

            socket.leave(activeRoomId);

            io.to(activeRoomId).emit("user-left", { socketId: socket.id });
            io.to(activeRoomId).emit("room-data", response);
         } catch (error) {
            console.error("Error leaving room:", error);
            socket.emit("room-leave-error", {
               message: "Failed to leave room",
            });
         }
      }
   });

   socket.on(
      "update-player-status",
      async ({ roomId, userId, isReady }: UpdatePlayerStatus) => {
         try {
            const response = await roomService.updatePlayerStatus(
               roomId,
               userId,
               isReady
            );

            io.to(response.room.id).emit("room-data", response);
         } catch (error) {
            console.error("Error updating player status:", error);
            socket.emit("room-update-error", {
               message: "Failed to update player status",
            });
         }
      }
   );

   socket.on("disconnect", () => {
      console.log("Client disconnected:", socket.id);
   });
});

app.get("/", (c) => c.text("WebSocket server running"));

const port = Number(process.env.PORT ?? 12000);
// serve({
//   fetch: app.fetch,
//   port,
//   hostname: '0.0.0.0'
// });

// Integrate Hono with the existing HTTP server
httpServer.on("request", (req, res) => {
   app.fetch(req as unknown as Request, res as unknown as Response);
});

// Modify the server startup to ensure DB connection
httpServer.listen(port, "0.0.0.0", async () => {
   //await connectDB();
   console.log(`Server is running on port ${port}`);
});
