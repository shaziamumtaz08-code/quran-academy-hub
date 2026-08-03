import { supabase } from '@/integrations/supabase/client';

const TEN_YEARS_SECONDS = 60 * 60 * 24 * 365 * 10;
const MAX_BYTES = 5 * 1024 * 1024;

/**
 * Uploads a profile photo to the private `avatars` bucket and returns a
 * long-lived signed URL that can be stored in `profiles.avatar_url`.
 *
 * `folder` must be the owner's user id (self-upload) or any folder when the
 * signed-in user is an admin — storage policies enforce this.
 */
export async function uploadAvatar(file: File, folder: string): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Please choose an image file (JPG, PNG or WEBP).');
  }
  if (file.size > MAX_BYTES) {
    throw new Error('Image is too large — please use a photo under 5 MB.');
  }

  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
  const path = `${folder}/${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(path, file, { upsert: true, contentType: file.type, cacheControl: '3600' });
  if (uploadError) throw uploadError;

  const { data, error } = await supabase.storage
    .from('avatars')
    .createSignedUrl(path, TEN_YEARS_SECONDS);
  if (error || !data?.signedUrl) throw error ?? new Error('Could not generate photo link');

  return data.signedUrl;
}
