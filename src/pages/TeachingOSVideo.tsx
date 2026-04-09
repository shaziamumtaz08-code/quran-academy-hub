import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useTeachingSession } from '@/hooks/useTeachingSession';
import { supabase } from '@/integrations/supabase/client';
import { NavRail, buildRailNav } from '@/components/layout/NavRail';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import {
  Search, Play, Plus, Check, ChevronRight, Star, Shield, ShieldAlert, ShieldCheck,
  AlertTriangle, BarChart3, Eye, Lightbulb, TrendingUp, ListVideo, Film,
  GripVertical, Share2, Download, ExternalLink, CheckCircle2, CircleDot,
  Clock, Ban, X, Sparkles, Video, ChevronDown
} from 'lucide-react';
import { PhaseStepperCompact, NextPhaseButton } from '@/components/teaching/PhaseNavBar';

type Section = 'search' | 'library' | 'playlists' | 'filter' | 'flagged' | 'analytics' | 'insights';

interface VideoItem {
  id: string;
  youtube_id: string;
  title: string;
  channel_name: string;
  duration_seconds: number;
  thumbnail_url: string;
  safety_status: string;
  safety_flags: string[];
  ai_score: number;
  content_tags: string[];
  recommendation_reason?: string;
  use_count?: number;
}

interface PlaylistItem {
  id: string;
  video_id: string;
  position: number;
  video?: VideoItem;
}

interface SessionPlan {
  id: string;
  session_title: string;
  session_objective: string;
  activities: any[];
  week_number: number;
  session_number: number;
  syllabus_id: string;
}


const FILTERS = ['All', 'Beginner', 'Intermediate', '5-10 min', '10-20 min', 'Arabic', 'No music', 'Islamic context', 'Subtitled'];

const MOCK_VIDEOS: VideoItem[] = [
  { id: '1', youtube_id: 'dQw4w9WgXcQ', title: 'Learn Arabic Greetings — Complete Beginner Guide', channel_name: 'Learn Arabic with Maha', duration_seconds: 444, thumbnail_url: '', safety_status: 'safe', safety_flags: [], ai_score: 92, content_tags: ['Greetings', 'Beginner', 'No music'], recommendation_reason: 'Directly covers session greeting vocabulary with clear pronunciation' },
  { id: '2', youtube_id: 'abc123', title: 'Introduce Yourself in Arabic — First Day Phrases', channel_name: 'Arabic with Yasmin', duration_seconds: 312, thumbnail_url: '', safety_status: 'safe', safety_flags: [], ai_score: 87, content_tags: ['Self-introduction', 'Beginner', 'Subtitled'], recommendation_reason: 'Covers اسمي and من أين أنت patterns at beginner level' },
  { id: '3', youtube_id: 'def456', title: 'Arabic Self Introduction — Practice with Native Speaker', channel_name: 'Quran & Arabic Academy', duration_seconds: 765, thumbnail_url: '', safety_status: 'review', safety_flags: ['Background music present'], ai_score: 78, content_tags: ['Practice', 'Native speaker', 'Vocabulary'], recommendation_reason: 'Good native speaker model but has light background music' },
  { id: '4', youtube_id: 'ghi789', title: 'Arabic Phrases for Everyday — Greetings & Introductions', channel_name: 'Madinah Arabic Academy', duration_seconds: 510, thumbnail_url: '', safety_status: 'safe', safety_flags: [], ai_score: 83, content_tags: ['Phrases', 'Vocabulary', 'Drill'], recommendation_reason: 'Covers daily phrases including greetings vocabulary' },
  { id: '5', youtube_id: 'jkl012', title: 'Arabic Alphabet & Basic Greetings', channel_name: 'Islamic Learning Hub', duration_seconds: 620, thumbnail_url: '', safety_status: 'safe', safety_flags: [], ai_score: 75, content_tags: ['Alphabet', 'Greetings', 'Beginner'], recommendation_reason: 'Alphabet review combined with greeting practice' },
  { id: '6', youtube_id: 'mno345', title: 'Arabic Conversation Practice — Meeting Someone New', channel_name: 'Arabic Pod 101', duration_seconds: 390, thumbnail_url: '', safety_status: 'review', safety_flags: ['Non-Islamic channel', 'Some gender mixing'], ai_score: 70, content_tags: ['Conversation', 'Practice'], recommendation_reason: 'Good conversation model but from non-Islamic channel' },
];

const MOCK_FLAGGED: VideoItem[] = [
  { id: 'f1', youtube_id: 'flag1', title: 'Arabic Learning with Music — Fun Greetings Song', channel_name: 'Music Arabic', duration_seconds: 240, thumbnail_url: '', safety_status: 'blocked', safety_flags: ['Music with instruments as primary audio', 'Non-Islamic channel'], ai_score: 45, content_tags: ['Music', 'Song'] },
  { id: 'f2', youtube_id: 'flag2', title: 'Learn Arabic Dating Phrases', channel_name: 'Travel Arabic', duration_seconds: 350, thumbnail_url: '', safety_status: 'blocked', safety_flags: ['Islamically controversial content', 'Inappropriate context'], ai_score: 15, content_tags: ['Dating', 'Phrases'] },
];

