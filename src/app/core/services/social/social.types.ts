export interface FriendActivity {
  id: string;
  friendUsername: string;
  verb: string;
  placeName: string;
  area: string;
  when: string;
  avatarSeed: number;
}

export interface FriendSuggestion {
  id: string;
  username: string;
  collectiblesCount: number;
  avatarSeed: number;
}
