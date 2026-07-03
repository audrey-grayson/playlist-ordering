// Subset of Spotify Web API response shapes that we consume.

export interface SpotifyImage {
  url: string;
  height: number | null;
  width: number | null;
}

export interface SpotifyUser {
  id: string;
  display_name: string | null;
  images?: SpotifyImage[];
}

export interface SpotifyArtist {
  id: string;
  name: string;
}

export interface SpotifyAlbum {
  id: string;
  name: string;
  images: SpotifyImage[];
}

export interface SpotifyTrack {
  id: string;
  uri: string;
  name: string;
  duration_ms: number;
  explicit: boolean;
  artists: SpotifyArtist[];
  album: SpotifyAlbum;
  is_local?: boolean;
}

export interface PlaylistTrackItem {
  track: SpotifyTrack | null; // null for removed/unavailable tracks
  added_at: string;
}

export interface SpotifyPlaylist {
  id: string;
  name: string;
  description: string | null;
  images: SpotifyImage[];
  owner: SpotifyUser;
  tracks: { total: number; href: string };
  snapshot_id: string;
  public: boolean | null;
  collaborative: boolean;
}

export interface Paging<T> {
  items: T[];
  next: string | null;
  total: number;
  limit: number;
  offset: number;
}

// --- Audio features (deprecated for new apps; guarded behind FeatureProvider) ---

export interface SpotifyAudioFeatures {
  id: string;
  key: number; // 0..11 (pitch class), -1 if unknown
  mode: number; // 1 major, 0 minor
  tempo: number; // BPM
  energy: number; // 0..1
  valence: number; // 0..1
  danceability: number; // 0..1
  acousticness: number; // 0..1
  instrumentalness: number; // 0..1
  loudness: number; // dB, typically -60..0
  time_signature: number;
  duration_ms: number;
}

// --- Audio analysis (sections) ---

export interface AnalysisSection {
  start: number;
  duration: number;
  loudness: number; // dB
  tempo: number; // BPM
  key: number; // 0..11, -1 unknown
  mode: number; // 1/0
}

export interface SpotifyAudioAnalysis {
  sections: AnalysisSection[];
}