const formatDuration = (sec: number) => {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
};

const TeachingOSVideo: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { activeRole } = useAuth();
  const railItems = buildRailNav(activeRole);
  const { sessionId } = useTeachingSession();

  const [activeSection, setActiveSection] = useState<Section>('search');
  const [sessionPlan, setSessionPlan] = useState<SessionPlan | null>(null);
  const [courseName, setCourseName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilters, setActiveFilters] = useState<string[]>(['All']);
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [playlistVideos, setPlaylistVideos] = useState<string[]>([]); // video ids added
  const [isSearching, setIsSearching] = useState(false);
  const [filterSettings, setFilterSettings] = useState({
    block_music: true, block_mixed_gender: true, require_islamic_context: true,
    prefer_ad_free: true, flag_non_islamic_channels: true, require_dress_standards: true,
    require_arabic_subtitles: false, require_female_teacher: false,
    require_male_teacher: false, block_non_arabic_audio: false,
  });
  const [strictness, setStrictness] = useState('standard');

  useEffect(() => {
    if (!sessionId) return;
    loadSession();
  }, [sessionId]);

  const loadSession = async () => {
    if (!sessionId) return;
    const { data: sp } = await supabase.from('session_plans').select('*').eq('id', sessionId).single();
    if (sp) {
      setSessionPlan(sp as any);
      setSearchQuery(`${(sp as any).session_title} Arabic Beginner lesson`);
      const { data: syl } = await supabase.from('syllabi').select('course_name').eq('id', (sp as any).syllabus_id).single();
      if (syl) setCourseName(syl.course_name);
    }
  };

  const handleSearch = () => {
    setIsSearching(true);
    setTimeout(() => {
      setVideos(MOCK_VIDEOS);
      setIsSearching(false);
      toast.success(`Found ${MOCK_VIDEOS.length} AI-filtered videos`);
    }, 1500);
  };

  const toggleFilter = (f: string) => {
    if (f === 'All') { setActiveFilters(['All']); return; }
    setActiveFilters(prev => {
      const next = prev.filter(x => x !== 'All');
      return next.includes(f) ? next.filter(x => x !== f) : [...next, f];
    });
  };

  const addToPlaylist = (videoId: string) => {
    setPlaylistVideos(prev => prev.includes(videoId) ? prev : [...prev, videoId]);
    toast.success('Added to session playlist');
  };

  const removeFromPlaylist = (videoId: string) => {
    setPlaylistVideos(prev => prev.filter(x => x !== videoId));
  };

  const playlistData = playlistVideos.map(id => videos.find(v => v.id === id) || MOCK_VIDEOS.find(v => v.id === id)).filter(Boolean) as VideoItem[];
  const totalPlaylistDuration = playlistData.reduce((s, v) => s + v.duration_seconds, 0);

  const sectionLabel = {
    search: 'AI video search', library: 'YouTube library', playlists: 'Playlists',
    filter: 'Content filter', flagged: 'Flagged videos', analytics: 'Watch analytics', insights: 'AI insights',
  }[activeSection];

  return (
    <div className="flex h-screen bg-[#f4f5f7] overflow-hidden pl-14">
      <NavRail items={railItems} />

      {/* Section Sidebar */}
      <div className="w-[220px] bg-white border-r border-[#e8e9eb] flex flex-col flex-shrink-0">
        <div className="px-4 pt-[14px] pb-[10px] border-b border-[#e8e9eb]">
          <div className="text-[13px] font-medium" style={{ color: '#0f2044' }}>Video intelligence</div>
          <div className="text-[11px] mt-[2px]" style={{ color: '#7a7f8a' }}>Teaching OS · Phase 6</div>
        </div>

        {/* Phase stepper */}
        <PhaseStepperCompact currentPhase={6} sessionId={sessionId} />

        <div className="flex-1 overflow-y-auto py-2">
          <SideLabel>Search</SideLabel>
          <SideNavItem icon={Search} label="AI video search" active={activeSection === 'search'} onClick={() => setActiveSection('search')} badge={videos.length > 0 ? String(videos.length) : undefined} badgeColor="#1a56b0" />
          <SideNavItem icon={Film} label="YouTube library" active={activeSection === 'library'} onClick={() => setActiveSection('library')} badge="18" badgeColor="#7a7f8a" />

          <SideLabel>Playlist</SideLabel>
          <SideNavItem icon={ListVideo} label="Playlists" active={activeSection === 'playlists'} onClick={() => setActiveSection('playlists')} badge={playlistVideos.length > 0 ? String(playlistVideos.length) : undefined} badgeColor="#1a56b0" />

          <SideLabel>Safety</SideLabel>
          <SideNavItem icon={ShieldCheck} label="Content filter" active={activeSection === 'filter'} onClick={() => setActiveSection('filter')} badge="On" badgeColor="#1a7340" />
          <SideNavItem icon={ShieldAlert} label="Flagged videos" active={activeSection === 'flagged'} onClick={() => setActiveSection('flagged')} badge={String(MOCK_FLAGGED.length)} badgeColor="#b42a2a" />

          <SideLabel>Analytics</SideLabel>
          <SideNavItem icon={BarChart3} label="Watch analytics" active={activeSection === 'analytics'} onClick={() => setActiveSection('analytics')} />
          <SideNavItem icon={Star} label="AI insights" active={activeSection === 'insights'} onClick={() => setActiveSection('insights')} />
        </div>

        <div className="p-[10px] border-t border-[#e8e9eb]">
          <NextPhaseButton currentPhase={6} sessionId={sessionId} />
        </div>
      </div>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <div className="h-12 bg-white border-b border-[#e8e9eb] flex items-center justify-between px-4 flex-shrink-0">
          <div className="text-[11px]" style={{ color: '#7a7f8a' }}>
            Teaching OS › <span style={{ color: '#4a5264' }}>{courseName || 'Course'}</span> › <span style={{ color: '#4a5264' }}>{sectionLabel}</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="text-[11px] h-7"><Download className="w-3 h-3 mr-1" />Export playlist</Button>
            <Button variant="outline" size="sm" className="text-[11px] h-7"><Share2 className="w-3 h-3 mr-1" />Share to students</Button>
            <Button size="sm" className="text-[11px] h-7" style={{ backgroundColor: '#0f2044', color: '#fff' }} onClick={() => navigate(`/teaching-os/speaking-tutor${sessionId ? `?session_id=${sessionId}` : ''}`)}>
              Phase 7: Speaking tutor <ChevronRight className="w-3 h-3 ml-1" />
            </Button>
          </div>
        </div>

        <div className="flex flex-1 min-h-0">
          {/* Center */}
          <div className="flex-1 overflow-y-auto p-4">
            {activeSection === 'search' && <SearchSection searchQuery={searchQuery} setSearchQuery={setSearchQuery} activeFilters={activeFilters} toggleFilter={toggleFilter} videos={videos} playlistVideos={playlistVideos} addToPlaylist={addToPlaylist} isSearching={isSearching} handleSearch={handleSearch} sessionPlan={sessionPlan} />}
            {activeSection === 'library' && <LibrarySection videos={MOCK_VIDEOS} playlistVideos={playlistVideos} addToPlaylist={addToPlaylist} />}
            {activeSection === 'playlists' && <PlaylistsSection playlistData={playlistData} removeFromPlaylist={removeFromPlaylist} sessionPlan={sessionPlan} totalDuration={totalPlaylistDuration} />}
            {activeSection === 'filter' && <FilterSection settings={filterSettings} setSettings={setFilterSettings} strictness={strictness} setStrictness={setStrictness} />}
            {activeSection === 'flagged' && <FlaggedSection videos={MOCK_FLAGGED} />}
            {activeSection === 'analytics' && <AnalyticsSection />}
            {activeSection === 'insights' && <InsightsSection sessionPlan={sessionPlan} />}
          </div>

          {/* Right panel */}
          <div className="w-[248px] bg-white border-l border-[#e8e9eb] flex-shrink-0 overflow-y-auto">
            <RightPanel activeSection={activeSection} videos={videos} playlistData={playlistData} totalDuration={totalPlaylistDuration} />
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Sidebar helpers ──────────────────────────────────────
const SideLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="px-4 py-1 mt-2 text-[10px] font-medium uppercase tracking-wider" style={{ color: '#aab0bc' }}>{children}</div>
);

