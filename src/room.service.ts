import type { SupabaseClient } from "@supabase/supabase-js";
import type { Room, RoomData, RoomPlayer } from "./types.js";

export class RoomService {
   constructor(private supabase: SupabaseClient) {}

   public async joinRoom(roomId: string, userId: string): Promise<RoomData> {
      try {
         const { data: existingPlayer } = await this.supabase
            .from("room_players")
            .select("*")
            .eq("roomId", roomId)
            .eq("userId", userId)
            .single<RoomPlayer>();

         if (existingPlayer) {
            throw new Error("You are already in this room");
         }

         // Get current number of players to determine team
         const currentPlayersCountResponse = await this.supabase
            .from("room_players")
            .select("*")
            .eq("roomId", roomId);
         const currentPlayersCount =
            currentPlayersCountResponse.data?.length || 0;

         const team = (currentPlayersCount % 2) + 1;

         // Insert new player
         const { data: roomPlayerData } = await this.supabase
            .from("room_players")
            .insert({
               roomId: roomId,
               userId: userId,
               team: team.toString(),
               isReady: false,
            })
            .select("*")
            .single<RoomPlayer[]>();

         // Update room players count
         const { data: roomData } = await this.supabase
            .from("rooms")
            .select("*")
            .eq("id", roomId)
            .single<Room>();

         const currentPlayersInRoom = roomData?.currentPlayers || 0;

         await this.supabase
            .from("rooms")
            .update({
               currentPlayers: currentPlayersInRoom + 1,
            })
            .eq("id", roomId);

         return {
            room: roomData as Room,
            players: roomPlayerData as RoomPlayer[],
            currentPlayers: currentPlayersInRoom,
         };
      } catch (error) {
         throw new Error("Error joining room", { cause: error });
      }
   }

   public async joinByCode(code: string, userId: string): Promise<RoomData> {
      try {
         const { data: room } = await this.supabase
            .from("rooms")
            .select("*")
            .eq("id", code)
            .single<Room>();

         if (!room) {
            throw new Error("Room not found");
         }

         if (
            room.currentPlayers &&
            room.currentPlayers >= (room.maxPlayers ?? 0)
         ) {
            throw new Error("Room is full");
         }

         const { data: roomPlayers } = await this.supabase
            .from("room_players")
            .select("*")
            .eq("roomId", room.id);

         // Check if player is already in the room - safely handle undefined
         if (
            roomPlayers &&
            roomPlayers.filter((player: RoomPlayer) => player.userId === userId)
               .length > 0
         ) {
            throw new Error("You are already in this room");
         }

         // Update room players count
         await this.supabase
            .from("rooms")
            .update({ currentPlayers: (room.currentPlayers ?? 0) + 1 })
            .eq("id", room.id);

         return {
            room: room as Room,
            players: roomPlayers as RoomPlayer[],
            currentPlayers: room.currentPlayers ?? 0,
         };
      } catch (error) {
         throw new Error("Error joining room by code", { cause: error });
      }
   }

   public async leaveRoom(roomId: string, userId: string): Promise<RoomData> {
      try {
         const { data: roomData } = await this.supabase
            .from("rooms")
            .select("currentPlayers")
            .eq("id", roomId)
            .single();

         await this.supabase
            .from("room_players")
            .delete()
            .eq("roomId", roomId)
            .eq("userId", userId);

         await this.supabase
            .from("rooms")
            .update({ currentPlayers: roomData?.currentPlayers - 1 })
            .eq("id", roomId);

         const { data: roomPlayers } = await this.supabase
            .from("room_players")
            .select("*")
            .eq("roomId", roomId);

         return {
            room: roomData as Room,
            players: roomPlayers as RoomPlayer[],
            currentPlayers: roomData?.currentPlayers ?? 0,
         };
      } catch (error) {
         throw new Error("Error leaving room", { cause: error });
      }
   }

   public async updatePlayerStatus(
      roomId: string,
      userId: string,
      isReady: boolean
   ): Promise<RoomData> {
      const { data: roomPlayerData } = await this.supabase
         .from("room_players")
         .update({
            isReady: isReady,
         })
         .eq("roomId", roomId)
         .eq("userId", userId);

      const { data: roomData } = await this.supabase
         .from("rooms")
         .select("*")
         .eq("id", roomId)
         .single();

      const currentPlayersInRoom = roomData?.currentPlayers || 0;

      return {
         room: roomData as Room,
         players: roomPlayerData as unknown as RoomPlayer[],
         currentPlayers: currentPlayersInRoom,
      };
   }
}
