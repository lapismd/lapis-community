export interface CommunityUploadedMedia {
  url: string;
  mimeType: string;
  size: number;
  sha256: string;
  name?: string;
  alt?: string;
  width?: number;
  height?: number;
}