const SideNavItem: React.FC<{ icon: React.ElementType; label: string; active: boolean; onClick: () => void; badge?: string; badgeColor?: string }> = ({ icon: Icon, label, active, onClick, badge, badgeColor }) => (
  <button onClick={onClick} className="w-full flex items-center gap-2 px-4 py-[7px] text-left transition-colors" style={{
    borderLeft: `3px solid ${active ? '#1a56b0' : 'transparent'}`,
    backgroundColor: active ? '#eef2fa' : 'transparent',
    color: active ? '#0f2044' : '#4a5264',
    fontWeight: active ? 500 : 400, fontSize: '12px',
  }}>
    <Icon className="w-[14px] h-[14px]" style={{ color: active ? '#1a56b0' : '#7a7f8a' }} />
    <span className="flex-1">{label}</span>
    {badge && <span className="text-[10px] px-[6px] py-[1px] rounded-[8px]" style={{ backgroundColor: badgeColor ? `${badgeColor}18` : '#eef2fa', color: badgeColor || '#1a56b0' }}>{badge}</span>}
  </button>
);

// ─── Video Card ───────────────────────────────────────────
const VideoCard: React.FC<{
  video: VideoItem;
  isAdded: boolean;
  onAdd: () => void;
  selected?: boolean;
  onClick?: () => void;
}> = ({ video, isAdded, onAdd, selected, onClick }) => {
  const scoreColor = video.ai_score >= 85 ? '#1a7340' : video.ai_score >= 70 ? '#1a56b0' : '#8a5c00';
  const safetyBadge = video.safety_status === 'safe' ? { label: '✓ Safe', bg: '#e6f4ea', color: '#1a7340' } : video.safety_status === 'review' ? { label: '⚠ Review', bg: '#fff8e6', color: '#8a5c00' } : { label: '✗ Blocked', bg: '#fde8e8', color: '#b42a2a' };

  return (
    <div className="bg-white border rounded-[10px] overflow-hidden cursor-pointer transition-all hover:shadow-sm" style={{ borderWidth: selected ? '1.5px' : '0.5px', borderColor: selected ? '#1a56b0' : '#e8e9eb' }} onClick={onClick}>
      {/* Thumbnail */}
      <div className="relative w-full" style={{ aspectRatio: '16/9', backgroundColor: '#0f2044' }}>
        <img src={`https://img.youtube.com/vi/${video.youtube_id}/mqdefault.jpg`} alt={video.title} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm">
            <Play className="w-4 h-4 text-white fill-white" />
          </div>
        </div>
        <span className="absolute top-2 left-2 text-[9px] font-medium px-[6px] py-[2px] rounded-[6px]" style={{ backgroundColor: safetyBadge.bg, color: safetyBadge.color }}>{safetyBadge.label}</span>
        <span className="absolute bottom-2 right-2 text-[9px] font-medium px-[5px] py-[1px] rounded bg-black/70 text-white">{formatDuration(video.duration_seconds)}</span>
      </div>
      {/* Body */}
      <div className="px-[10px] py-[9px]">
        <div className="text-[11.5px] font-medium line-clamp-2" style={{ color: '#0f2044', lineHeight: 1.3 }}>{video.title}</div>
        <div className="text-[10px] mt-[3px]" style={{ color: '#7a7f8a' }}>{video.channel_name}</div>
        {video.content_tags.length > 0 && (
          <div className="flex flex-wrap gap-[3px] mt-[5px]">
            {video.content_tags.slice(0, 3).map(tag => (
              <span key={tag} className="text-[9px] px-[5px] py-[1px] rounded bg-[#f4f5f7] text-[#7a7f8a]">{tag}</span>
            ))}
          </div>
        )}
      </div>
      {/* Footer */}
      <div className="flex items-center justify-between px-[10px] py-[6px] border-t bg-[#fafbfc]" style={{ borderColor: '#f0f1f3' }}>
        <div className="flex items-center gap-[6px]">
          <span className="text-[10px]" style={{ color: '#7a7f8a' }}>AI</span>
          <div className="w-[40px] h-[3px] rounded-full bg-[#e8e9eb]">
            <div className="h-full rounded-full" style={{ width: `${video.ai_score}%`, backgroundColor: scoreColor }} />
          </div>
          <span className="text-[10px] font-medium" style={{ color: scoreColor }}>{video.ai_score}%</span>
        </div>
        <button onClick={e => { e.stopPropagation(); if (!isAdded) onAdd(); }} className="flex items-center gap-1 text-[10px] font-medium px-2 py-[3px] rounded-[5px] border transition-colors" style={{
          borderColor: isAdded ? '#86c7a0' : '#e8e9eb',
          backgroundColor: isAdded ? '#e6f4ea' : 'transparent',
          color: isAdded ? '#1a7340' : '#1a56b0',
        }}>
          {isAdded ? <><Check className="w-3 h-3" />Added</> : <><Plus className="w-3 h-3" />Add</>}
        </button>
      </div>
    </div>
  );
};

