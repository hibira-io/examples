// Photos are shrunk on the phone before they leave it: a 12-megapixel shot
// is 3 to 5 MB, while 1600 pixels on the long side is plenty for a receipt
// and about 150 to 300 KB.

// Over the relay (no WebRTC), every chunk is a client event, so photos are
// made smaller there to arrive in about the same second or two.
const SIZES = { full: { side: 1600, quality: 0.82 }, relay: { side: 1200, quality: 0.72 } };
export type Size = keyof typeof SIZES;
const THUMB_SIDE = 40;

export interface Photo {
  blob: Blob;
  /** A 40-pixel preview as a data: URL, sent ahead so the other side shows something at once. */
  thumb: string;
  /** A local URL of the photo for the phone's own fly-away animation. */
  url: string;
}

export async function fromSource(src: CanvasImageSource, width: number, height: number, size: Size): Promise<Photo> {
  const { side, quality } = SIZES[size];
  const scale = Math.min(1, side / Math.max(width, height));
  const canvas = draw(src, Math.round(width * scale), Math.round(height * scale));
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('encode failed'))), 'image/jpeg', quality),
  );
  const t = THUMB_SIDE / Math.max(width, height);
  const thumb = draw(src, Math.max(1, Math.round(width * t)), Math.max(1, Math.round(height * t))).toDataURL('image/jpeg', 0.5);
  return { blob, thumb, url: URL.createObjectURL(blob) };
}

/** A photo from the video preview. */
export function fromVideo(video: HTMLVideoElement, size: Size): Promise<Photo> {
  return fromSource(video, video.videoWidth, video.videoHeight, size);
}

/** A photo the user picked or took with the camera app, upright as shown in the gallery. */
export async function fromFile(file: File, size: Size): Promise<Photo> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  try {
    return await fromSource(bitmap, bitmap.width, bitmap.height, size);
  } finally {
    bitmap.close();
  }
}

function draw(src: CanvasImageSource, w: number, h: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.getContext('2d')!.drawImage(src, 0, 0, w, h);
  return canvas;
}
