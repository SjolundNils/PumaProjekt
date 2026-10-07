
export type Relation = 'none' | 'friends' | 'sent' | 'received';

export type ProfileHit = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  relation: Relation;
};

export type Friendship = {
  friendship_id: number;
  friend_id: string;
  display_name: string | null;
  avatar_url: string | null;
  status: 'pending' | 'accepted';
  direction: 'incoming' | 'outgoing';
  created_at: string;
  accepted_at: string | null;
};