// ─── Search Section ───────────────────────────────────────
const SearchSection: React.FC<{
  searchQuery: string; setSearchQuery: (v: string) => void;
  activeFilters: string[]; toggleFilter: (f: string) => void;
  videos: VideoItem[]; playlistVideos: string[]; addToPlaylist: (id: string) => void;
  isSearching: boolean; handleSearch: () => void; sessionPlan: SessionPlan | null;
}> = ({ searchQuery, setSearchQuery, activeFilters, toggleFilter, videos, playlistVideos, addToPlaylist, isSearching, handleSearch, sessionPlan }) => (
  <div className="space-y-3">
    {/* Search bar */}
    <div className="flex gap-2">
      <Input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="flex-1 text-[12px] h-9" placeholder="Search for educational videos…" style={{ borderColor: '#d0d4dc', borderRadius: 7 }} onKeyDown={e => e.key === 'Enter' && handleSearch()} />
      <Button onClick={handleSearch} disabled={isSearching} className="h-9 text-[12px] px-4" style={{ backgroundColor: '#0f2044', color: '#fff' }}>
        <Sparkles className="w-3.5 h-3.5 mr-1.5" />{isSearching ? 'Searching…' : 'AI search'}
      </Button>
    </div>

    {/* Filter pills */}
    <div className="flex flex-wrap gap-[6px]">
      {FILTERS.map(f => (
        <button key={f} onClick={() => toggleFilter(f)} className="text-[10px] px-[10px] py-[4px] rounded-full font-medium transition-colors" style={{
          border: `0.5px solid ${activeFilters.includes(f) ? '#b5d0f8' : '#e8e9eb'}`,
          backgroundColor: activeFilters.includes(f) ? '#eef2fa' : '#fff',
          color: activeFilters.includes(f) ? '#1a56b0' : '#4a5264',
        }}>{f}</button>
      ))}
    </div>

    {/* AI filter bar */}
    {videos.length > 0 && (
      <div className="bg-[#f0f4ff] border border-[#b5d0f8] rounded-[9px] p-[11px] flex items-center gap-[10px]">
        <div className="w-[30px] h-[30px] rounded-[8px] bg-[#1a56b0] flex items-center justify-center flex-shrink-0">
          <ShieldCheck className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1">
          <div className="text-[12px] font-medium" style={{ color: '#0f2044' }}>AI filtered for your session</div>
          <div className="text-[11px]" style={{ color: '#7a7f8a' }}>
            {videos.filter(v => v.safety_status !== 'blocked').length} videos · Islamic-safe · Matched to "{sessionPlan?.session_title}" · Beginner level
          </div>
        </div>
      </div>
    )}

    {/* Searching state */}
    {isSearching && (
      <div className="bg-[#fff8e6] border border-[#e8d980] rounded-[8px] p-3 flex items-center gap-2">
        <div className="w-3 h-3 border-2 border-[#8a5c00] border-t-transparent rounded-full animate-spin" />
        <span className="text-[12px]" style={{ color: '#8a5c00' }}>Searching and scoring videos…</span>
      </div>
    )}

    {/* Results grid */}
    {videos.length > 0 && (
      <div className="grid grid-cols-2 gap-3">
        {videos.map(v => (
          <VideoCard key={v.id} video={v} isAdded={playlistVideos.includes(v.id)} onAdd={() => addToPlaylist(v.id)} />
        ))}
      </div>
    )}

    {videos.length === 0 && !isSearching && (
      <div className="bg-white border border-dashed border-[#d0d4dc] rounded-[10px] p-8 text-center">
        <Search className="w-8 h-8 mx-auto mb-3 text-[#aab0bc]" />
        <div className="text-[13px] font-medium mb-1" style={{ color: '#0f2044' }}>Search for videos</div>
        <div className="text-[11px]" style={{ color: '#7a7f8a' }}>AI will find, filter, and score educational videos for your session.</div>
      </div>
    )}
  </div>
);

