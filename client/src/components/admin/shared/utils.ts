export function ensureArray<T>(value: T[] | null | undefined): T[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value;
}

export async function uploadFileToServer(file: File): Promise<string> {
  const uploadRes = await fetch('/api/upload', {
    method: 'POST',
    credentials: 'include',
  });

  if (!uploadRes.ok) {
    throw new Error('Failed to request upload URL');
  }

  const { uploadURL, objectPath } = await uploadRes.json() as { uploadURL: string; objectPath: string };

  const putRes = await fetch(uploadURL, {
    method: 'PUT',
    body: file,
    headers: { 'Content-Type': file.type },
  });

  if (!putRes.ok) {
    throw new Error('Failed to upload file');
  }

  return objectPath;
}
