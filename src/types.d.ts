export type Room = {
   id: string;
   status: string | null;
   code: string;
   name: string | null;
   maxPlayers: number | null;
   currentPlayers: number | null;
   betAmount: number | null;
   turnTime: number | null;
   private: boolean | null;
   createdAt: Date | null;
   updatedAt: Date | null;
   players: RoomPlayer[];
   playerAlreadyInRoom?: boolean;
};

export type RoomPlayer = {
   id: string;
   createdAt: Date | null;
   updatedAt: Date | null;
   userId: string | null;
   roomId: string | null;
   isReady: boolean | null;
   team: string | null;
   user: {
      raw_user_meta_data: any;
      id: string;
      email: string;
      phone: string;
   } | null;
};

export type JoinRoom = {
   roomId: string;
   userId: string;
};

export type JoinByCode = {
   code: string;
   userId: string;
};

export type LeaveRoom = {
   userId: string;
};

export type UpdatePlayerStatus = {
   roomId: string;
   userId: string;
   isReady: boolean;
};

export type RoomData = {
   room: Room;
   currentPlayers: number;
};