// ─── Library Section ──────────────────────────────────────
const LibrarySection: React.FC<{ videos: VideoItem[]; playlistVideos: string[]; addToPlaylist: (id: string) => void }> = ({ videos, playlistVideos, addToPlaylist }) => (
  <div className="space-y-3">
    <Input placeholder="Search library by title or channel…" className="text-[12px] h-8" />
    <div className="grid grid-cols-2 gap-3">
      {videos.map(v => <VideoCard key={v.id} video={v} isAdded={playlistVideos.includes(v.id)} onAdd={() => addToPlaylist(v.id)} />)}
    </div>
  </div>
);

// ─── Playlists Section ────────────────────────────────────
const PlaylistsSection: React.FC<{ playlistData: VideoItem[]; removeFromPlaylist: (id: string) => void; sessionPlan: SessionPlan | null; totalDuration: number }> = ({ playlistData, removeFromPlaylist, sessionPlan, totalDuration }) => (
  <div className="space-y-3">
    <div className="bg-white border border-[#e8e9eb] rounded-[10px] overflow-hidden">
      <div className="px-[13px] py-[10px] border-b border-[#f0f1f3]">
        <div className="text-[13px] font-medium" style={{ color: '#0f2044' }}>Session {sessionPlan?.session_number || '—'} — {sessionPlan?.session_title || 'Playlist'}</div>
        <div className="text-[11px] mt-[2px]" style={{ color: '#7a7f8a' }}>{playlistData.length} videos · {formatDuration(totalDuration)} total</div>
      </div>
      {playlistData.length === 0 ? (
        <div className="p-6 text-center text-[12px]" style={{ color: '#aab0bc' }}>No videos added yet. Search and add videos to build your playlist.</div>
      ) : (
        <div>
          {playlistData.map((v, i) => (
            <div key={v.id} className="flex items-center gap-3 px-[11px] py-[8px] border-b border-[#f0f1f3] hover:bg-[#f9f9fb] transition-colors group">
              <GripVertical className="w-3 h-3 text-[#aab0bc] opacity-0 group-hover:opacity-100 cursor-grab" />
              <span className="text-[10px] font-medium w-4 text-center" style={{ color: '#aab0bc' }}>{i + 1}</span>
              <div className="w-[44px] h-[28px] rounded bg-[#0f2044] flex-shrink-0 overflow-hidden">
                <img src={`https://img.youtube.com/vi/${v.youtube_id}/default.jpg`} alt="" className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              </div>
              <span className="flex-1 text-[11px] font-medium truncate" style={{ color: '#0f2044' }}>{v.title}</span>
              <span className="text-[10px]" style={{ color: '#aab0bc' }}>{formatDuration(v.duration_seconds)}</span>
              <button onClick={() => removeFromPlaylist(v.id)} className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-50 transition-all">
                <X className="w-3 h-3 text-[#b42a2a]" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  </div>
);

// ─── Filter Section ───────────────────────────────────────
const FilterSection: React.FC<{ settings: any; setSettings: (fn: any) => void; strictness: string; setStrictness: (v: string) => void }> = ({ settings, setSettings, strictness, setStrictness }) => {
  const rules = [
    { key: 'block_music', label: 'Block videos with background music' },
    { key: 'block_mixed_gender', label: 'Block mixed-gender physical content' },
    { key: 'require_islamic_context', label: 'Require Islamic greeting context preferred' },
    { key: 'prefer_ad_free', label: 'Prefer ad-free / minimal-ads channels' },
    { key: 'flag_non_islamic_channels', label: 'Flag videos from non-Islamic channels' },
    { key: 'require_dress_standards', label: 'Require appropriate dress standards' },
    { key: 'require_arabic_subtitles', label: 'Require Arabic subtitles' },
    { key: 'require_female_teacher', label: 'Require female teacher only' },
    { key: 'require_male_teacher', label: 'Require male teacher only' },
    { key: 'block_non_arabic_audio', label: 'Block any non-Arabic audio' },
  ];

  return (
    <div className="max-w-[560px] space-y-3">
      <div className="bg-white border border-[#e8e9eb] rounded-[10px] p-4">
        <div className="text-[13px] font-medium mb-3" style={{ color: '#0f2044' }}>Strictness level</div>
        <div className="flex gap-1">
          {['lenient', 'standard', 'strict', 'custom'].map(s => (
            <button key={s} onClick={() => setStrictness(s)} className="text-[11px] px-3 py-[5px] rounded-[7px] capitalize font-medium transition-colors" style={{
              backgroundColor: strictness === s ? '#0f2044' : '#fff',
              color: strictness === s ? '#fff' : '#4a5264',
              border: `0.5px solid ${strictness === s ? '#0f2044' : '#e8e9eb'}`,
            }}>{s}</button>
          ))}
        </div>
      </div>
      <div className="bg-white border border-[#e8e9eb] rounded-[10px] p-4 space-y-3">
        <div className="text-[13px] font-medium" style={{ color: '#0f2044' }}>Filter rules</div>
        {rules.map(r => (
          <div key={r.key} className="flex items-center justify-between">
            <Label className="text-[12px] font-normal" style={{ color: '#4a5264' }}>{r.label}</Label>
            <Switch checked={settings[r.key]} onCheckedChange={v => setSettings((p: any) => ({ ...p, [r.key]: v }))} />
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── Flagged Section ──────────────────────────────────────
const FlaggedSection: React.FC<{ videos: VideoItem[] }> = ({ videos }) => (
  <div className="space-y-3">
    <div className="bg-[#fde8e8] border border-[#f09595] rounded-[9px] px-3 py-2 flex items-center gap-2">
      <AlertTriangle className="w-4 h-4 text-[#b42a2a]" />
      <span className="text-[12px] font-medium text-[#b42a2a]">{videos.length} videos flagged by AI · Review before allowing</span>
    </div>
    <div className="space-y-2">
      {videos.map(v => (
        <div key={v.id} className="bg-white border border-[#e8e9eb] rounded-[10px] overflow-hidden">
          <div className="flex items-start gap-3 p-3">
            <div className="w-[80px] h-[50px] rounded bg-[#0f2044] flex-shrink-0 flex items-center justify-center">
              <Eye className="w-4 h-4 text-white/40" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[12px] font-medium" style={{ color: '#0f2044' }}>{v.title}</div>
              <div className="text-[10px] mt-[2px]" style={{ color: '#7a7f8a' }}>{v.channel_name}</div>
              <div className="mt-2 bg-[#fde8e8] rounded-[6px] p-2 space-y-[2px]">
                {v.safety_flags.map((flag, i) => (
                  <div key={i} className="flex items-center gap-1 text-[10px] text-[#b42a2a]">
                    <AlertTriangle className="w-3 h-3 flex-shrink-0" />{flag}
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 px-3 py-2 border-t bg-[#fafbfc] border-[#f0f1f3]">
            <Button variant="outline" size="sm" className="text-[10px] h-6 px-2" style={{ borderColor: '#b42a2a', color: '#b42a2a' }}>
              <Ban className="w-3 h-3 mr-1" />Block permanently
            </Button>
            <Button variant="outline" size="sm" className="text-[10px] h-6 px-2" style={{ borderColor: '#1a7340', color: '#1a7340' }}>
              <Check className="w-3 h-3 mr-1" />Allow anyway
            </Button>
            <Button variant="ghost" size="sm" className="text-[10px] h-6 px-2"><Eye className="w-3 h-3 mr-1" />Preview</Button>
          </div>
        </div>
      ))}
    </div>
  </div>
);

// ─── Analytics Section ────────────────────────────────────
const AnalyticsSection: React.FC = () => {
  const stats = [
    { label: 'Avg completion', value: '78%', color: '#1a7340' },
    { label: 'Students watched', value: '12', color: '#1a56b0' },
    { label: 'Replays', value: '8', color: '#8a5c00' },
    { label: 'Total watch time', value: '2h 14m', color: '#0f2044' },
  ];

  const videoStats = [
    { title: 'Learn Arabic Greetings', students: 5, completion: 92, replays: 3, time: '6:12' },
    { title: 'Introduce Yourself in Arabic', students: 4, completion: 85, replays: 2, time: '4:30' },
    { title: 'Greetings Vocabulary Drill', students: 3, completion: 65, replays: 3, time: '7:45' },
  ];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-4 gap-2">
        {stats.map((s, i) => (
          <div key={i} className="bg-white border border-[#e8e9eb] rounded-[10px] p-3">
            <div className="text-[20px] font-medium" style={{ color: s.color }}>{s.value}</div>
            <div className="text-[11px]" style={{ color: '#7a7f8a' }}>{s.label}</div>
          </div>
        ))}
      </div>
      <div className="bg-white border border-[#e8e9eb] rounded-[10px] overflow-hidden">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="border-b border-[#f0f1f3] bg-[#fafbfc]">
              <th className="text-left px-3 py-2 font-medium text-[10px] uppercase text-[#7a7f8a]">Video</th>
              <th className="text-left px-3 py-2 font-medium text-[10px] uppercase text-[#7a7f8a]">Students</th>
              <th className="text-left px-3 py-2 font-medium text-[10px] uppercase text-[#7a7f8a]">Completion</th>
              <th className="text-left px-3 py-2 font-medium text-[10px] uppercase text-[#7a7f8a]">Replays</th>
              <th className="text-left px-3 py-2 font-medium text-[10px] uppercase text-[#7a7f8a]">Avg time</th>
            </tr>
          </thead>
          <tbody>
            {videoStats.map((vs, i) => (
              <tr key={i} className="border-b border-[#f0f1f3] hover:bg-[#f9f9fb]">
                <td className="px-3 py-2 font-medium" style={{ color: '#0f2044' }}>{vs.title}</td>
                <td className="px-3 py-2" style={{ color: '#4a5264' }}>{vs.students}</td>
                <td className="px-3 py-2 font-medium" style={{ color: vs.completion >= 90 ? '#1a7340' : vs.completion >= 70 ? '#8a5c00' : '#b42a2a' }}>{vs.completion}%</td>
                <td className="px-3 py-2" style={{ color: '#4a5264' }}>{vs.replays}</td>
                <td className="px-3 py-2" style={{ color: '#7a7f8a' }}>{vs.time}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ─── Insights Section ─────────────────────────────────────
const InsightsSection: React.FC<{ sessionPlan: SessionPlan | null }> = ({ sessionPlan }) => {
  const insights = [
    { type: 'engagement', title: 'High replay on greeting vocabulary', description: 'Students replayed the اسمي segment in "Learn Arabic Greetings" an average of 3 times. This correlates with lower assessment scores on Q4.', action: 'Add a dedicated drill video for self-introduction patterns in Session 3' },
    { type: 'struggle_signal', title: 'Low completion on vocabulary drill', description: 'Only 65% of students completed the "Greetings Vocabulary Drill" video. Average watch time dropped significantly at the 5-minute mark.', action: 'Replace with a shorter, more engaging drill video or split into two parts' },
    { type: 'recommendation', title: 'Add native speaker conversation model', description: 'Students who watched native speaker videos scored 15% higher on scenario questions. Consider adding more authentic conversation examples.', action: 'Search for a 3-5 minute native Arabic conversation on introductions' },
  ];

  const iconMap: Record<string, { icon: React.ElementType; bg: string; color: string }> = {
    engagement: { icon: TrendingUp, bg: '#eef2fa', color: '#1a56b0' },
    struggle_signal: { icon: AlertTriangle, bg: '#fff8e6', color: '#8a5c00' },
    recommendation: { icon: Lightbulb, bg: '#e6f4ea', color: '#1a7340' },
  };

  return (
    <div className="space-y-2">
      {insights.map((ins, i) => {
        const meta = iconMap[ins.type] || iconMap.engagement;
        const Icon = meta.icon;
        return (
          <div key={i} className="bg-white border border-[#e8e9eb] rounded-[10px] overflow-hidden">
            <div className="flex items-start gap-3 px-[13px] py-[11px]">
              <div className="w-7 h-7 rounded-[7px] flex items-center justify-center flex-shrink-0 mt-[2px]" style={{ backgroundColor: meta.bg }}>
                <Icon className="w-3.5 h-3.5" style={{ color: meta.color }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-medium px-2 py-[1px] rounded-full capitalize" style={{ backgroundColor: meta.bg, color: meta.color }}>{ins.type.replace('_', ' ')}</span>
                  <span className="text-[12.5px] font-medium" style={{ color: '#0f2044' }}>{ins.title}</span>
                </div>
                <div className="text-[12px] mb-2" style={{ color: '#4a5264', lineHeight: 1.5 }}>{ins.description}</div>
                <div className="flex items-start gap-[6px] text-[11px]" style={{ color: '#4a5264' }}>
                  <div className="w-[5px] h-[5px] rounded-full mt-[5px] flex-shrink-0" style={{ backgroundColor: meta.color }} />
                  {ins.action}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 px-[13px] py-[7px] border-t bg-[#fafbfc] border-[#f0f1f3]">
              <Button variant="outline" size="sm" className="text-[10px] h-6 px-2"><ChevronRight className="w-3 h-3 mr-1" />Apply to next session</Button>
              <Button variant="ghost" size="sm" className="text-[10px] h-6 px-2 text-[#aab0bc]">Dismiss</Button>
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ─── Right Panel ──────────────────────────────────────────
const RightPanel: React.FC<{ activeSection: Section; videos: VideoItem[]; playlistData: VideoItem[]; totalDuration: number }> = ({ activeSection, videos, playlistData, totalDuration }) => (
  <div className="p-3">
    {activeSection === 'search' && (
      <>
        <div className="text-[12px] font-medium mb-1" style={{ color: '#0f2044' }}>AI match score</div>
        <div className="text-[11px] mb-3" style={{ color: '#7a7f8a' }}>How AI ranked these results</div>

        {videos.length > 0 && (
          <div className="space-y-[6px] mb-4">
            <div className="text-[10px] font-medium uppercase mb-1" style={{ color: '#aab0bc' }}>Ranking criteria</div>
            {[
              { label: 'Beginner level match', pct: 96, color: '#1a7340' },
              { label: 'Session topic match', pct: 94, color: '#1a7340' },
              { label: 'No background music', pct: 100, color: '#1a7340' },
              { label: 'Islamic context safe', pct: 100, color: '#1a7340' },
              { label: 'Duration 5-10 min', pct: 80, color: '#8a5c00' },
              { label: 'Subtitles available', pct: 70, color: '#8a5c00' },
              { label: 'Channel credibility', pct: 88, color: '#1a7340' },
            ].map(c => (
              <div key={c.label} className="flex items-center gap-2">
                <span className="text-[10px] flex-1" style={{ color: '#4a5264' }}>{c.label}</span>
                <div className="w-[30px] h-[3px] rounded-full bg-[#e8e9eb]">
                  <div className="h-full rounded-full" style={{ width: `${c.pct}%`, backgroundColor: c.color }} />
                </div>
                <span className="text-[10px] font-medium w-7 text-right" style={{ color: c.color }}>{c.pct}%</span>
              </div>
            ))}
          </div>
        )}

        <div className="border-t border-[#f0f1f3] pt-3 mt-3">
          <div className="text-[11px] font-medium mb-2" style={{ color: '#0f2044' }}>Session {playlistData.length > 0 ? '' : '—'} playlist</div>
          {playlistData.length === 0 ? (
            <div className="text-[10px]" style={{ color: '#aab0bc' }}>No videos added yet</div>
          ) : (
            <div className="space-y-[4px]">
              {playlistData.map(v => (
                <div key={v.id} className="flex items-center gap-2 p-[5px] rounded-[6px] hover:bg-[#f9f9fb]">
                  <div className="w-[32px] h-[20px] rounded bg-[#0f2044] flex-shrink-0 overflow-hidden">
                    <img src={`https://img.youtube.com/vi/${v.youtube_id}/default.jpg`} alt="" className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                  </div>
                  <span className="flex-1 text-[10px] truncate" style={{ color: '#4a5264' }}>{v.title}</span>
                  <span className="text-[9px]" style={{ color: '#aab0bc' }}>{formatDuration(v.duration_seconds)}</span>
                </div>
              ))}
              <div className="text-[10px] mt-2 pt-2 border-t border-[#f0f1f3]" style={{ color: '#7a7f8a' }}>
                {formatDuration(totalDuration)} total · {playlistData.length} videos
              </div>
            </div>
          )}
        </div>
      </>
    )}

    {activeSection === 'analytics' && (
      <>
        <div className="text-[12px] font-medium mb-1" style={{ color: '#0f2044' }}>Student list</div>
        <div className="text-[11px] mb-3" style={{ color: '#7a7f8a' }}>Watch status</div>
        {['Aisha Khan', 'Omar Hassan', 'Fatima Ali', 'Yusuf Ahmed', 'Maryam Siddiq'].map((name, i) => (
          <div key={name} className="flex items-center gap-2 p-[6px] rounded-[6px] hover:bg-[#f9f9fb]">
            <div className="w-5 h-5 rounded-full bg-[#eef2fa] flex items-center justify-center text-[8px] font-medium text-[#1a56b0]">{name[0]}</div>
            <span className="flex-1 text-[11px]" style={{ color: '#0f2044' }}>{name}</span>
            <span className="text-[10px] font-medium" style={{ color: (70 + i * 6) >= 80 ? '#1a7340' : '#8a5c00' }}>{70 + i * 6}%</span>
          </div>
        ))}
      </>
    )}

    {(activeSection !== 'search' && activeSection !== 'analytics') && (
      <div className="text-center py-6"><div className="text-[11px]" style={{ color: '#aab0bc' }}>Context panel</div></div>
    )}
  </div>
);

export default TeachingOSVideo;
