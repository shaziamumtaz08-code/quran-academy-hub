import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { uploadAvatar } from '@/lib/avatarUpload';

/**
 * Uploads a profile photo and saves it on the given profile row.
 * Returns the handler for <ProfileHero onAvatarSelect> plus a loading flag.
 */
export function useProfileAvatar(profileId: string | undefined, onSaved?: () => void) {
  const [uploading, setUploading] = useState(false);

  const onAvatarSelect = async (file: File) => {
    if (!profileId) return;
    setUploading(true);
    try {
      const url = await uploadAvatar(file, profileId);
      const { error } = await supabase.from('profiles').update({ avatar_url: url }).eq('id', profileId);
      if (error) throw error;
      toast({ title: 'Photo updated' });
      onSaved?.();
    } catch (error: any) {
      toast({ title: 'Could not upload photo', description: error.message, variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  return { onAvatarSelect, uploading };
}
