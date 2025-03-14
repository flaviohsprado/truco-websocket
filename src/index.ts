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

io.on("connection", (socket) => {
   console.log("Client connected:", socket.id);
   const roomService = new RoomService(supabase);

   let activeRoom: string | null = null;

   socket.on("join-room", async ({ roomId, userId }: JoinRoom) => {
      console.log(`Client ${userId} joining room:`, roomId);

      const { room } = await roomService.joinRoom(roomId, userId);

      activeRoom = room.id;

      socket.join(room.id);

      io.to(room.id).emit("user-joined", { socketId: socket.id, userId });
      io.to(room.id).emit("room-data", room);
   });

   socket.on("join-by-code", async ({ code, userId }: JoinByCode) => {
      console.log(`Client ${userId} joining room by code:`, code);

      const { room } = await roomService.joinByCode(code, userId);

      activeRoom = room.id;

      socket.join(room.id);

      io.to(room.id).emit("user-joined", { socketId: socket.id, userId });
      io.to(room.id).emit("room-data", room);
   });

   socket.on("leave-room", async ({ userId }: LeaveRoom) => {
      if (activeRoom) {
         const { room } = await roomService.leaveRoom(activeRoom, userId);

         socket.leave(activeRoom);

         io.to(activeRoom).emit("user-left", { socketId: socket.id });
         io.to(activeRoom).emit("room-data", room);
      }
   });

   socket.on(
      "update-player-status",
      async ({ roomId, userId, isReady }: UpdatePlayerStatus) => {
         const { room } = await roomService.updatePlayerStatus(
            roomId,
            userId,
            isReady
         );

         io.to(room.id).emit("room-data", room);
      }
   );
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
